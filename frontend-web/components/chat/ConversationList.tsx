'use client';

import { useState } from 'react';
import { useChatStore, type ChatUser, type Conversation } from '@/store/chatStore';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { apiErrorMessage } from '@/lib/errors';
import { cx } from './utils';

interface Props {
  conversations: Conversation[];
  unreadCounts: Record<string, number>;
  currentConversationId: string | null;
  currentUserId?: string;
  loadingConvs: boolean;
  friends: ChatUser[];
  getOtherUser: (conv: Conversation) => ChatUser | null;
  getTitle: (conv: Conversation) => string;
  isOnline: (userId: string) => boolean;
  onSelect: (conversationId: string) => void;
  className?: string;
}

// Colonne de gauche : liste des conversations + création rapide d'un groupe
export function ConversationList({
  conversations, unreadCounts, currentConversationId, currentUserId, loadingConvs,
  friends, getOtherUser, getTitle, isOnline, onSelect, className,
}: Props) {
  const { setConversations, setCurrentConversationId } = useChatStore();
  const [sidebarGroupOpen, setSidebarGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await api.post('/conversations/group', { name: groupName.trim(), memberIds: selectedFriends });
      const convs = await api.get('/conversations');
      setConversations(convs.data);
      setCurrentConversationId(res.data.id);
      onSelect(res.data.id);
      setSidebarGroupOpen(false);
      setGroupName('');
      setSelectedFriends([]);
    } catch (err) {
      toast(apiErrorMessage(err, 'Création du groupe impossible'), 'error');
    } finally { setCreatingGroup(false); }
  };
  const toggleFriend = (id: string) =>
    setSelectedFriends((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <aside className={cx('flex-col flex-shrink-0 w-full md:w-60', className ?? 'flex')} style={{ background: 'var(--sat-panel)', borderRight: '1px solid var(--sat-border)' }}>
    {/* Header liste */}
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sat-border)' }}>
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>
        Messages directs
      </span>
      <button
        onClick={() => setSidebarGroupOpen((v) => !v)}
        title="Nouveau groupe"
        className="w-8 h-8 md:w-5 md:h-5 -mr-1.5 md:mr-0 flex items-center justify-center rounded transition text-lg font-bold leading-none"
        style={{ color: sidebarGroupOpen ? 'var(--sat-text)' : 'var(--sat-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
        onMouseLeave={(e) => { if (!sidebarGroupOpen) e.currentTarget.style.color = 'var(--sat-muted)'; }}
      >
        +
      </button>
    </div>

    {/* Form nouveau groupe */}
    {sidebarGroupOpen && (
      <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-void)' }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--sat-muted)' }}>Nouveau groupe</p>
        <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
          placeholder="Nom du groupe..."
          className="w-full rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
          style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
        <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
          {friends.map((f) => (
            <button key={f.id} onClick={() => toggleFriend(f.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition"
              style={{ background: selectedFriends.includes(f.id) ? 'rgba(160,22,217,0.2)' : 'transparent', color: selectedFriends.includes(f.id) ? 'var(--sat-text)' : 'var(--sat-muted)' }}>
              <div className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition"
                style={{ borderColor: selectedFriends.includes(f.id) ? 'var(--sat-accent)' : 'var(--sat-faint)', background: selectedFriends.includes(f.id) ? 'var(--sat-accent)' : 'transparent' }}>
                {selectedFriends.includes(f.id) && <span className="text-[7px] font-black text-white">✓</span>}
              </div>
              <Avatar user={f} size="xs" />
              <span className="truncate">{f.nickname || f.email}</span>
            </button>
          ))}
        </div>
        <button onClick={handleCreateGroup} disabled={creatingGroup || !groupName.trim() || selectedFriends.length === 0}
          className="w-full py-1.5 rounded-md text-[11px] font-bold transition disabled:opacity-30"
          style={{ background: 'var(--sat-accent)', color: '#fff' }}>
          {creatingGroup ? 'Création...' : `Créer le groupe (${selectedFriends.length})`}
        </button>
      </div>
    )}

    {/* Liste des convs */}
    <div className="flex-1 overflow-y-auto py-2 px-2">
      {loadingConvs && (
        <div className="flex justify-center py-10">
          <Spinner size={20} />
        </div>
      )}
      {!loadingConvs && conversations.length === 0 && (
        <div className="px-3 py-8 text-center">
          <p className="text-xs" style={{ color: 'var(--sat-faint)' }}>Aucune conversation.<br/>Ajoute des amis pour commencer.</p>
        </div>
      )}
      {conversations.map((conv) => {
        const unread = unreadCounts[conv.id] ?? 0;
        const isActive = conv.id === currentConversationId;
        const otherUser = getOtherUser(conv);
        const lastMsg = conv.messages?.[0];
        const title = getTitle(conv);
        const online = otherUser ? isOnline(otherUser.id) : false;
        const filePreview = lastMsg?.fileUrl
          ? (lastMsg.fileType?.startsWith('audio/') ? 'Message vocal' : lastMsg.fileType?.startsWith('image/') ? 'Photo' : `${lastMsg.fileName || 'Fichier'}`)
          : null;
        const preview = lastMsg
          ? (filePreview ?? (lastMsg.sender.id === currentUserId ? `Vous : ${lastMsg.content}` : lastMsg.content))
          : '';

        return (
          <button key={conv.id} onClick={() => onSelect(conv.id)}
            className="w-full text-left flex items-center gap-3 md:gap-2.5 px-2 py-2.5 md:py-1.5 rounded-md transition mb-0.5"
            style={{ background: isActive ? 'var(--sat-active)' : 'transparent', color: isActive ? 'var(--sat-text)' : unread > 0 ? 'var(--sat-text)' : 'var(--sat-muted)' }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sat-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--sat-text)'; }}
            onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = unread > 0 ? 'var(--sat-text)' : 'var(--sat-muted)'; } }}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {conv.type === 'GROUP'
                ? <div className="w-11 h-11 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                    {conv.image ? <img src={mediaUrl(conv.image)} loading="lazy" className="w-full h-full object-cover" alt="" /> : title.charAt(0).toUpperCase()}
                  </div>
                : <Avatar user={otherUser || {}} size="xs" className="w-11 h-11 md:w-8 md:h-8 flex-shrink-0" />}
              {/* Status dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                style={{
                  background: conv.type === 'GROUP' ? 'transparent' : online ? 'var(--sat-online)' : 'var(--sat-offline)',
                  border: '2px solid var(--sat-panel)',
                  display: conv.type === 'GROUP' ? 'none' : 'block',
                }} />
            </div>

            {/* Texte */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={cx('text-[15px] md:text-[13px] truncate', unread > 0 ? 'font-bold' : 'font-medium')}>{title}</span>
                {unread > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center text-white px-1"
                    style={{ background: 'var(--sat-dnd)' }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              {preview && (
                <p className="text-[13px] md:text-[11px] truncate" style={{ color: 'var(--sat-faint)' }}>{preview}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>

    </aside>
  );
}
