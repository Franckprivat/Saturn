'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { Avatar } from './Avatar';

interface Member {
  id: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  user: { id: string; email: string; nickname: string; image?: string | null; avatarColor?: string | null };
}

interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  sender: { nickname: string; email: string };
}

interface GroupPanelProps {
  conversationId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  creatorId?: string | null;
  participants: Member[];
  attachments: Attachment[];
  currentUserId: string;
  friends: any[];
  onClose: () => void;
  onUpdated: () => void;
  onLeft?: () => void;
  onDeleted?: () => void;
}

type Section = 'infos' | 'membres' | 'fichiers';

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

function SectionTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 text-[11px] font-semibold transition-all duration-150 relative"
      style={{ color: active ? 'var(--sat-accent)' : 'var(--sat-muted)' }}
    >
      {children}
      {active && (
        <span
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
          style={{ background: 'var(--sat-accent)' }}
        />
      )}
    </button>
  );
}

export function GroupPanel({
  conversationId, name, description, image, participants, attachments,
  currentUserId, friends, onClose, onUpdated, onLeft, onDeleted,
}: GroupPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<Section>('infos');

  // Infos edit
  const [editName, setEditName] = useState(name);
  const [editDesc, setEditDesc] = useState(description || '');
  const [editImage, setEditImage] = useState<string | null>(image || null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  // Add members
  const [addingMembers, setAddingMembers] = useState(false);
  const [selectedNew, setSelectedNew] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);

  // Danger zone
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  // Invite link
  const [inviteLink, setInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const myParticipant = participants.find((p) => p.user.id === currentUserId);
  const isAdmin = myParticipant?.role === 'ADMIN';
  const memberIds = new Set(participants.map((p) => p.user.id));
  const addableFriends = friends.filter((f) => !memberIds.has(f.id));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveInfos = async () => {
    if (!editName.trim()) return;
    setSavingInfo(true);
    try {
      await api.patch(`/conversations/${conversationId}`, {
        name: editName.trim(),
        description: editDesc.trim(),
        image: editImage,
      });
      onUpdated();
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
    } finally {
      setSavingInfo(false);
    }
  };

  const saveNewMembers = async () => {
    if (!selectedNew.length) return;
    setSavingMembers(true);
    try {
      await api.post(`/conversations/${conversationId}/members`, { memberIds: selectedNew });
      setSelectedNew([]);
      setAddingMembers(false);
      onUpdated();
    } finally {
      setSavingMembers(false);
    }
  };

  const changeRole = async (userId: string, role: 'ADMIN' | 'MEMBER') => {
    await api.patch(`/conversations/${conversationId}/members/${userId}/role`, { role });
    onUpdated();
  };

  const removeMember = async (userId: string) => {
    await api.delete(`/conversations/${conversationId}/members/${userId}`);
    onUpdated();
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      await api.post(`/conversations/${conversationId}/leave`);
      onLeft?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/conversations/${conversationId}`);
      onDeleted?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const generateInvite = async () => {
    try {
      const res = await api.post(`/conversations/${conversationId}/invite`);
      const link = `${window.location.origin}/join/${res.data.token}`;
      setInviteLink(link);
    } catch { /* ignore */ }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleNewMember = (id: string) =>
    setSelectedNew((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const FileTypeIcon = ({ type }: { type: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sat-accent)' }}>
      {type.startsWith('image/') ? (
        <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>
      ) : type.includes('video') ? (
        <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>
      ) : (
        <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>
      )}
    </svg>
  );

  return (
    <aside
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        width: 300,
        background: 'var(--sat-surface)',
        borderLeft: '1px solid var(--sat-border)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="h-12 px-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--sat-border)' }}
      >
        <span className="text-[13px] font-bold" style={{ color: 'var(--sat-text)' }}>
          Paramètres du groupe
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center transition text-lg leading-none"
          style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}
        >
          ✕
        </button>
      </div>

      {/* ── Avatar du groupe ── */}
      <div
        className="flex flex-col items-center py-6 gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-panel)' }}
      >
        <div className="relative group">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-3xl font-black text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))' }}
          >
            {editImage
              ? <img src={mediaUrl(editImage)} alt="group" className="w-full h-full object-cover" />
              : name.charAt(0).toUpperCase()}
          </div>

          {isAdmin && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                title="Changer la photo"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              {editImage && (
                <button
                  onClick={() => setEditImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white transition"
                  style={{ background: 'var(--sat-dnd)' }}
                  title="Supprimer la photo"
                >
                  ✕
                </button>
              )}
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        <div className="text-center">
          <p className="text-[15px] font-bold" style={{ color: 'var(--sat-text)' }}>{name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sat-muted)' }}>
            {participants.length} membre{participants.length !== 1 ? 's' : ''}
            {isAdmin && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--sat-accent)' }}>Admin</span>}
          </p>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid var(--sat-border)' }}
      >
        <SectionTab active={section === 'infos'} onClick={() => setSection('infos')}>Infos</SectionTab>
        <SectionTab active={section === 'membres'} onClick={() => setSection('membres')}>
          Membres{' '}
          <span className="text-[9px] font-black px-1 py-0.5 rounded-full ml-0.5"
            style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>
            {participants.length}
          </span>
        </SectionTab>
        <SectionTab active={section === 'fichiers'} onClick={() => setSection('fichiers')}>Fichiers</SectionTab>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── INFOS ── */}
        {section === 'infos' && (
          <div className="p-4 space-y-4">

            {/* Nom */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>
                Nom du groupe
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!isAdmin}
                maxLength={64}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition"
                style={{
                  background: 'var(--sat-panel)',
                  border: '1.5px solid var(--sat-border-2)',
                  color: 'var(--sat-text)',
                  opacity: isAdmin ? 1 : 0.6,
                  cursor: isAdmin ? 'text' : 'default',
                }}
                onFocus={(e) => { if (isAdmin) e.currentTarget.style.borderColor = 'var(--sat-accent)'; }}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sat-border-2)')}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>
                Description
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                disabled={!isAdmin}
                rows={3}
                placeholder={isAdmin ? "Décris le groupe..." : "Aucune description"}
                maxLength={280}
                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none transition"
                style={{
                  background: 'var(--sat-panel)',
                  border: '1.5px solid var(--sat-border-2)',
                  color: 'var(--sat-text)',
                  opacity: isAdmin ? 1 : 0.6,
                  cursor: isAdmin ? 'text' : 'default',
                }}
                onFocus={(e) => { if (isAdmin) e.currentTarget.style.borderColor = 'var(--sat-accent)'; }}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sat-border-2)')}
              />
              {isAdmin && (
                <p className="text-[10px] text-right" style={{ color: 'var(--sat-faint)' }}>
                  {editDesc.length}/280
                </p>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={saveInfos}
                disabled={savingInfo || !editName.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: infoSaved ? 'var(--sat-online)' : 'var(--sat-accent)', color: '#fff' }}
              >
                {savingInfo ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : infoSaved ? (
                  '✓ Sauvegardé'
                ) : (
                  'Sauvegarder les modifications'
                )}
              </button>
            )}

            {/* Lien d'invitation */}
            {isAdmin && (
              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--sat-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>
                  Lien d'invitation
                </p>
                {!inviteLink ? (
                  <button
                    onClick={generateInvite}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--sat-panel)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sat-accent)'; e.currentTarget.style.borderColor = 'var(--sat-accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sat-muted)'; e.currentTarget.style.borderColor = 'var(--sat-border-2)'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Générer un lien
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      readOnly
                      value={inviteLink}
                      className="flex-1 px-2.5 py-2 rounded-xl text-[10px] focus:outline-none truncate"
                      style={{ background: 'var(--sat-panel)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-muted)' }}
                    />
                    <button
                      onClick={copyLink}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap"
                      style={{ background: copiedLink ? 'var(--sat-online)' : 'var(--sat-accent)', color: '#fff' }}
                    >
                      {copiedLink ? '✓' : 'Copier'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Zone danger */}
            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--sat-border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-dnd)' }}>
                Zone de danger
              </p>

              {/* Quitter */}
              {!confirmLeave ? (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Quitter le groupe
                </button>
              ) : (
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-[11px] font-semibold text-center" style={{ color: '#EF4444' }}>
                    Confirmer ? Tu ne pourras plus voir ce groupe.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmLeave(false)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition" style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>
                      Annuler
                    </button>
                    <button onClick={handleLeave} disabled={busy} className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition" style={{ background: '#EF4444' }}>
                      {busy ? '...' : 'Quitter'}
                    </button>
                  </div>
                </div>
              )}

              {/* Supprimer (admin seulement) */}
              {isAdmin && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.22)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                  Supprimer le groupe
                </button>
              )}
              {isAdmin && confirmDelete && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="text-[11px] font-semibold text-center" style={{ color: '#EF4444' }}>
                    Supprimer définitivement ? Tous les messages seront perdus.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition" style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>
                      Annuler
                    </button>
                    <button onClick={handleDelete} disabled={busy} className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition" style={{ background: '#EF4444' }}>
                      {busy ? '...' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MEMBRES ── */}
        {section === 'membres' && (
          <div className="p-3 space-y-3">

            {/* Ajouter des membres */}
            {isAdmin && (
              <div>
                <button
                  onClick={() => { setAddingMembers((v) => !v); setSelectedNew([]); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{
                    background: addingMembers ? 'rgba(37,99,235,0.1)' : 'var(--sat-panel)',
                    border: `1px solid ${addingMembers ? 'var(--sat-accent)' : 'var(--sat-border-2)'}`,
                    color: addingMembers ? 'var(--sat-accent)' : 'var(--sat-muted)',
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                    style={{ background: addingMembers ? 'var(--sat-accent)' : 'var(--sat-hover)', color: addingMembers ? '#fff' : 'var(--sat-muted)' }}
                  >
                    +
                  </span>
                  Ajouter des membres
                </button>

                {addingMembers && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--sat-border-2)' }}>
                    {addableFriends.length === 0 ? (
                      <p className="text-xs text-center py-5" style={{ color: 'var(--sat-muted)' }}>
                        Tous tes amis sont déjà membres.
                      </p>
                    ) : (
                      <>
                        <div className="max-h-44 overflow-y-auto divide-y" style={{ borderColor: 'var(--sat-border)' }}>
                          {addableFriends.map((f) => {
                            const sel = selectedNew.includes(f.id);
                            return (
                              <button
                                key={f.id}
                                onClick={() => toggleNewMember(f.id)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition"
                                style={{ background: sel ? 'rgba(37,99,235,0.07)' : 'var(--sat-surface)' }}
                                onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = 'var(--sat-hover)'; }}
                                onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'var(--sat-surface)'; }}
                              >
                                <span
                                  className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
                                  style={{
                                    background: sel ? 'var(--sat-accent)' : 'transparent',
                                    borderColor: sel ? 'var(--sat-accent)' : 'var(--sat-faint)',
                                  }}
                                >
                                  {sel && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M1 6l4 4 6-7" /></svg>}
                                </span>
                                <Avatar user={f} size="xs" className="w-8 h-8 flex-shrink-0" />
                                <span className="text-sm truncate" style={{ color: sel ? 'var(--sat-accent)' : 'var(--sat-text)', fontWeight: sel ? 600 : 400 }}>
                                  {f.nickname || f.email}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="p-2 flex gap-2" style={{ borderTop: '1px solid var(--sat-border)' }}>
                          <button
                            onClick={() => { setAddingMembers(false); setSelectedNew([]); }}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
                            style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}
                          >
                            Annuler
                          </button>
                          <button
                            onClick={saveNewMembers}
                            disabled={savingMembers || selectedNew.length === 0}
                            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition disabled:opacity-30"
                            style={{ background: 'var(--sat-accent)' }}
                          >
                            {savingMembers ? '...' : `Ajouter (${selectedNew.length})`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Liste des membres */}
            <div className="space-y-0.5">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl group transition"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar user={p.user} size="xs" className="w-9 h-9 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--sat-text)' }}>
                        {p.user.nickname || p.user.email}
                        {p.user.id === currentUserId && (
                          <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--sat-faint)' }}>(moi)</span>
                        )}
                      </p>
                    </div>
                    <p
                      className="text-[10px] font-semibold"
                      style={{ color: p.role === 'ADMIN' ? 'var(--sat-accent)' : 'var(--sat-faint)' }}
                    >
                      {p.role === 'ADMIN' ? '⭐ Administrateur' : 'Membre'}
                    </p>
                  </div>

                  {/* Actions admin sur les autres */}
                  {isAdmin && p.user.id !== currentUserId && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {p.role === 'MEMBER' ? (
                        <button
                          onClick={() => changeRole(p.user.id, 'ADMIN')}
                          title="Promouvoir admin"
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition text-xs"
                          style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--sat-accent)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.25)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.12)')}
                        >
                          ⭐
                        </button>
                      ) : (
                        <button
                          onClick={() => changeRole(p.user.id, 'MEMBER')}
                          title="Rétrograder"
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition text-xs"
                          style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-active)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
                        >
                          ↓
                        </button>
                      )}
                      <button
                        onClick={() => removeMember(p.user.id)}
                        title="Exclure du groupe"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition text-xs"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FICHIERS ── */}
        {section === 'fichiers' && (
          <div className="p-3 space-y-1.5">
            {attachments.filter((a) => a.fileUrl).length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <svg className="opacity-20" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sat-muted)' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>Aucun fichier partagé dans ce groupe</p>
              </div>
            ) : (
              attachments.filter((a) => a.fileUrl).map((a) => (
                <a
                  key={a.id}
                  href={mediaUrl(a.fileUrl)}
                  download={a.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition"
                  style={{ background: 'var(--sat-panel)', border: '1px solid var(--sat-border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-panel)')}
                >
                  <span className="flex-shrink-0"><FileTypeIcon type={a.fileType} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{a.fileName}</p>
                    <p className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>
                      {a.sender.nickname || a.sender.email} · {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sat-faint)', flexShrink: 0 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
