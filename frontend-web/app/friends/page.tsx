'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

type FriendUser = {
  id: string;
  email: string;
  nickname: string;
};

type FriendRequest = {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  requester: FriendUser;
  addressee: FriendUser;
};

type Tab = 'friends' | 'requests' | 'discover';

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function FriendsPage() {
  const router = useRouter();
  const { user, isAuthenticated, init } = useAuthStore();
  const [tab, setTab] = useState<Tab>('friends');

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);

  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    setError('');
    try {
      const res = await api.get('/friends');
      setFriends(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || 'Erreur lors du chargement des amis',
      );
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    setError('');
    try {
      const res = await api.get('/friends/requests');
      setRequests(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Erreur lors du chargement des demandes',
      );
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) return;
    fetchFriends();
    fetchRequests();
  }, [isAuthenticated]);

  const handleSearch = async () => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    setError('');
    try {
      const res = await api.get('/friends/search', { params: { q: search } });
      setSearchResults(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Erreur lors de la recherche d’utilisateurs',
      );
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    setError('');
    try {
      await api.post('/friends/requests', { addresseeId: userId });
      await fetchRequests();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Erreur lors de l’envoi de la demande',
      );
    }
  };

  const handleRespondRequest = async (id: string, accept: boolean) => {
    setError('');
    try {
      const url = accept
        ? `/friends/requests/${id}/accept`
        : `/friends/requests/${id}/decline`;
      await api.post(url);
      await fetchFriends();
      await fetchRequests();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Erreur lors du traitement de la demande',
      );
    }
  };

  const handleOpenDm = async (targetUserId: string) => {
    setError('');
    try {
      const res = await api.post('/conversations/dm', { userId: targetUserId });
      const conversationId = res.data.id;
      router.push(`/chat?conversationId=${conversationId}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Erreur lors de l’ouverture de la conversation',
      );
    }
  };

  const isIncoming = (req: FriendRequest) => req.addressee.id === user?.id;

  return (
    <div className="flex w-full h-full bg-[#0F0F14] text-white">
      <aside className="w-64 border-r border-black/60 bg-[#181820] flex flex-col">
        <div className="px-4 py-3 border-b border-black/60">
          <h1 className="text-sm font-semibold">Amis</h1>
        </div>

        <div className="px-3 pt-3 flex flex-col gap-2 text-xs">
          <button
            className={classNames(
              'w-full text-left px-2 py-1.5 rounded-md',
              tab === 'friends' ? 'bg-white/10 text-white' : 'text-[#B6B6B6] hover:bg-white/5',
            )}
            onClick={() => setTab('friends')}
          >
            Tous les amis
          </button>
          <button
            className={classNames(
              'w-full text-left px-2 py-1.5 rounded-md',
              tab === 'requests' ? 'bg:white/10 text-white' : 'text-[#B6B6B6] hover:bg-white/5',
            )}
            onClick={() => setTab('requests')}
          >
            Demandes d&apos;amis
          </button>
          <button
            className={classNames(
              'w-full text-left px-2 py-1.5 rounded-md',
              tab === 'discover' ? 'bg-white/10 text:white' : 'text-[#B6B6B6] hover:bg-white/5',
            )}
            onClick={() => setTab('discover')}
          >
            Ajouter un ami
          </button>
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-[#0F0F14]">
        <div className="px-4 py-3 border-b border-black/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {tab === 'friends'
                ? 'Tous les amis'
                : tab === 'requests'
                ? 'Demandes d’amis'
                : 'Ajouter un ami'}
            </h2>
            <p className="text-[11px] text-[#B6B6B6]">
              Gérez vos contacts et démarrez des discussions privées.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 text-[11px] text-[#B6B6B6]">
              <span className="font-semibold">{user.nickname}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 pt-3">
            <div className="bg-[#CF11BC]/10 border border-[#CF11BC]/40 text-[#CF11BC] px-3 py-2 rounded-md text-xs">
              {error}
            </div>
          </div>
        )}

        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-3 text-sm">
          {tab === 'friends' && (
            <div className="space-y-2">
              {loadingFriends && (
                <div className="text-xs text-[#B6B6B6]">
                  Chargement de vos amis...
                </div>
              )}
              {!loadingFriends && friends.length === 0 && (
                <div className="text-xs text-[#B6B6B6]">
                  Vous n&apos;avez pas encore d&apos;amis. Utilisez &quot;Ajouter un ami&quot;.
                </div>
              )}

              {friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-black/60 rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-[11px] font-bold">
                      {f.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{f.nickname}</p>
                      <p className="text-[11px] text-[#B6B6B6]">{f.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenDm(f.id)}
                    className="px-3 py-1 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-[11px] font-semibold"
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-2">
              {loadingRequests && (
                <div className="text-xs text-[#B6B6B6]">
                  Chargement des demandes d&apos;amis...
                </div>
              )}
              {!loadingRequests && requests.length === 0 && (
                <div className="text-xs text-[#B6B6B6]">
                  Aucune demande d&apos;ami pour le moment.
                </div>
              )}

              {requests.map((r) => {
                const incoming = isIncoming(r);
                const other = incoming ? r.requester : r.addressee;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg:white/5 hover:bg:white/10 border border-black/60 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-[11px] font-bold">
                        {other.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{other.nickname}</p>
                        <p className="text-[11px] text-[#B6B6B6]">{other.email}</p>
                        <p className="text-[10px] text-[#B6B6B6]/80 mt-0.5">
                          {incoming ? 'Demande reçue' : 'Demande envoyée'}
                        </p>
                      </div>
                    </div>
                    {incoming && r.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespondRequest(r.id, true)}
                          className="px-3 py-1 rounded-md bg-[#1DB954] hover:bg-[#1AA34A] text-[11px] font-semibold"
                        >
                          Accepter
                        </button>
                        <button
                          onClick={() => handleRespondRequest(r.id, false)}
                          className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-[11px] font-semibold"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'discover' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par pseudo ou email..."
                  className="flex-1 px-3 py-2 rounded-md bg-black/40 border border-white/10 text-xs placeholder-[#B6B6B6]/60 focus:outline-none focus:ring-2 focus:ring-[#A016D9]"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-[11px] font-semibold"
                >
                  Rechercher
                </button>
              </div>

              {loadingSearch && (
                <div className="text-xs text-[#B6B6B6]">
                  Recherche en cours...
                </div>
              )}

              {!loadingSearch && searchResults.length === 0 && search.trim() && (
                <div className="text-xs text-[#B6B6B6]">
                  Aucun utilisateur trouvé pour cette recherche.
                </div>
              )}

              <div className="space-y-2">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg:white/5 hover:bg:white/10 border border-black/60 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-[11px] font-bold">
                        {u.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{u.nickname}</p>
                        <p className="text-[11px] text-[#B6B6B6]">{u.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendRequest(u.id)}
                      className="px-3 py-1 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-[11px] font-semibold"
                    >
                      Ajouter
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

