const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/case_manager/CasesPage.jsx', 'utf8');

if (!content.includes('MediaPreviewModal')) {
  content = content.replace(
    'import CaseLogsDrawer from \'./components/CaseLogsDrawer\';',
    'import CaseLogsDrawer from \'./components/CaseLogsDrawer\';\nimport MediaPreviewModal from \'./components/MediaPreviewModal\';'
  );
}

content = content.replace(
  'const [activePhotoPreview, setActivePhotoPreview] = useState(null);',
  'const [activeMediaPreview, setActiveMediaPreview] = useState(null);'
);

content = content.replace(/setActivePhotoPreview\((.*?)\)/g, 'setActiveMediaPreview({ url: $1, type: \'photo\' })');

content = content.replace(
  /window\.open\(resolveMediaUrl\(doc\.url \|\| doc\.preview_url \|\| doc\.file_url\), '_blank'\)/g,
  'setActiveMediaPreview({ url: resolveMediaUrl(doc.url || doc.preview_url || doc.file_url), type: \'document\', title: doc.filename })'
);

content = content.replace(
  /href=\{resolveMediaUrl\(pUrl\)\}\s+target=\"_blank\"\s+rel=\"noopener noreferrer\"/g,
  'onClick={(e) => { e.preventDefault(); setActiveMediaPreview({ url: resolveMediaUrl(pUrl), type: \'document\' }); }} href=\"#\"'
);

if (!content.includes('<MediaPreviewModal')) {
  content = content.replace(
    '{/* Snackbar for Notifications */}',
    '<MediaPreviewModal open={Boolean(activeMediaPreview)} onClose={() => setActiveMediaPreview(null)} media={activeMediaPreview} />\n\n        {/* Snackbar for Notifications */}'
  );
}

fs.writeFileSync('frontend/src/pages/case_manager/CasesPage.jsx', content);
