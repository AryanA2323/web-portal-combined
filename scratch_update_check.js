const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/case_manager/CheckDetailPage.jsx', 'utf8');

if (!content.includes('MediaPreviewModal')) {
  content = content.replace(
    'import CaseManagerLayout from \'./components/CaseManagerLayout\';',
    'import CaseManagerLayout from \'./components/CaseManagerLayout\';\nimport MediaPreviewModal from \'./components/MediaPreviewModal\';'
  );
}

content = content.replace(
  'const [activePhoto, setActivePhoto] = useState(null);',
  'const [activeMediaPreview, setActiveMediaPreview] = useState(null);'
);

content = content.replace(
  /onClick=\{\(\) => setActivePhoto\(photoUrl\)\}/g,
  'onClick={() => setActiveMediaPreview({ url: photoUrl, type: \'photo\' })}'
);

content = content.replace(
  /href=\{docUrl\}\s*target=\"_blank\"\s*rel=\"noopener noreferrer\"/g,
  'onClick={(e) => { e.preventDefault(); setActiveMediaPreview({ url: docUrl, type: \'document\', title: doc.filename }); }} href=\"#\"'
);

// Remove existing Dialog
const dialogStart = content.indexOf('{/* ─── LIGHTBOX PHOTO PREVIEW DIALOG');
if (dialogStart !== -1) {
  const dialogEnd = content.indexOf('</Dialog>', dialogStart) + '</Dialog>'.length;
  content = content.substring(0, dialogStart) + content.substring(dialogEnd);
}

// Add MediaPreviewModal at the end
if (!content.includes('<MediaPreviewModal open=')) {
  content = content.replace(
    '</CaseManagerLayout>',
    '  <MediaPreviewModal open={Boolean(activeMediaPreview)} onClose={() => setActiveMediaPreview(null)} media={activeMediaPreview} />\n    </CaseManagerLayout>'
  );
}

fs.writeFileSync('frontend/src/pages/case_manager/CheckDetailPage.jsx', content);
