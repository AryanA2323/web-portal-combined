const AUTH_KEYS = ['accessToken', 'refreshToken', 'user'];

export const authStorage = {
  getItem(key) {
    return sessionStorage.getItem(key);
  },

  setItem(key, value) {
    sessionStorage.setItem(key, value);
    if (AUTH_KEYS.includes(key)) {
      localStorage.removeItem(key);
    }
  },

  removeItem(key) {
    sessionStorage.removeItem(key);
    if (AUTH_KEYS.includes(key)) {
      localStorage.removeItem(key);
    }
  },

  clearAuth() {
    AUTH_KEYS.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  },
};
