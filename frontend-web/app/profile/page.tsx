'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, init, logout } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated()) return;
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/users/me');
        setProfile(response.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Erreur lors de la récupération du profil',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-[#0F0F14] text-white flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md bg-[#0F0F14]/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            Profil utilisateur
          </h1>
          <p className="text-[#B6B6B6] text-sm">
            Gérez vos informations et votre identité sur Saturn.
          </p>
        </div>

        {error && (
          <div className="bg-[#CF11BC]/10 border border-[#CF11BC]/40 text-[#CF11BC] px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 text-sm">
          <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-[#B6B6B6] text-xs uppercase tracking-wide">Nom complet</p>
            <p className="text-white font-semibold">
              {profile
                ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || '—'
                : user
                ? `${user.firstName} ${user.lastName}`.trim()
                : '—'}
            </p>
          </div>

          <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-[#B6B6B6] text-xs uppercase tracking-wide">Pseudo</p>
            <p className="text-white font-semibold">
              {profile?.nickname || user?.nickname || '—'}
            </p>
          </div>

          <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-[#B6B6B6] text-xs uppercase tracking-wide">Email</p>
            <p className="text-white font-semibold">
              {profile?.email || user?.email || '—'}
            </p>
          </div>

          <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-[#B6B6B6] text-xs uppercase tracking-wide">Inscrit depuis</p>
            <p className="text-white font-semibold">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleString('fr-FR')
                : user?.createdAt
                ? new Date(user.createdAt).toLocaleString('fr-FR')
                : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a
            href="/chat"
            className="text-sm text-[#CF11BC] hover:underline font-semibold transition-colors"
          >
            Revenir au chat
          </a>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold shadow-lg shadow-red-600/40 transition"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

