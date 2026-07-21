const getApiOrigin = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  try {
    return new URL(apiBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
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

  const path = photoUrl.startsWith('/media/')
    ? photoUrl
    : photoUrl.startsWith('media/')
      ? `/${photoUrl}`
      : `/media/${photoUrl.replace(/^\/+/, '')}`;

  return `${getApiOrigin()}${path}`;
};
