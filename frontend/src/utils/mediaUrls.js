const getApiBase = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  try {
    const url = new URL(apiBaseUrl, window.location.origin).href.replace(/\/+$/, '');
    return url.endsWith('/api') ? url : url + '/api';
  } catch {
    return window.location.origin + '/api';
  }
};

export const getEvidencePhotoUrl = (photo) => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.preview_url || photo.url || photo.photo_url || '';
};

export const resolveEvidencePhotoUrl = (rawUrl) => {
  if (!rawUrl) return '';
  
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const cleanBase = baseUrl.endsWith('/api') ? baseUrl : baseUrl.replace(/\/+$/, '') + '/api';

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    if (rawUrl.includes('api.claimverify.shovelsolutions.in')) {
      let fixedUrl = rawUrl.replace('http://', 'https://');
      fixedUrl = fixedUrl.replace('/api/media/api/media/', '/api/media/');
      return fixedUrl;
    }
    return rawUrl;
  }
  
  if (rawUrl.startsWith('data:')) return rawUrl;

  let mediaPath = rawUrl.replace(/^\/+/, '');
  if (mediaPath.startsWith('api/media/')) {
    mediaPath = mediaPath.slice(10);
  } else if (mediaPath.startsWith('media/')) {
    mediaPath = mediaPath.slice(6);
  }
  mediaPath = mediaPath.replace(/^\/+/, '');

  try {
    return `${cleanBase}/media/${mediaPath}`;
  } catch (e) {
    return rawUrl;
  }
};
