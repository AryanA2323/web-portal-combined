"""
Speech Statement Service for Marathi speech-to-text and translation.

Uses Groq APIs for:
- STT: Whisper large-v3 model with Marathi language hint
- Translation: Llama model for Marathi to English translation

Provider is configurable via environment variables for future extensibility.
"""

from __future__ import annotations

import io
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class SpeechStatementError(Exception):
    """Base exception for speech statement service errors."""

    def __init__(self, message: str, error_code: str = "SPEECH_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class AudioValidationError(SpeechStatementError):
    """Raised when audio validation fails."""

    def __init__(self, message: str):
        super().__init__(message, "AUDIO_VALIDATION_ERROR")


class ProviderError(SpeechStatementError):
    """Raised when provider API call fails."""

    def __init__(self, message: str, provider: str = "groq"):
        self.provider = provider
        super().__init__(message, "PROVIDER_ERROR")


class TranscriptionError(SpeechStatementError):
    """Raised when transcription fails."""

    def __init__(self, message: str):
        super().__init__(message, "TRANSCRIPTION_ERROR")


class TranslationError(SpeechStatementError):
    """Raised when translation fails."""

    def __init__(self, message: str):
        super().__init__(message, "TRANSLATION_ERROR")


@dataclass
class TranscriptionResult:
    """Result from speech-to-text and translation processing."""

    transcript_mr: str
    translation_en: str
    detected_language: str
    confidence: Optional[float]
    stt_model: str
    translation_model: str
    provider: str
    provider_metadata: Dict[str, Any]
    audio_duration_seconds: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "transcript_mr": self.transcript_mr,
            "translation_en": self.translation_en,
            "detected_language": self.detected_language,
            "confidence": self.confidence,
            "stt_model": self.stt_model,
            "translation_model": self.translation_model,
            "provider": self.provider,
            "provider_metadata": self.provider_metadata,
            "audio_duration_seconds": self.audio_duration_seconds,
        }


# Allowed audio formats with their content types
ALLOWED_AUDIO_FORMATS = {
    "m4a": ["audio/m4a", "audio/x-m4a", "audio/mp4"],
    "mp3": ["audio/mpeg", "audio/mp3"],
    "wav": ["audio/wav", "audio/x-wav", "audio/wave"],
    "webm": ["audio/webm"],
    "aac": ["audio/aac", "audio/x-aac"],
    "ogg": ["audio/ogg"],
    "flac": ["audio/flac", "audio/x-flac"],
}

# Flatten to list of all allowed content types
ALLOWED_CONTENT_TYPES = [ct for formats in ALLOWED_AUDIO_FORMATS.values() for ct in formats]


def get_config() -> Dict[str, Any]:
    """Get configuration from environment variables with defaults."""
    return {
        "provider": os.environ.get("SPEECH_PROVIDER", "groq"),
        "api_key": os.environ.get("GROQ_API_KEY", os.environ.get("GROK_API_KEY", "")),
        "max_file_mb": int(os.environ.get("SPEECH_MAX_FILE_MB", "15")),
        "max_duration_seconds": int(os.environ.get("SPEECH_MAX_DURATION_SECONDS", "180")),
        "request_timeout_seconds": int(os.environ.get("SPEECH_REQUEST_TIMEOUT_SECONDS", "60")),
        "stt_model": os.environ.get("SPEECH_STT_MODEL", "whisper-large-v3"),
        "translation_model": os.environ.get("SPEECH_TRANSLATION_MODEL", "llama-3.3-70b-versatile"),
    }


class SpeechStatementService:
    """
    Service for processing Marathi speech recordings.

    Workflow:
    1. Validate audio input (format, size)
    2. Transcribe Marathi speech using Groq Whisper API
    3. Translate Marathi text to English using Groq LLM
    4. Return normalized result with metadata
    """

    # Groq API endpoints
    GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
    GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the service with optional API key override."""
        config = get_config()
        self.api_key = api_key or config["api_key"]
        self.provider = config["provider"]
        self.max_file_bytes = config["max_file_mb"] * 1024 * 1024
        self.max_duration_seconds = config["max_duration_seconds"]
        self.request_timeout = config["request_timeout_seconds"]
        self.stt_model = config["stt_model"]
        self.translation_model = config["translation_model"]

        # Configure requests session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)

    def validate_audio(
        self,
        audio_bytes: bytes,
        content_type: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Validate audio input.

        Args:
            audio_bytes: Raw audio data
            content_type: MIME type if known
            filename: Original filename if known

        Returns:
            Tuple of (validated_content_type, file_extension)

        Raises:
            AudioValidationError: If validation fails
        """
        # Check if audio data is present
        if not audio_bytes or len(audio_bytes) == 0:
            raise AudioValidationError("Empty audio file provided")

        # Check file size
        if len(audio_bytes) > self.max_file_bytes:
            max_mb = self.max_file_bytes / (1024 * 1024)
            actual_mb = len(audio_bytes) / (1024 * 1024)
            raise AudioValidationError(
                f"Audio file too large: {actual_mb:.1f}MB exceeds limit of {max_mb:.0f}MB"
            )

        # Determine extension from filename
        extension = None
        if filename:
            parts = filename.rsplit(".", 1)
            if len(parts) > 1:
                extension = parts[1].lower()

        # Validate content type
        validated_content_type = content_type
        if content_type:
            content_type_lower = content_type.lower().split(";")[0].strip()
            if content_type_lower not in ALLOWED_CONTENT_TYPES:
                raise AudioValidationError(
                    f"Unsupported audio format: {content_type}. "
                    f"Allowed: m4a, mp3, wav, webm, aac, ogg, flac"
                )
            validated_content_type = content_type_lower
        elif extension:
            # Infer content type from extension
            if extension in ALLOWED_AUDIO_FORMATS:
                validated_content_type = ALLOWED_AUDIO_FORMATS[extension][0]
            else:
                raise AudioValidationError(
                    f"Unsupported file extension: .{extension}. "
                    f"Allowed: m4a, mp3, wav, webm, aac, ogg, flac"
                )
        else:
            # Try to detect from magic bytes (basic check)
            if audio_bytes[:4] == b"RIFF":
                validated_content_type = "audio/wav"
                extension = "wav"
            elif audio_bytes[:3] == b"ID3" or audio_bytes[:2] == b"\xff\xfb":
                validated_content_type = "audio/mpeg"
                extension = "mp3"
            elif audio_bytes[:4] == b"ftyp" or audio_bytes[4:8] == b"ftyp":
                validated_content_type = "audio/m4a"
                extension = "m4a"
            elif audio_bytes[:4] == b"OggS":
                validated_content_type = "audio/ogg"
                extension = "ogg"
            else:
                raise AudioValidationError(
                    "Could not determine audio format. Please provide content type or file extension."
                )

        if not extension:
            # Get extension from content type
            for ext, types in ALLOWED_AUDIO_FORMATS.items():
                if validated_content_type in types:
                    extension = ext
                    break
            if not extension:
                extension = "m4a"  # Default fallback

        logger.info(
            f"[SpeechService] Validated audio: {len(audio_bytes)} bytes, "
            f"type={validated_content_type}, ext={extension}"
        )

        return validated_content_type, extension

    def transcribe_marathi(self, audio_bytes: bytes, extension: str) -> Dict[str, Any]:
        """
        Transcribe Marathi speech to text using Groq Whisper API.

        Args:
            audio_bytes: Validated audio data
            extension: File extension for the audio

        Returns:
            Dictionary with transcription result and metadata

        Raises:
            TranscriptionError: If transcription fails
        """
        if not self.api_key:
            raise TranscriptionError("GROQ_API_KEY is not configured")

        start_time = time.time()
        logger.info(f"[SpeechService] Starting Marathi transcription with {self.stt_model}")

        # Create temporary file for upload
        with tempfile.NamedTemporaryFile(suffix=f".{extension}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                response = self.session.post(
                    self.GROQ_TRANSCRIPTION_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                    },
                    files={
                        "file": (f"audio.{extension}", audio_file),
                    },
                    data={
                        "model": self.stt_model,
                        "language": "mr",  # Marathi language hint
                        "response_format": "verbose_json",
                        "temperature": "0",  # Deterministic transcription for accuracy
                    },
                    timeout=self.request_timeout,
                )

            elapsed = time.time() - start_time
            logger.info(f"[SpeechService] Transcription API responded in {elapsed:.2f}s")

            if response.status_code != 200:
                error_msg = response.text[:500] if response.text else "Unknown error"
                logger.error(f"[SpeechService] Transcription failed: {response.status_code} - {error_msg}")
                raise TranscriptionError(f"Transcription API error: {response.status_code}")

            result = response.json()

            text = result.get("text", "").strip()
            if not text:
                raise TranscriptionError("Transcription returned empty text. Please speak clearly and try again.")

            # Log the transcription for debugging
            logger.info(f"[SpeechService] Transcription result: {text[:100]}...")

            return {
                "text": text,
                "language": result.get("language", "mr"),
                "duration": result.get("duration"),
                "model": self.stt_model,
                "raw_response": result,
            }

        except requests.Timeout:
            logger.error("[SpeechService] Transcription request timed out")
            raise TranscriptionError("Transcription request timed out. Please try again.")
        except requests.RequestException as e:
            logger.error(f"[SpeechService] Transcription request failed: {e}")
            raise TranscriptionError(f"Transcription request failed: {str(e)}")
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def translate_to_english(self, marathi_text: str) -> Dict[str, Any]:
        """
        Translate Marathi text to English using Groq LLM.

        Args:
            marathi_text: Text in Marathi to translate

        Returns:
            Dictionary with translation result and metadata

        Raises:
            TranslationError: If translation fails
        """
        if not self.api_key:
            raise TranslationError("GROQ_API_KEY is not configured")

        start_time = time.time()
        logger.info(f"[SpeechService] Starting translation with {self.translation_model}")

        # Enhanced system prompt for accurate legal/insurance domain translation
        system_prompt = (
            "You are an expert Marathi to English translator specializing in "
            "insurance investigation reports and legal witness statements in India.\n\n"
            "CRITICAL TRANSLATION RULES:\n"
            "1. NAMES: Transliterate all Indian names faithfully (e.g., 'राजेश शर्मा' → 'Rajesh Sharma')\n"
            "2. NUMBERS: Preserve all numbers exactly as spoken (phone numbers, dates, amounts, policy numbers)\n"
            "3. ADDRESSES: Translate place names but keep proper nouns (e.g., 'मुंबई' → 'Mumbai')\n"
            "4. DATES: Use DD/MM/YYYY format for Indian dates\n"
            "5. VEHICLE NUMBERS: Keep registration numbers in original format (e.g., MH-12-AB-1234)\n"
            "6. MEDICAL TERMS: Use standard English medical terminology\n"
            "7. LEGAL TERMS: Use appropriate legal English (FIR, chargesheet, MV Act sections)\n"
            "8. TONE: Maintain the formal, statement-like tone of the original\n"
            "9. COMPLETENESS: Translate everything - do not summarize or omit details\n"
            "10. CLARITY: If something is unclear in Marathi, translate it as-is without interpretation\n\n"
            "Output ONLY the English translation. No explanations, notes, or formatting."
        )

        user_prompt = f"Translate this Marathi insurance investigation statement to English:\n\n{marathi_text}"

        try:
            response = self.session.post(
                self.GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.translation_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.1,  # Low temperature for faithful translation
                    "max_tokens": 4000,
                },
                timeout=self.request_timeout,
            )

            elapsed = time.time() - start_time
            logger.info(f"[SpeechService] Translation API responded in {elapsed:.2f}s")

            if response.status_code != 200:
                error_msg = response.text[:500] if response.text else "Unknown error"
                logger.error(f"[SpeechService] Translation failed: {response.status_code} - {error_msg}")
                raise TranslationError(f"Translation API error: {response.status_code}")

            result = response.json()
            choices = result.get("choices", [])

            if not choices:
                raise TranslationError("Translation returned no results")

            translation = choices[0].get("message", {}).get("content", "").strip()
            if not translation:
                raise TranslationError("Translation returned empty text")

            return {
                "text": translation,
                "model": self.translation_model,
                "raw_response": result,
            }

        except requests.Timeout:
            logger.error("[SpeechService] Translation request timed out")
            raise TranslationError("Translation request timed out. Please try again.")
        except requests.RequestException as e:
            logger.error(f"[SpeechService] Translation request failed: {e}")
            raise TranslationError(f"Translation request failed: {str(e)}")

    def process_audio(
        self,
        audio_bytes: bytes,
        content_type: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> TranscriptionResult:
        """
        Process audio file: validate, transcribe, and translate.

        This is the main entry point for the service.

        Args:
            audio_bytes: Raw audio data
            content_type: Optional MIME type
            filename: Optional original filename

        Returns:
            TranscriptionResult with all processing results

        Raises:
            SpeechStatementError: If any step fails
        """
        logger.info(
            f"[SpeechService] Processing audio: {len(audio_bytes)} bytes, "
            f"type={content_type}, file={filename}"
        )

        # Step 1: Validate audio
        validated_type, extension = self.validate_audio(audio_bytes, content_type, filename)

        # Step 2: Transcribe Marathi speech
        transcription = self.transcribe_marathi(audio_bytes, extension)

        # Step 3: Translate to English
        translation = self.translate_to_english(transcription["text"])

        # Build result
        return TranscriptionResult(
            transcript_mr=transcription["text"],
            translation_en=translation["text"],
            detected_language=transcription.get("language", "mr"),
            confidence=None,  # Whisper doesn't provide confidence in verbose mode
            stt_model=transcription["model"],
            translation_model=translation["model"],
            provider=self.provider,
            audio_duration_seconds=transcription.get("duration"),
            provider_metadata={
                "stt_response": transcription.get("raw_response", {}),
                "translation_response": translation.get("raw_response", {}),
            },
        )


# Singleton instance for reuse
_service_instance: Optional[SpeechStatementService] = None


def get_speech_service() -> SpeechStatementService:
    """Get or create the speech statement service singleton."""
    global _service_instance
    if _service_instance is None:
        _service_instance = SpeechStatementService()
    return _service_instance
