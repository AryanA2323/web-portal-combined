"""Services for generating AI brief reports from vendor statement PDFs."""

from __future__ import annotations

import base64
import io
import os
from typing import Any, Dict

import fitz  # PyMuPDF
import requests


class AIBriefGenerationError(Exception):
    """Raised when AI brief generation fails."""


class AIBriefService:
    """Generate concise AI brief reports using Groq and extracted PDF text."""

    text_model = "llama-3.3-70b-versatile"
    vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"
    api_url = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("GROK_API_KEY", "").strip()

    def extract_pdf_text(self, pdf_bytes: bytes) -> str:
        """Extract text from a PDF using PyMuPDF. Returns empty string if none found."""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception:
            return ""

        pages: list[str] = []
        for page in doc:
            text = page.get_text().strip()
            if text:
                pages.append(text)

        return "\n\n".join(pages).strip()

    def pdf_pages_to_base64_images(self, pdf_bytes: bytes, max_pages: int = 5) -> list[str]:
        """Render PDF pages to base64-encoded PNG images using PyMuPDF."""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise AIBriefGenerationError(f"Invalid PDF file: {exc}") from exc

        images: list[str] = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            images.append(base64.b64encode(img_bytes).decode())

        if not images:
            raise AIBriefGenerationError("Could not render any pages from the PDF.")

        return images

    def _build_context_block(self, case_context: Dict[str, Any]) -> str:
        """Build the case context block used in prompts."""
        context_lines = [
            f"Case Number: {case_context.get('case_number') or 'N/A'}",
            f"Claim Number: {case_context.get('claim_number') or 'N/A'}",
            f"Client Name: {case_context.get('client_name') or 'N/A'}",
            f"Case Type: {case_context.get('case_type') or 'N/A'}",
            f"Assigned Vendor: {case_context.get('assigned_vendor_name') or case_context.get('assigned_vendor') or 'N/A'}",
            f"Incident Brief: {case_context.get('incident_brief') or 'N/A'}",
            f"Location: {case_context.get('incident_location') or 'N/A'}",
            f"Investigation Status: {case_context.get('investigation_report_status') or 'N/A'}",
        ]
        return "\n".join(context_lines)

    _SYSTEM_INSTRUCTION = (
        "You are assisting an insurance incident-management admin team. "
        "Read the vendor statement and the case context, then produce a factual, concise report. "
        "Do not invent facts. If something is unclear, say that it is not stated.\n\n"
        "Return the response in exactly this format:\n"
        "Vendor Statement Summary:\n"
        "- 3 to 6 short bullet points\n\n"
        "Incident Summary:\n"
        "- one short paragraph, maximum 120 words\n\n"
        "Recommended Review Notes:\n"
        "- 2 to 4 short bullet points for the admin reviewer"
    )

    def build_prompt(self, case_context: Dict[str, Any], statement_text: str) -> str:
        """Build a concise structured prompt for the AI model."""
        return (
            f"{self._SYSTEM_INSTRUCTION}\n\n"
            f"Case Context:\n{self._build_context_block(case_context)}\n\n"
            f"Vendor Statement PDF Text:\n{statement_text[:18000]}"
        )

    def _call_text_model(self, prompt: str) -> str:
        """Call Groq with the text-only model."""
        response = requests.post(
            self.api_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.text_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "top_p": 0.8,
                "max_tokens": 900,
            },
            timeout=45,
        )
        return self._parse_response(response)

    def _call_vision_model(self, case_context: Dict[str, Any], page_images: list[str]) -> str:
        """Call Groq with the vision model, sending PDF page images."""
        content: list[dict] = [
            {
                "type": "text",
                "text": (
                    f"{self._SYSTEM_INSTRUCTION}\n\n"
                    f"Case Context:\n{self._build_context_block(case_context)}\n\n"
                    "The vendor statement PDF pages are attached as images below. "
                    "Read all the text from the images and produce the report."
                ),
            },
        ]
        for img_b64 in page_images:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                }
            )

        response = requests.post(
            self.api_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.vision_model,
                "messages": [{"role": "user", "content": content}],
                "temperature": 0.3,
                "top_p": 0.8,
                "max_tokens": 900,
            },
            timeout=60,
        )
        return self._parse_response(response)

    def _parse_response(self, response: requests.Response) -> str:
        """Parse the Groq API response and return the report text."""
        if response.status_code >= 400:
            raise AIBriefGenerationError(
                f"Groq request failed with status {response.status_code}: {response.text[:500]}"
            )

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise AIBriefGenerationError("Groq returned no choices.")

        report_text = choices[0].get("message", {}).get("content", "").strip()
        if not report_text:
            raise AIBriefGenerationError("Groq returned an empty report.")

        return report_text

    def generate_report(self, case_context: Dict[str, Any], pdf_bytes: bytes) -> Dict[str, str]:
        """Generate a structured AI brief report from case context and PDF."""
        if not self.api_key:
            raise AIBriefGenerationError("GROK_API_KEY is not configured on the backend.")

        # Try text extraction first (fast path)
        statement_text = self.extract_pdf_text(pdf_bytes)

        if statement_text:
            # Text-based PDF — use the text model
            prompt = self.build_prompt(case_context, statement_text)
            report_text = self._call_text_model(prompt)
        else:
            # Vector/image-based PDF — fall back to vision model
            page_images = self.pdf_pages_to_base64_images(pdf_bytes)
            statement_text = "(extracted via vision model from PDF images)"
            report_text = self._call_vision_model(case_context, page_images)

        return {
            "statement_text": statement_text,
            "report_text": report_text,
        }
