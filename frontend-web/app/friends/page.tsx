'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';

type FriendUser = { id: string; nickname: string; image?: string | null; avatarColor?: string | null; bio?: string | null };
type FriendRequest = {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  requester: FriendUser;
  addressee: FriendUser;
};
type Tab = 'friends' | 'requests' | 'discover';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function UserCard({ user, right, sub }: { user: FriendUser; right: React.ReactNode; sub?: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3 transition"
      style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-surface)')}
    >
      <div className="flex items-center gap-3">
        <Avatar user={user} size="md" className="w-11 h-11 rounded-2xl" />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--sat-text)' }}>{user.nickname || '—'}</p>
          {user.bio
            ? <p className="text-xs truncate max-w-[180px]" style={{ color: 'var(--sat-muted)' }}>{user.bio}</p>
            : sub && <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>{sub}</p>
          }
        </div>
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    authClient.getSession().then(({ data }) => { if (data?.user) setCurrentUser(data.user); });
    fetchFriends();
    fetchRequests();
  }, []);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    try { const res = await api.get('/friends'); setFriends(res.data); }
    catch (err: any) { setError(err?.response?.data?.message || 'Erreur'); }
    finally { setLoadingFriends(false); }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try { const res = await api.get('/friends/requests'); setRequests(res.data); }
    catch (err: any) { setError(err?.response?.data?.message || 'Erreur'); }
    finally { setLoadingRequests(false); }
  };

  const handleSearch = async () => {
    if (!search.trim()) return setSearchResults([]);
    setLoadingSearch(true);
    try { const res = await api.get('/friends/search', { params: { q: search } }); setSearchResults(res.data); }
    catch (err: any) { setError(err?.response?.data?.message || 'Erreur'); }
    finally { setLoadingSearch(false); }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.post('/friends/requests', { addresseeId: userId });
      setSentRequests((prev) => new Set([...prev, userId]));
      await fetchRequests();
    } catch (err: any) { setError(err?.response?.data?.message || 'Erreur'); }
  };

  const handleRespond = async (id: string, accept: boolean) => {
    try {
      await api.post(`/friends/requests/${id}/${accept ? 'accept' : 'decline'}`);
      await fetchFriends();
      await fetchRequests();
    } catch (err: any) { setError(err?.response?.data?.message || 'Erreur'); }
  };

  const handleOpenDm = async (userId: string) => {
    try {
      const res = await api.post('/conversations/dm', { userId });
      router.push(`/chat?conversationId=${res.data.id}`);
    } catch (err: any) { setError(err?.response?.data?.message || 'Erreur'); }
  };

  const isIncoming = (r: FriendRequest) => r.addressee.id === currentUser?.id;
  const pendingCount = requests.filter((r) => r.status === 'PENDING' && isIncoming(r)).length;

  const alreadyLinked = (userId: string) =>
    sentRequests.has(userId) ||
    requests.some((r) =>
      (r.requester.id === currentUser?.id && r.addressee.id === userId) ||
      (r.addressee.id === currentUser?.id && r.requester.id === userId),
    );

  return (
    <div className="flex w-full h-full" style={{ background: 'var(--sat-main)', color: 'var(--sat-text)' }}>

      {/* Sidebar */}
      <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: 'var(--sat-panel)', borderRight: '1px solid var(--sat-border)' }}>
        <div className="px-4 h-12 flex items-center" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <h1 className="text-[15px] font-bold">Amis</h1>
        </div>
        <nav className="px-2 pt-3 flex flex-col gap-0.5 text-[13px]">
          {([
            ['friends', 'Tous les amis'],
            ['requests', 'Demandes'],
            ['discover', 'Ajouter un ami'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="w-full text-left px-3 py-2 rounded-md transition flex items-center justify-between font-medium"
              style={{
                background: tab === key ? 'var(--sat-active)' : 'transparent',
                color: tab === key ? 'var(--sat-text)' : 'var(--sat-muted)',
              }}
              onMouseEnter={(e) => { if (tab !== key) { e.currentTarget.style.background = 'var(--sat-hover)'; e.currentTarget.style.color = 'var(--sat-text)'; } }}
              onMouseLeave={(e) => { if (tab !== key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sat-muted)'; } }}>
              {label}
              {key === 'requests' && pendingCount > 0 && (
                <span className="inline-flex min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black items-center justify-center text-white" style={{ background: 'var(--sat-dnd)' }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenu */}
      <section className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 h-12 flex flex-col justify-center" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <h2 className="text-[15px] font-bold leading-tight">
            {tab === 'friends' ? 'Tous les amis' : tab === 'requests' ? "Demandes d'amis" : 'Ajouter un ami'}
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--sat-faint)' }}>
            {tab === 'friends' ? `${friends.length} ami${friends.length !== 1 ? 's' : ''}` :
             tab === 'requests' ? `${pendingCount} demande${pendingCount !== 1 ? 's' : ''} en attente` :
             'Recherche par pseudo'}
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-3 flex gap-2 bg-red-50 border border-red-200 text-[#EF4444] px-4 py-2.5 rounded-xl text-xs">
            ⚠ {error}
          </div>
        )}

        <div className="flex-1 px-6 py-4 overflow-y-auto space-y-2">

          {/* ── Amis ── */}
          {tab === 'friends' && (
            <>
              {loadingFriends && <div className="flex justify-center py-10"><Spinner size={20} /></div>}
              {!loadingFriends && friends.length === 0 && (
                <div className="text-center py-16 space-y-2">
                  <p className="text-3xl opacity-30">👥</p>
                  <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>Aucun ami pour le moment.<br />Utilise "Ajouter un ami" pour en trouver.</p>
                </div>
              )}
              {friends.map((f) => (
                <UserCard key={f.id} user={f}
                  right={
                    <button onClick={() => handleOpenDm(f.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#60A5FA] text-white text-xs font-semibold transition">
                      Message
                    </button>
                  }
                />
              ))}
            </>
          )}

          {/* ── Demandes ── */}
          {tab === 'requests' && (
            <>
              {loadingRequests && <div className="flex justify-center py-10"><Spinner size={20} /></div>}
              {!loadingRequests && requests.length === 0 && (
                <div className="text-center py-16 space-y-2">
                  <p className="text-3xl opacity-30">📬</p>
                  <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>Aucune demande en attente.</p>
                </div>
              )}
              {requests.map((r) => {
                const incoming = isIncoming(r);
                const other = incoming ? r.requester : r.addressee;
                return (
                  <UserCard key={r.id} user={other}
                    sub={incoming ? 'Demande reçue' : 'Demande envoyée'}
                    right={
                      incoming && r.status === 'PENDING' ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleRespond(r.id, true)}
                            className="px-3 py-1.5 rounded-xl bg-green-600/80 hover:bg-green-500 text-xs font-semibold transition">
                            Accepter
                          </button>
                          <button onClick={() => handleRespond(r.id, false)}
                            className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-red-50 hover:text-[#EF4444] text-[#64748B] text-xs font-semibold transition">
                            Refuser
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#94A3B8] italic">
                          {r.status === 'PENDING' ? 'En attente...' : 'Acceptée'}
                        </span>
                      )
                    }
                  />
                );
              })}
            </>
          )}

          {/* ── Découvrir ── */}
          {tab === 'discover' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Rechercher par pseudo..."
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition"
                  style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }}
                />
                <button onClick={handleSearch}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold transition text-white"
                  style={{ background: 'var(--sat-accent)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-accent2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-accent)')}>
                  Rechercher
                </button>
              </div>

              {loadingSearch && <div className="flex justify-center py-10"><Spinner size={20} /></div>}
              {!loadingSearch && searchResults.length === 0 && search.trim() && (
                <div className="text-center py-10 space-y-2">
                  <p className="text-2xl opacity-30">🔍</p>
                  <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>Aucun utilisateur trouvé pour « {search} »</p>
                </div>
              )}

              {searchResults.map((u) => (
                <UserCard key={u.id} user={u}
                  right={
                    alreadyLinked(u.id) ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#10B981] text-xs font-semibold">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 6l4 4 6-7" />
                        </svg>
                        Invitation envoyée
                      </span>
                    ) : (
                      <button onClick={() => handleSendRequest(u.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#60A5FA] text-white text-xs font-semibold transition">
                        Ajouter
                      </button>
                    )
                  }
                />
              ))}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}
