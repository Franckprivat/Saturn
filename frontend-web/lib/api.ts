import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Quand on envoie un FormData, laisser le navigateur générer le Content-Type
// avec le boundary correct (multipart/form-data; boundary=...).
// Forcer le header manuellement sans boundary fait échouer multer côté serveur.
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)['Content-Type'];
  }
  return config;
});

const PUBLIC_PAGES = ['/', '/login', '/signup', '/forgot-password', '/reset-password'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Session expirée : retour à la page d'accueil (sauf si on y est déjà,
    // ou sur une page de connexion)
    if (error.response?.status === 401 && !PUBLIC_PAGES.includes(window.location.pathname)) {
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);
