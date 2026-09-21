"""Services for generating AI case review reports from vendor statements and optional PDFs."""

from __future__ import annotations

import base64
import os
import re
from typing import Any, Dict

import requests


class AICaseReviewGenerationError(Exception):
    """Raised when AI case review generation fails."""


def _load_pymupdf():
    """Import PyMuPDF lazily so the whole API does not fail at startup."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise AICaseReviewGenerationError(
            "PyMuPDF is not installed on the backend. Install the requirements to use AI case review generation."
        ) from exc
    return fitz



MONTH_NAMES = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April',
    5: 'May', 6: 'June', 7: 'July', 8: 'August',
    9: 'September', 10: 'October', 11: 'November', 12: 'December'
}

MONTH_LOOKUP = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
}


def get_ordinal_suffix(day: int) -> str:
    """Return ordinal day string (e.g. 1st, 2nd, 3rd, 4th, 21st, 22nd)."""
    if 11 <= (day % 100) <= 13:
        return f"{day}th"
    rem = day % 10
    if rem == 1:
        return f"{day}st"
    elif rem == 2:
        return f"{day}nd"
    elif rem == 3:
        return f"{day}rd"
    return f"{day}th"


def format_ordinal_date(date_val: Any, default_year: str = "2026") -> str:
    """Format date / datetime or date string into '4th April 2026'."""
    if not date_val:
        return ""
    if hasattr(date_val, "day") and hasattr(date_val, "month") and hasattr(date_val, "year"):
        d = date_val.day
        m = date_val.month
        y = date_val.year
        return f"{get_ordinal_suffix(d)} {MONTH_NAMES.get(m, '')} {y}"
    return format_all_dates_in_text(str(date_val), default_year=default_year)


def format_all_dates_in_text(text: str, default_year: str = None) -> str:
    """Convert all dates in text into proper format like '4th April 2026'."""
    if not text or not isinstance(text, str):
        return text or ""

    if not default_year:
        m = re.search(r'\b[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-(20\d{2})\b', text)
        if m:
            default_year = m.group(1)
        else:
            m2 = re.search(r'\b(20\d{2})\b', text)
            default_year = m2.group(1) if m2 else "2026"

    # 1. YYYY-MM-DD or YYYY/MM/DD
    def repl_iso(m):
        y, month, d = m.group(1), int(m.group(2)), int(m.group(3))
        if 1 <= month <= 12 and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {y}"
        return m.group(0)

    text = re.sub(r'\b(19\d{2}|20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b', repl_iso, text)

    # 2. DD/MM/YYYY or DD-MM-YYYY (e.g. 04/04/2026, 4/4/2026, 04-04-2026)
    def repl_dmy(m):
        d, month, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= month <= 12 and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {y}"
        return m.group(0)

    text = re.sub(r'\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](19\d{2}|20\d{2})\b', repl_dmy, text)

    # 3. DD-Mon-YYYY or DD Mon YYYY (e.g. 04 Apr 2026, 4th April 2026, 4 April 2026)
    def repl_mon_named(m):
        d = int(m.group(1))
        mon_str = m.group(2).lower()
        y = m.group(3)
        month = MONTH_LOOKUP.get(mon_str)
        if month and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {y}"
        return m.group(0)

    text = re.sub(
        r'\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[\s-]+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,-]+(19\d{2}|20\d{2})\b',
        repl_mon_named,
        text,
        flags=re.IGNORECASE
    )

    # 4. Month DD, YYYY (e.g. April 4, 2026)
    def repl_month_first(m):
        mon_str = m.group(1).lower()
        d = int(m.group(2))
        y = m.group(3)
        month = MONTH_LOOKUP.get(mon_str)
        if month and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {y}"
        return m.group(0)

    text = re.sub(
        r'\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?,?\s+(19\d{2}|20\d{2})\b',
        repl_month_first,
        text,
        flags=re.IGNORECASE
    )

    # 5. Month DD without year (e.g. 4th April or April 4)
    def repl_mon_named_no_year(m):
        d = int(m.group(1))
        mon_str = m.group(2).lower()
        month = MONTH_LOOKUP.get(mon_str)
        if month and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {default_year}"
        return m.group(0)

    text = re.sub(
        r'\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b(?!\s*,?\s+(?:19\d{2}|20\d{2}))',
        repl_mon_named_no_year,
        text,
        flags=re.IGNORECASE
    )

    def repl_month_first_no_year(m):
        mon_str = m.group(1).lower()
        d = int(m.group(2))
        month = MONTH_LOOKUP.get(mon_str)
        if month and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {default_year}"
        return m.group(0)

    text = re.sub(
        r'\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b(?!\s*,?\s+(?:19\d{2}|20\d{2}))',
        repl_month_first_no_year,
        text,
        flags=re.IGNORECASE
    )

    # 6. DD/MM or DD-MM (e.g. 04/04, 03/02, 15/08)
    def repl_dm_partial(m):
        raw = m.group(0)
        if raw == '24/7':
            return raw
        d, month = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12 and 1 <= d <= 31:
            return f"{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {default_year}"
        return raw

    text = re.sub(r'(?<![/\d-])(0[1-9]|[12]\d|3[01])/(0[1-9]|1[0-2])(?![/\d-])', repl_dm_partial, text)
    text = re.sub(r'(?<![/\d-])(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])(?![/\d-])', repl_dm_partial, text)

    # 7. single-digit day preceded by 'on', 'dated', 'dt', 'date' (e.g. 'on 4/4')
    def repl_on_dm(m):
        prefix = m.group(1)
        sep = m.group(2)
        d = int(m.group(3))
        month = int(m.group(4))
        if 1 <= month <= 12 and 1 <= d <= 31:
            return f"{prefix}{sep}{get_ordinal_suffix(d)} {MONTH_NAMES[month]} {default_year}"
        return m.group(0)

    text = re.sub(
        r'\b(on|dated|dt\.?|date:?)\s*([ \t])([1-9])/(0?[1-9]|1[0-2])(?![/\d-])',
        repl_on_dm,
        text,
        flags=re.IGNORECASE
    )

    return text


class AICaseReviewService:
    """Generate concise AI case review reports using Groq and statement context."""

    text_model = "openai/gpt-oss-120b"
    vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"
    api_url = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str | None = None):
        self.api_key = (
            api_key
            or os.environ.get("GROQ_API_KEY", "").strip()
            or os.environ.get("GROK_API_KEY", "").strip()
        )

    def extract_pdf_text(self, pdf_bytes: bytes) -> str:
        """Extract text from a PDF using PyMuPDF. Returns empty string if none found."""
        fitz = _load_pymupdf()
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
        fitz = _load_pymupdf()
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise AICaseReviewGenerationError(f"Invalid PDF file: {exc}") from exc

        images: list[str] = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            images.append(base64.b64encode(img_bytes).decode())

        if not images:
            raise AICaseReviewGenerationError("Could not render any pages from the PDF.")

        return images

    def _build_context_block(self, case_context: Dict[str, Any]) -> str:
        """Build the comprehensive case context block used in prompts.

        Includes all key case details organized by section:
        - Case Information
        - Incident Details
        - Client Information
        - Vendor Information
        - People Involved
        - Investigation Summary
        """
        sections = []

        case_num = case_context.get('case_number') or ''
        case_year = '2026'
        m_year = re.search(r'(?:19|20)\d{2}', str(case_num))
        if m_year:
            case_year = m_year.group(0)

        # Case Information
        receive_date_raw = case_context.get('case_receive_date') or ''
        formatted_receive_date = format_ordinal_date(receive_date_raw, default_year=case_year) if receive_date_raw else 'N/A'
        case_info = [
            f"Case Number: {case_context.get('case_number') or 'N/A'}",
            f"Claim Number: {case_context.get('claim_number') or 'N/A'}",
            f"Investigation Type: {case_context.get('investigation_type') or 'N/A'}",
            f"Category: {case_context.get('category') or 'N/A'}",
            f"Case Receive Date: {formatted_receive_date}",
        ]
        sections.append("=== CASE INFORMATION ===\n" + "\n".join(case_info))

        # Incident Details
        incident_date_raw = case_context.get('incident_date') or ''
        formatted_incident_date = format_all_dates_in_text(str(incident_date_raw), default_year=case_year) if incident_date_raw else 'N/A'
        incident_info = [
            f"Incident Date/Time: {formatted_incident_date}",
            f"Incident Location: {case_context.get('incident_location') or 'N/A'}",
            f"FIR Number: {case_context.get('fir_number') or 'N/A'}",
            f"Incident Brief: {case_context.get('incident_brief') or 'N/A'}",
        ]
        sections.append("=== INCIDENT DETAILS ===\n" + "\n".join(incident_info))

        # Client Information
        client_info = [
            f"Client Name: {case_context.get('client_name') or 'N/A'}",
            f"Policy Number: {case_context.get('policy_number') or 'N/A'}",
        ]
        sections.append("=== CLIENT DETAILS ===\n" + "\n".join(client_info))

        # Vendor Information
        vendor_info = [
            f"Assigned Vendor: {case_context.get('assigned_vendor_name') or 'N/A'}",
        ]
        sections.append("=== VENDOR DETAILS ===\n" + "\n".join(vendor_info))

        # People Involved
        people_info = []
        if case_context.get('insured_name'):
            insured_addr = case_context.get('insured_address') or ''
            people_info.append(f"Insured: {case_context.get('insured_name')}" + (f" ({insured_addr})" if insured_addr else ""))
        if case_context.get('claimant_name'):
            claimant_addr = case_context.get('claimant_address') or ''
            people_info.append(f"Claimant: {case_context.get('claimant_name')}" + (f" ({claimant_addr})" if claimant_addr else ""))
        if case_context.get('driver_name'):
            people_info.append(f"Driver: {case_context.get('driver_name')}")
        if not people_info:
            people_info.append("No party information available")
        sections.append("=== PARTIES INVOLVED ===\n" + "\n".join(people_info))

        # Investigation Summary
        inv_info = [
            f"Investigation Status: {case_context.get('investigation_report_status') or 'N/A'}",
            f"Full Case Status: {case_context.get('full_case_status') or 'N/A'}",
            f"Special Instructions: {case_context.get('special_instructions') or 'N/A'}",
        ]
        sections.append("=== INVESTIGATION SUMMARY ===\n" + "\n".join(inv_info))

        # Statements (if available)
        statements_info = []
        if case_context.get('claimant_statement'):
            st = format_all_dates_in_text(str(case_context['claimant_statement']), default_year=case_year)
            statements_info.append(f"Claimant Statement: {st}")
        if case_context.get('insured_statement'):
            st = format_all_dates_in_text(str(case_context['insured_statement']), default_year=case_year)
            statements_info.append(f"Insured Statement: {st}")
        if case_context.get('driver_statement'):
            st = format_all_dates_in_text(str(case_context['driver_statement']), default_year=case_year)
            statements_info.append(f"Driver Statement: {st}")
        
        if statements_info:
            sections.append("=== AVAILABLE STATEMENTS ===\n" + "\n".join(statements_info))

        # Chargesheet Details (if available)
        if case_context.get('has_chargesheet') or case_context.get('chargesheet_data'):
            cs = case_context.get('chargesheet_data') or {}
            cs_info = []
            if cs.get('court_name'): cs_info.append(f"Court Name: {cs['court_name']}")
            if cs.get('fir_number'): cs_info.append(f"FIR Number: {cs['fir_number']}")
            if cs.get('fir_delay_days') is not None and cs.get('fir_delay_days') != '': cs_info.append(f"FIR Delay: {cs['fir_delay_days']} days")
            if cs.get('mv_act'): cs_info.append(f"Motor Vehicle Act (MV Act): {cs['mv_act']}")
            if cs.get('ipc'): cs_info.append(f"IPC Sections: {cs['ipc']}")
            if cs.get('bsn_section'): cs_info.append(f"BSN Section: {cs['bsn_section']}")
            if cs.get('triggers'): cs_info.append(f"Triggers / Observations: {cs['triggers']}")
            if cs.get('advocate_status'): cs_info.append(f"Advocate Status: {cs['advocate_status']}")
            if cs.get('negative_status'): cs_info.append(f"Negative Status: {cs['negative_status']}")
            if cs.get('statement'): cs_info.append(f"Chargesheet Summary / Remarks: {cs['statement']}")
            if cs_info:
                sections.append("=== CHARGESHEET DETAILS ===\n" + "\n".join(cs_info))

        # Vendor Evidence
        vendor_evidence = case_context.get('vendor_evidence') or []
        if vendor_evidence:
            evidence_info = []
            for ev in vendor_evidence:
                loc = ev.get('location_name') or 'Unknown Location'
                ts = ev.get('captured_at') or ev.get('uploaded_at') or 'Unknown Time'
                ts_formatted = format_all_dates_in_text(str(ts), default_year=case_year) if ts != 'Unknown Time' else ts
                evidence_info.append(f"- Photo at {loc} taken on {ts_formatted}")
            sections.append("=== VENDOR EVIDENCE ===\n" + "\n".join(evidence_info))

        return "\n\n".join(sections)

    _SYSTEM_INSTRUCTION = (
        "You are assisting an insurance incident-management caseManager team. "
        "Read the vendor statements and case context carefully, then produce a concise, structured investigation report. "
        "Do not invent facts. If information is not available or unclear, state that it is not mentioned.\n\n"
        "MANDATORY DATE FORMAT: Every date across the entire report (including Case Receive Date, incident dates, "
        "claimant/insured/driver statements, vendor statements, vendor evidence, and recommendations) MUST be formatted "
        "in proper ordinal format like '4th April 2026' or '3rd February 2026'. Never use raw numeric dates such as "
        "'04/04', '03/02', '2026-04-04', '04/04/2026', or 'DD/MM/YYYY'. If a statement only mentions day and month like "
        "'04/04' or '03/02', infer the year from the case (e.g. 2026) and write '4th April 2026' or '3rd February 2026'.\n\n"
        "Return the response in exactly this structured format with clear section headers:\n\n"
        "CASE INFORMATION\n"
        "- Case Number: [from context]\n"
        "- Claim Number: [from context]\n"
        "- Insured Name: [from context]\n"
        "- Claimant Name: [from context]\n"
        "- Investigation Type: [from context]\n"
        "- Category: [from context]\n"
        "- Case Receive Date: [from context, formatted like 4th April 2026]\n\n"
        "CLAIMANT STATEMENT\n"
        "[If claimant statement is available in case context, include it verbatim here, ensuring any dates like 04/04 are formatted like 4th April 2026. If not available, write 'Not provided in case data']\n\n"
        "INSURED STATEMENT\n"
        "[If insured statement is available in case context, include it verbatim here, ensuring any dates like 03/02 are formatted like 3rd February 2026. If not available, write 'Not provided in case data']\n\n"
        "DRIVER STATEMENT\n"
        "[If driver statement is available in case context, include it verbatim here, ensuring any dates are formatted like 4th April 2026. If not available, write 'Not provided in case data']\n\n"
        "VENDOR STATEMENTS\n"
        "[List all stored vendor statements in sequence exactly as provided, with source/check labels when available, ensuring all dates like 04/04 or 03/02 are formatted like 4th April 2026 or 3rd February 2026. "
        "If none are available, write 'Not provided in case data']\n\n"
        "VENDOR EVIDENCE SUMMARY\n"
        "[List the vendor evidence photos with their location and timestamp based on the case data provided (dates formatted like 4th April 2026). If none are available, write 'Not provided in case data']\n\n"
        "AI SUMMARY\n"
        "[Provide a concise summary in exactly 2-3 sentences that synthesizes:\n"
        "- Key findings from the vendor statements\n"
        "- Consistency or inconsistencies across statements\n"
        "- Main points of interest for the investigation]\n\n"
        "IMPORTANT OBSERVATIONS AND RECOMMENDATIONS\n"
        "[List key observations from the vendor investigation, inconsistencies noted, and recommended next steps for investigation. "
        "Be specific and actionable.]\n\n"
        "VENDOR EVIDENCE\n"
        "[Note: Vendor evidence photos will be displayed separately at the end of the report.]"
    )

    def build_prompt(self, case_context: Dict[str, Any], statement_text: str) -> str:
        """Build a concise structured prompt for the AI model."""
        return (
            f"{self._SYSTEM_INSTRUCTION}\n\n"
            f"Case Context:\n{self._build_context_block(case_context)}\n\n"
            f"Vendor Statements Text:\n{statement_text[:18000]}"
        )

    def generate_report_from_statement_text(
        self,
        case_context: Dict[str, Any],
        statement_text: str,
    ) -> Dict[str, str]:
        """Generate a structured AI case review report from stored vendor statements."""
        if not self.api_key:
            raise AICaseReviewGenerationError("GROQ_API_KEY is not configured on the backend.")

        case_num = case_context.get("case_number") or ""
        case_year = "2026"
        m_year = re.search(r'(?:19|20)\d{2}', str(case_num))
        if m_year:
            case_year = m_year.group(0)

        normalized_text = (statement_text or "").strip()
        formatted_statements = format_all_dates_in_text(normalized_text, default_year=case_year)

        has_spot_check = case_context.get("has_spot_check", False)
        has_chargesheet = case_context.get("has_chargesheet", False)
        has_rti_check = case_context.get("has_rti_check", False)
        has_rto_check = case_context.get("has_rto_check", False)
        has_non_statement_check = has_spot_check or has_chargesheet or has_rti_check or has_rto_check

        if not formatted_statements and not has_non_statement_check:
            raise AICaseReviewGenerationError("No vendor statements were provided for report generation.")

        prompt = self.build_prompt(case_context, formatted_statements)
        report_text = self._call_text_model(prompt)
        report_text = format_all_dates_in_text(report_text, default_year=case_year)
        return {
            "statement_text": formatted_statements,
            "report_text": report_text,
        }

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
                "max_tokens": 1500,
            },
            timeout=60,
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
                "max_tokens": 1500,
            },
            timeout=90,
        )
        return self._parse_response(response)

    def _parse_response(self, response: requests.Response) -> str:
        """Parse the Groq API response and return the report text."""
        if response.status_code >= 400:
            raise AICaseReviewGenerationError(
                f"Groq request failed with status {response.status_code}: {response.text[:500]}"
            )

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise AICaseReviewGenerationError("Groq returned no choices.")

        report_text = choices[0].get("message", {}).get("content", "").strip()
        if not report_text:
            raise AICaseReviewGenerationError("Groq returned an empty report.")

        return self._strip_markdown(report_text)

    @staticmethod
    def _strip_markdown(text: str) -> str:
        """Strip markdown formatting from AI-generated text for clean plain-text display."""
        # Remove bold/italic markers: **text** -> text, *text* -> text
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        # Remove heading markers: ### Heading -> Heading
        text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
        return text

    def generate_report(self, case_context: Dict[str, Any], pdf_bytes: bytes) -> Dict[str, str]:
        """Generate a structured AI case review report from case context and PDF."""
        if not self.api_key:
            raise AICaseReviewGenerationError("GROQ_API_KEY is not configured on the backend.")

        case_num = case_context.get("case_number") or ""
        case_year = "2026"
        m_year = re.search(r'(?:19|20)\d{2}', str(case_num))
        if m_year:
            case_year = m_year.group(0)

        # Try text extraction first (fast path)
        statement_text = self.extract_pdf_text(pdf_bytes)

        if statement_text:
            # Text-based PDF — use the text model
            formatted_statement_text = format_all_dates_in_text(statement_text, default_year=case_year)
            prompt = self.build_prompt(case_context, formatted_statement_text)
            report_text = self._call_text_model(prompt)
        else:
            # Vector/image-based PDF — fall back to vision model
            page_images = self.pdf_pages_to_base64_images(pdf_bytes)
            formatted_statement_text = "(extracted via vision model from PDF images)"
            report_text = self._call_vision_model(case_context, page_images)

        report_text = format_all_dates_in_text(report_text, default_year=case_year)

        return {
            "statement_text": formatted_statement_text,
            "report_text": report_text,
        }
