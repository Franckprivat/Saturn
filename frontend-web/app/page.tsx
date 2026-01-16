'use client';

import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

export default function Home() {
  const { user, token, logout, isAuthenticated, init } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  const fetchProfile = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users/me');
      setProfile(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la récupération du profil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated()) {
      fetchProfile();
    }
  }, [token]);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Test Auth</h1>
      
      {!isAuthenticated() ? (
        <div>
          <p>Vous n'êtes pas connecté.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <a href="/login" style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
              Login
            </a>
            <a href="/signup" style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
              Signup
            </a>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
            <h2>Utilisateur connecté</h2>
            <pre style={{ background: 'white', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(user, null, 2)}
            </pre>
            <button 
              onClick={logout} 
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#ff0000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Déconnexion
            </button>
          </div>

          <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
            <h2>Test route protégée (/users/me)</h2>
            <button 
              onClick={fetchProfile}
              disabled={loading}
              style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem' }}
            >
              {loading ? 'Chargement...' : 'Récupérer le profil'}
            </button>
            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
            {profile && (
              <pre style={{ background: 'white', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
                {JSON.stringify(profile, null, 2)}
              </pre>
            )}
        </div>
        </div>
      )}
    </div>
  );
}
