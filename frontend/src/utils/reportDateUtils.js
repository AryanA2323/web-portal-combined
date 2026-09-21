/**
 * Utility functions for formatting dates in AI-generated reports and report reviews.
 * Formats dates into proper ordinal format: e.g. "4th April 2026", "3rd February 2026".
 */

export const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_LOOKUP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Returns ordinal suffix for a day number (e.g. 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th").
 */
export const getOrdinalSuffix = (day) => {
  const num = parseInt(day, 10);
  if (Number.isNaN(num)) return String(day || '');
  if (num % 100 >= 11 && num % 100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
};

/**
 * Format a Date object, ISO string, or timestamp into "4th April 2026" (or "4th April 2026, 02:30 PM" if includeTime).
 */
export const formatOrdinalDate = (dateInput, includeTime = false) => {
  if (!dateInput) return '-';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);

  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth() + 1];
  const year = date.getFullYear();

  let formatted = `${getOrdinalSuffix(day)} ${month} ${year}`;
  if (includeTime) {
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    formatted += `, ${timeStr}`;
  }

  return formatted;
};

/**
 * Parses and formats all dates inside arbitrary report text into proper ordinal format like "4th April 2026".
 * Handles:
 * - ISO dates (2026-04-04, 2026-09-08)
 * - Numeric dates (04/04/2026, 04-04-2026, 4/4/2026)
 * - Named dates (4 April 2026, April 4, 2026, 04-Apr-2026)
 * - Partial statement dates without year (On 04/04, On 03/02, 15/08) -> infers year from case context
 */
export const formatReportDates = (text, fallbackYear = null) => {
  if (!text || typeof text !== 'string') return text || '';

  let defaultYear = fallbackYear;
  if (!defaultYear) {
    const m = text.match(/\b[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-(20\d{2})\b/);
    if (m) {
      defaultYear = m[1];
    } else {
      const m2 = text.match(/\b(20\d{2})\b/);
      defaultYear = m2 ? m2[1] : '2026';
    }
  }

  let formattedText = text;

  // 1. YYYY-MM-DD or YYYY/MM/DD
  formattedText = formattedText.replace(
    /\b(19\d{2}|20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g,
    (_, y, m, d) => {
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${y}`;
    }
  );

  // 2. DD/MM/YYYY or DD-MM-YYYY
  formattedText = formattedText.replace(
    /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](19\d{2}|20\d{2})\b/g,
    (_, d, m, y) => {
      const month = parseInt(m, 10);
      const day = parseInt(d, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${y}`;
    }
  );

  // 3. DD-Mon-YYYY or DD Mon YYYY
  formattedText = formattedText.replace(
    /\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[\s-]+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,-]+(19\d{2}|20\d{2})\b/gi,
    (match, d, monStr, y) => {
      const month = MONTH_LOOKUP[monStr.toLowerCase()];
      if (!month) return match;
      const day = parseInt(d, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${y}`;
    }
  );

  // 4. Month DD, YYYY
  formattedText = formattedText.replace(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?,?\s+(19\d{2}|20\d{2})\b/gi,
    (match, monStr, d, y) => {
      const month = MONTH_LOOKUP[monStr.toLowerCase()];
      if (!month) return match;
      const day = parseInt(d, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${y}`;
    }
  );

  // 5. Month DD without year
  formattedText = formattedText.replace(
    /\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b(?!\s*,?\s+(?:19\d{2}|20\d{2}))/gi,
    (match, d, monStr) => {
      const month = MONTH_LOOKUP[monStr.toLowerCase()];
      if (!month) return match;
      const day = parseInt(d, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${defaultYear}`;
    }
  );

  formattedText = formattedText.replace(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b(?!\s*,?\s+(?:19\d{2}|20\d{2}))/gi,
    (match, monStr, d) => {
      const month = MONTH_LOOKUP[monStr.toLowerCase()];
      if (!month) return match;
      const day = parseInt(d, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${defaultYear}`;
    }
  );

  // 6. DD/MM or DD-MM (e.g. 04/04, 03/02, 15/08)
  formattedText = formattedText.replace(
    /(?<![/\d-])(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])(?![/\d-])/g,
    (match, d, m) => {
      if (match === '24/7') return match;
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${defaultYear}`;
    }
  );
  formattedText = formattedText.replace(
    /(?<![/\d-])(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])(?![/\d-])/g,
    (match, d, m) => {
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      return `${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${defaultYear}`;
    }
  );

  // 7. single-digit day preceded by 'on', 'dated', 'dt', 'date' (e.g. 'on 4/4')
  formattedText = formattedText.replace(
    /\b(on|dated|dt\.?|date:?)\s*([ \t])([1-9])\/(0?[1-9]|1[0-2])(?![/\d-])/gi,
    (match, prefix, sep, d, m) => {
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      return `${prefix}${sep}${getOrdinalSuffix(day)} ${MONTH_NAMES[month]} ${defaultYear}`;
    }
  );

  return formattedText;
};

export default {
  MONTH_NAMES,
  MONTH_LOOKUP,
  getOrdinalSuffix,
  formatOrdinalDate,
  formatReportDates,
};
