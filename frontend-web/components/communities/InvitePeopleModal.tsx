'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { toast } from '@/components/Toast';

interface InvitePeopleModalProps {
  communityId: string;
  communityName: string;
  friends: any[];
  existingIds: string[];
  onClose: () => void;
}

type Tab = 'friends' | 'link';

const EXPIRY_OPTIONS = [
  { label: '1 heure', hours: 1 },
  { label: '24 heures', hours: 24 },
  { label: '7 jours', hours: 24 * 7 },
  { label: '30 jours', hours: 24 * 30 },
  { label: 'Sans expiration', hours: null },
] as const;

const MAX_USES_OPTIONS = [
  { label: 'Illimité', value: null },
  { label: '1 usage', value: 1 },
  { label: '10 usages', value: 10 },
  { label: '25 usages', value: 25 },
  { label: '100 usages', value: 100 },
] as const;

/**
 * Hub d'invitation façon Discord/WhatsApp :
 * — Amis : multi-sélection + message, envoi en une action (notification Accepter/Refuser).
 * — Lien : lien configurable (durée / quota), QR code, code d'invitation copiable.
 */
export function InvitePeopleModal({ communityId, communityName, friends, existingIds, onClose }: InvitePeopleModalProps) {
  const [tab, setTab] = useState<Tab>('friends');

  // ── Onglet amis ──
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSummary, setSentSummary] = useState<string | null>(null);
  const [alreadyInvited, setAlreadyInvited] = useState<Set<string>>(new Set());

  // ── Onglet lien ──
  const [link, setLink] = useState<any | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [expiry, setExpiry] = useState<number | null>(24 * 7);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [copied, setCopied] = useState<'url' | 'code' | null>(null);
  const [linkError, setLinkError] = useState('');

  // Invitations déjà en attente (pour griser les amis concernés)
  useEffect(() => {
    api.get(`/communities/${communityId}/invitations`)
      .then((r) => setAlreadyInvited(new Set(
        (r.data as any[]).filter((i) => i.status === 'PENDING').map((i) => i.invitee?.id),
      )))
      .catch(() => { /* pas la permission de lister : pas bloquant */ });
  }, [communityId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const memberIds = useMemo(() => new Set(existingIds), [existingIds]);
  const filtered = useMemo(() => friends.filter((f) =>
    !search.trim() || (f.nickname || f.email || '').toLowerCase().includes(search.toLowerCase()),
  ), [friends, search]);
  const eligible = filtered.filter((f) => !memberIds.has(f.id) && !alreadyInvited.has(f.id));
  const ineligible = filtered.filter((f) => memberIds.has(f.id) || alreadyInvited.has(f.id));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const sendInvites = async () => {
    if (!selected.size) return;
    setSending(true);
    try {
      const res = await api.post(`/communities/${communityId}/invitations`, {
        userIds: Array.from(selected),
        message: message.trim() || undefined,
      });
      const { invited, skipped } = res.data;
      setSentSummary(`${invited} invitation${invited > 1 ? 's' : ''} envoyée${invited > 1 ? 's' : ''}${skipped ? ` (${skipped} ignorée${skipped > 1 ? 's' : ''})` : ''}`);
      setAlreadyInvited((prev) => new Set([...prev, ...selected]));
      setSelected(new Set());
      setMessage('');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Erreur lors de l\'envoi', 'error');
    } finally {
      setSending(false);
    }
  };

  const createLink = async () => {
    setCreatingLink(true);
    setLinkError('');
    try {
      const res = await api.post(`/communities/${communityId}/invite-links`, {
        expiresInHours: expiry,
        maxUses,
      });
      setLink(res.data);
    } catch (e: any) {
      setLinkError(e?.response?.data?.message || 'Impossible de créer le lien (permissions ?)');
    } finally {
      setCreatingLink(false);
    }
  };

  const linkUrl = link ? `${window.location.origin}/communities/join/${link.token}` : '';

  const copy = async (what: 'url' | 'code') => {
    await navigator.clipboard.writeText(what === 'url' ? linkUrl : link.token);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  const SECTION = 'text-[10px] font-bold uppercase tracking-widest mb-2';

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-4 pb-0 flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base truncate" style={{ color: 'var(--sat-text)' }}>
              Inviter dans « {communityName} »
            </h2>
            <button onClick={onClose} aria-label="Fermer"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition flex-shrink-0"
              style={{ color: 'var(--sat-faint)', background: 'var(--sat-hover)' }}>✕</button>
          </div>
          <div className="flex gap-1">
            {([['friends', 'Mes amis'], ['link', 'Lien & QR code']] as [Tab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className="px-4 py-2.5 text-sm font-semibold transition rounded-t-lg"
                style={{
                  color: tab === key ? 'var(--sat-accent)' : 'var(--sat-muted)',
                  borderBottom: tab === key ? '2px solid var(--sat-accent)' : '2px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'friends' && (
            <div className="space-y-3">
              {sentSummary && (
                <div className="px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {sentSummary}
                </div>
              )}

              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un ami…"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />

              <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                {eligible.length === 0 && ineligible.length === 0 && (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--sat-faint)' }}>Aucun ami trouvé</p>
                )}
                {eligible.map((f) => {
                  const isSelected = selected.has(f.id);
                  return (
                    <button key={f.id} onClick={() => toggle(f.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left"
                      style={{
                        background: isSelected ? 'rgba(37,99,235,0.1)' : 'var(--sat-hover)',
                        border: `1.5px solid ${isSelected ? 'var(--sat-accent)' : 'transparent'}`,
                      }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition"
                        style={{
                          border: `1.5px solid ${isSelected ? 'var(--sat-accent)' : 'var(--sat-faint)'}`,
                          background: isSelected ? 'var(--sat-accent)' : 'transparent',
                        }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                        style={{ background: f.image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                        {f.image ? <img src={mediaUrl(f.image)} className="w-full h-full object-cover" alt="" /> : (f.nickname || f.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{f.nickname || f.email?.split('@')[0]}</p>
                      </div>
                    </button>
                  );
                })}
                {ineligible.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl opacity-40" style={{ background: 'var(--sat-hover)' }}>
                    <div className="w-4" />
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                      style={{ background: f.image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                      {f.image ? <img src={mediaUrl(f.image)} className="w-full h-full object-cover" alt="" /> : (f.nickname || f.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{f.nickname || f.email?.split('@')[0]}</p>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: 'var(--sat-muted)' }}>
                      {memberIds.has(f.id) ? 'Déjà membre' : 'Déjà invité'}
                    </span>
                  </div>
                ))}
              </div>

              <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300}
                placeholder="Message d'accompagnement (optionnel)…"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />

              <button onClick={sendInvites} disabled={sending || selected.size === 0}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                {sending ? 'Envoi…' : selected.size > 0 ? `Inviter ${selected.size} ami${selected.size > 1 ? 's' : ''}` : 'Sélectionne des amis'}
              </button>
              <p className="text-[10px] text-center" style={{ color: 'var(--sat-faint)' }}>
                Chaque personne recevra une notification et pourra accepter ou refuser.
              </p>
            </div>
          )}

          {tab === 'link' && (
            <div className="space-y-4">
              {!link ? (
                <>
                  <div>
                    <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Durée de validité</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXPIRY_OPTIONS.map((o) => (
                        <button key={o.label} onClick={() => setExpiry(o.hours)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                          style={{
                            background: expiry === o.hours ? 'rgba(37,99,235,0.1)' : 'var(--sat-hover)',
                            border: `1.5px solid ${expiry === o.hours ? 'var(--sat-accent)' : 'transparent'}`,
                            color: expiry === o.hours ? 'var(--sat-accent)' : 'var(--sat-muted)',
                          }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Nombre maximal d'utilisations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MAX_USES_OPTIONS.map((o) => (
                        <button key={o.label} onClick={() => setMaxUses(o.value)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                          style={{
                            background: maxUses === o.value ? 'rgba(37,99,235,0.1)' : 'var(--sat-hover)',
                            border: `1.5px solid ${maxUses === o.value ? 'var(--sat-accent)' : 'transparent'}`,
                            color: maxUses === o.value ? 'var(--sat-accent)' : 'var(--sat-muted)',
                          }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {linkError && <p className="text-xs" style={{ color: '#EF4444' }}>{linkError}</p>}
                  <button onClick={createLink} disabled={creatingLink}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                    {creatingLink ? 'Création…' : 'Générer le lien d\'invitation'}
                  </button>
                </>
              ) : (
                <>
                  {/* Lien copiable */}
                  <div>
                    <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Lien d'invitation</p>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2.5 rounded-xl text-xs truncate flex items-center"
                        style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-muted)' }}>
                        {linkUrl}
                      </div>
                      <button onClick={() => copy('url')}
                        className="px-4 rounded-xl text-xs font-bold transition flex-shrink-0"
                        style={{
                          background: copied === 'url' ? 'rgba(16,185,129,0.12)' : 'rgba(37,99,235,0.1)',
                          color: copied === 'url' ? '#10B981' : 'var(--sat-accent)',
                          border: `1.5px solid ${copied === 'url' ? '#10B981' : 'var(--sat-accent)'}`,
                        }}>
                        {copied === 'url' ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--sat-faint)' }}>
                      {link.expiresAt ? `Expire le ${new Date(link.expiresAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'N\'expire jamais'}
                      {link.maxUses ? ` · ${link.maxUses} usage${link.maxUses > 1 ? 's' : ''} max` : ' · usages illimités'}
                    </p>
                  </div>

                  {/* QR code */}
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="p-3 rounded-2xl" style={{ background: '#fff' }}>
                      <QRCodeSVG value={linkUrl} size={148} level="M" />
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>Scanne pour rejoindre directement</p>
                  </div>

                  {/* Code manuel */}
                  <div>
                    <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Code d'invitation</p>
                    <button onClick={() => copy('code')} title="Copier le code"
                      className="w-full py-2.5 rounded-xl font-mono text-sm font-bold tracking-widest transition hover:opacity-80"
                      style={{
                        background: 'var(--sat-void)', color: copied === 'code' ? '#10B981' : 'var(--sat-text)',
                        border: `1px dashed ${copied === 'code' ? '#10B981' : 'var(--sat-border-2)'}`,
                      }}>
                      {copied === 'code' ? 'Code copié' : link.token}
                    </button>
                    <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--sat-faint)' }}>
                      À saisir dans « Rejoindre avec un code » depuis la page Communautés
                    </p>
                  </div>

                  <button onClick={() => setLink(null)}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                    style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>
                    Créer un autre lien avec d'autres réglages
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
