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
        # Speechmatics Batch API settings
        "speechmatics_api_key": os.environ.get("SPEECHMATICS_API_KEY", ""),
        "speechmatics_api_url": os.environ.get(
            "SPEECHMATICS_API_URL", "https://asr.api.speechmatics.com/v2"
        ),
        "speechmatics_poll_interval": int(os.environ.get("SPEECHMATICS_POLL_INTERVAL", "2")),
        "speechmatics_max_poll_attempts": int(os.environ.get("SPEECHMATICS_MAX_POLL_ATTEMPTS", "60")),
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
        Routes to Speechmatics or Groq based on the SPEECH_PROVIDER env var.

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
            f"type={content_type}, file={filename}, provider={self.provider}"
        )

        # Step 1: Validate audio
        validated_type, extension = self.validate_audio(audio_bytes, content_type, filename)

        # Step 2+3: Route to the configured provider
        if self.provider == "speechmatics":
            return self._process_via_speechmatics(audio_bytes, extension, validated_type)
        else:
            return self._process_via_groq(audio_bytes, extension)

    def _process_via_groq(
        self,
        audio_bytes: bytes,
        extension: str,
    ) -> TranscriptionResult:
        """
        Process audio via Groq Whisper (STT) + Groq LLM (translation).
        This is the original processing path.
        """
        # Transcribe Marathi speech
        transcription = self.transcribe_marathi(audio_bytes, extension)

        # Translate to English
        translation = self.translate_to_english(transcription["text"])

        # Build result
        return TranscriptionResult(
            transcript_mr=transcription["text"],
            translation_en=translation["text"],
            detected_language=transcription.get("language", "mr"),
            confidence=None,  # Whisper doesn't provide confidence in verbose mode
            stt_model=transcription["model"],
            translation_model=translation["model"],
            provider="groq",
            audio_duration_seconds=transcription.get("duration"),
            provider_metadata={
                "stt_response": transcription.get("raw_response", {}),
                "translation_response": translation.get("raw_response", {}),
            },
        )

    def _process_via_speechmatics(
        self,
        audio_bytes: bytes,
        extension: str,
        content_type: str,
    ) -> TranscriptionResult:
        """
        Process audio via Speechmatics Batch API for Marathi transcription,
        then use Groq LLM for English translation.

        Speechmatics does not support Marathi→English translation natively,
        so we use a hybrid approach:
        1. Speechmatics: Marathi speech → Marathi text (STT)
        2. Groq LLM: Marathi text → English text (translation)
        """
        config = get_config()
        sm_api_key = config["speechmatics_api_key"]
        sm_base_url = config["speechmatics_api_url"].rstrip("/")
        poll_interval = config["speechmatics_poll_interval"]
        max_poll_attempts = config["speechmatics_max_poll_attempts"]

        if not sm_api_key:
            raise TranscriptionError("SPEECHMATICS_API_KEY is not configured")

        # ---- Step 1: Submit batch job (transcription only, no translation) ----
        job_config = json.dumps({
            "type": "transcription",
            "transcription_config": {
                "operating_point": "enhanced",
                "language": "mr",  # Marathi source language
            },
        })

        logger.info("[SpeechService:Speechmatics] Submitting batch job")
        start_time = time.time()

        with tempfile.NamedTemporaryFile(suffix=f".{extension}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                submit_response = self.session.post(
                    f"{sm_base_url}/jobs/",
                    headers={"Authorization": f"Bearer {sm_api_key}"},
                    files={"data_file": (f"audio.{extension}", audio_file, content_type)},
                    data={"config": job_config},
                    timeout=self.request_timeout,
                )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        if submit_response.status_code not in (200, 201):
            error_detail = submit_response.text[:500] if submit_response.text else "Unknown"
            logger.error(
                f"[SpeechService:Speechmatics] Job submit failed: "
                f"{submit_response.status_code} - {error_detail}"
            )
            raise TranscriptionError(
                f"Speechmatics job submission failed ({submit_response.status_code}). "
                "Please try again."
            )

        job_data = submit_response.json()
        job_id = job_data.get("id")
        if not job_id:
            raise TranscriptionError("Speechmatics returned no job ID")

        logger.info(f"[SpeechService:Speechmatics] Job submitted: {job_id}")

        # ---- Step 2: Poll for completion ----
        job_url = f"{sm_base_url}/jobs/{job_id}"
        transcript_url = f"{sm_base_url}/jobs/{job_id}/transcript?format=json-v2"
        headers = {"Authorization": f"Bearer {sm_api_key}"}

        for attempt in range(1, max_poll_attempts + 1):
            time.sleep(poll_interval)

            try:
                status_response = self.session.get(
                    job_url, headers=headers, timeout=self.request_timeout
                )
            except requests.RequestException as e:
                logger.warning(f"[SpeechService:Speechmatics] Poll attempt {attempt} failed: {e}")
                continue

            if status_response.status_code != 200:
                logger.warning(
                    f"[SpeechService:Speechmatics] Poll attempt {attempt}: "
                    f"status {status_response.status_code}"
                )
                continue

            job_info = status_response.json().get("job", {})
            job_status = job_info.get("status", "")

            if job_status == "done":
                logger.info(
                    f"[SpeechService:Speechmatics] Job {job_id} done after "
                    f"{time.time() - start_time:.1f}s (attempt {attempt})"
                )
                break
            elif job_status in ("rejected", "deleted"):
                error_msg = job_info.get("error", "Job was rejected")
                raise TranscriptionError(f"Speechmatics job failed: {error_msg}")

            logger.debug(
                f"[SpeechService:Speechmatics] Poll {attempt}/{max_poll_attempts}: {job_status}"
            )
        else:
            # Exhausted all poll attempts
            raise TranscriptionError(
                "Speechmatics transcription timed out. Please try again with a shorter recording."
            )

        # ---- Step 3: Retrieve transcript ----
        try:
            transcript_response = self.session.get(
                transcript_url, headers=headers, timeout=self.request_timeout
            )
        except requests.RequestException as e:
            raise TranscriptionError(f"Failed to retrieve Speechmatics transcript: {e}")

        if transcript_response.status_code != 200:
            raise TranscriptionError(
                f"Speechmatics transcript retrieval failed ({transcript_response.status_code})"
            )

        transcript_data = transcript_response.json()
        stt_elapsed = time.time() - start_time

        # ---- Step 4: Extract Marathi transcript ----
        results = transcript_data.get("results", [])

        # Join words with spaces, but punctuation attaches to previous word
        transcript_mr = ""
        for r in results:
            alternatives = r.get("alternatives", [])
            if not alternatives:
                continue
            content = alternatives[0].get("content", "")
            if r.get("type") == "punctuation":
                transcript_mr += content
            else:
                if transcript_mr:
                    transcript_mr += " "
                transcript_mr += content

        transcript_mr = transcript_mr.strip()

        if not transcript_mr:
            raise TranscriptionError(
                "Speechmatics returned empty transcript. Please speak clearly and try again."
            )

        logger.info(
            f"[SpeechService:Speechmatics] STT complete in {stt_elapsed:.1f}s: "
            f"mr_len={len(transcript_mr)}"
        )

        # ---- Step 5: Translate Marathi→English via Groq LLM ----
        translation = self.translate_to_english(transcript_mr)
        translation_en = translation["text"]

        if not translation_en:
            raise TranslationError(
                "Translation returned empty text. Please try again."
            )

        elapsed = time.time() - start_time

        # Extract audio duration from job metadata
        audio_duration = None
        job_meta = transcript_data.get("job", {})
        if "duration" in job_meta:
            audio_duration = float(job_meta["duration"])

        logger.info(
            f"[SpeechService:Speechmatics] Complete in {elapsed:.1f}s: "
            f"mr_len={len(transcript_mr)}, en_len={len(translation_en)}"
        )

        return TranscriptionResult(
            transcript_mr=transcript_mr,
            translation_en=translation_en,
            detected_language="mr",
            confidence=None,
            stt_model="speechmatics-batch-enhanced",
            translation_model=translation.get("model", self.translation_model),
            provider="speechmatics",
            audio_duration_seconds=audio_duration,
            provider_metadata={
                "job_id": job_id,
                "stt_elapsed_seconds": round(stt_elapsed, 2),
                "total_elapsed_seconds": round(elapsed, 2),
                "transcript_data": transcript_data,
            },
        )


# Singleton instance for reuse
_service_instance: Optional[SpeechStatementService] = None
_service_provider: Optional[str] = None


def get_speech_service() -> SpeechStatementService:
    """Get or create the speech statement service singleton.

    Re-creates the instance if the SPEECH_PROVIDER env var has changed,
    ensuring hot-switching between providers without restart.
    """
    global _service_instance, _service_provider
    current_provider = os.environ.get("SPEECH_PROVIDER", "groq")
    if _service_instance is None or _service_provider != current_provider:
        _service_instance = SpeechStatementService()
        _service_provider = current_provider
        logger.info(f"[SpeechService] Initialized service with provider: {current_provider}")
    return _service_instance
