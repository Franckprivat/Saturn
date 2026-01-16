import axios from 'axios';

// Déterminer l'URL de l'API selon l'environnement
const getApiUrl = () => {
  // Si NEXT_PUBLIC_API_URL est défini, l'utiliser (priorité absolue)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Si on est côté client (browser)
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    const hostname = window.location.hostname;
    
    // Si on est sur le port 80 (nginx) ou pas de port, utiliser /api
    if (!port || port === '80' || port === '443') {
      return '/api';
    }
    
    // Si on est sur localhost avec le port 3000 (dev local sans Docker), utiliser backend direct
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
      return 'http://localhost:3001';
    }
    
    // Par défaut (Docker ou autre), utiliser /api
    // Note: Si vous accédez directement au port 3000 dans Docker, utilisez le port 80 (nginx) à la place
    return '/api';
  }
  
  // Côté serveur (SSR), utiliser l'URL par défaut
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

// Log pour déboguer (uniquement en développement)
if (typeof window !== 'undefined') {
  const port = window.location.port;
  const hostname = window.location.hostname;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Configuration API:', {
      API_URL,
      location: window.location.href,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      port,
      hostname,
    });
  }
  
  // Avertissement si on accède directement au port 3000 dans Docker
  if (port === '3000' && API_URL === '/api') {
    console.warn('⚠️ Vous accédez directement au port 3000. Pour que l\'API fonctionne, accédez via http://localhost (port 80)');
  }
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log des erreurs pour déboguer
    if (process.env.NODE_ENV === 'development') {
      console.error('Erreur API:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  nickname: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    nickname: string;
    createdAt: string;
  };
}

export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  signup: async (data: RegisterDto): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/signup', data);
    return response.data;
  },
};
