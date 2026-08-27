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

export const resolveEvidencePhotoUrl = (photoUrl) => {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('data:')) return photoUrl;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;

  // Strip leading /media/ or media/ to get the clean path
  const mediaPath = photoUrl.startsWith('/media/') ? photoUrl.slice(7) : photoUrl.startsWith('media/') ? photoUrl.slice(6) : photoUrl.replace(/^\/+/, '');

  return `${getApiBase()}/media/${mediaPath}`;
};
