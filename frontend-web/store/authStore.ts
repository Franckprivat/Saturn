import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  nickname: string;
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  init: () => void;
}

// Fonction pour initialiser depuis localStorage
const getStoredAuth = () => {
  if (typeof window === 'undefined') return { token: null, user: null };
  
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  return { token, user };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  
  init: () => {
    const { token, user } = getStoredAuth();
    set({ token, user });
  },
  
  setAuth: (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
  
  isAuthenticated: () => {
    return !!get().token;
  },
}));
