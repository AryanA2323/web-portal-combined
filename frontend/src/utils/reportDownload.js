export const sanitizeFileName = (value, fallback = 'report') => {
  const normalized = String(value || fallback || 'report')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .toLowerCase();

  return normalized || fallback;
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const buildMetadataMarkup = (metadata = []) => metadata
  .filter((item) => item?.label)
  .map((item) => (
    `<div class="meta-row"><span class="meta-label">${escapeHtml(item.label)}:</span> ${escapeHtml(item.value || '-')}</div>`
  ))
  .join('');

const buildEvidenceMarkup = (evidenceItems = []) => {
  if (!evidenceItems.length) return '';

  const cards = evidenceItems.map((item, index) => {
    const title = item?.title || `Evidence ${index + 1}`;
    const caption = item?.caption ? `<div class="evidence-caption">${escapeHtml(item.caption)}</div>` : '';
    const image = item?.imageDataUrl
      ? `<img src="${item.imageDataUrl}" alt="${escapeHtml(title)}" class="evidence-image" />`
      : '';

    return `
      <div class="evidence-card">
        <div class="evidence-title">${escapeHtml(title)}</div>
        ${image}
        ${caption}
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <div class="section-title">Evidence</div>
      <div class="evidence-grid">${cards}</div>
    </div>
  `;
};

const buildWordDocumentHtml = ({
  title,
  metadata = [],
  contentTitle,
  content,
  evidenceItems = [],
}) => `
  <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body {
          font-family: Calibri, Arial, sans-serif;
          color: #1f2937;
          margin: 32px;
          line-height: 1.5;
        }
        h1 {
          margin: 0 0 16px;
          font-size: 24px;
          color: #1e3a8a;
        }
        .meta-block {
          margin-bottom: 20px;
          padding: 12px 14px;
          border: 1px solid #dbeafe;
          background: #eff6ff;
        }
        .meta-row {
          margin: 0 0 6px;
          font-size: 13px;
        }
        .meta-label {
          font-weight: 700;
        }
        .section {
          margin-top: 18px;
        }
        .section-title {
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .report-content {
          white-space: pre-wrap;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          padding: 14px;
        }
        .evidence-grid {
          display: block;
        }
        .evidence-card {
          margin-bottom: 18px;
          page-break-inside: avoid;
          border: 1px solid #e5e7eb;
          padding: 12px;
        }
        .evidence-title {
          font-weight: 700;
          margin-bottom: 8px;
        }
        .evidence-image {
          max-width: 100%;
          height: auto;
          display: block;
          margin-bottom: 8px;
        }
        .evidence-caption {
          color: #4b5563;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta-block">${buildMetadataMarkup(metadata)}</div>
      <div class="section">
        <div class="section-title">${escapeHtml(contentTitle)}</div>
        <div class="report-content">${escapeHtml(content || '')}</div>
      </div>
      ${buildEvidenceMarkup(evidenceItems)}
    </body>
  </html>
`;

export const downloadWordDocument = ({
  fileName,
  title,
  metadata = [],
  contentTitle = 'Report Content',
  content = '',
  evidenceItems = [],
}) => {
  const html = buildWordDocumentHtml({
    title,
    metadata,
    contentTitle,
    content,
    evidenceItems,
  });

  const blob = new Blob([`\ufeff${html}`], {
    type: 'application/msword',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.doc') ? fileName : `${fileName}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
