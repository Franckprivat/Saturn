'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, init } = useAuthStore();
  const {
    conversations,
    messagesByConversationId,
    currentConversationId,
    setConversations,
    setCurrentConversationId,
    setMessages,
    addMessage,
  } = useChatStore();

  const socket = useChatSocket();

  const [newMessage, setNewMessage] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
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
    const fetchConversations = async () => {
      if (!isAuthenticated()) return;
      setLoadingConversations(true);
      setError('');
      try {
        const response = await api.get('/conversations');
        setConversations(response.data);
        const fromUrl = searchParams.get('conversationId');
        if (fromUrl) {
          setCurrentConversationId(fromUrl);
        } else if (response.data.length && !currentConversationId) {
          setCurrentConversationId(response.data[0].id);
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Erreur lors du chargement des conversations',
        );
      } finally {
        setLoadingConversations(false);
      }
    };
    fetchConversations();
  }, [isAuthenticated, setConversations, currentConversationId, setCurrentConversationId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentConversationId) return;
      if (messagesByConversationId[currentConversationId]) return;

      setLoadingMessages(true);
      setError('');
      try {
        const response = await api.get(`/conversations/${currentConversationId}/messages`);
        setMessages(currentConversationId, response.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Erreur lors du chargement des messages',
        );
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [currentConversationId, messagesByConversationId, setMessages]);

  useEffect(() => {
    if (!socket || !currentConversationId) return;

    socket.emit('join_conversation', { conversationId: currentConversationId });
  }, [socket, currentConversationId]);

  useEffect(() => {
    if (!socket) return;

    const handler = (message: any) => {
      addMessage(message.conversationId, message);
    };

    socket.on('new_message', handler);

    return () => {
      socket.off('new_message', handler);
    };
  }, [socket, addMessage]);

  const currentMessages = useMemo(
    () => (currentConversationId ? messagesByConversationId[currentConversationId] ?? [] : []),
    [currentConversationId, messagesByConversationId],
  );

  const handleSend = () => {
    if (!socket || !currentConversationId || !newMessage.trim()) return;

    socket.emit('send_message', {
      conversationId: currentConversationId,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex w-full h-full bg-[#0F0F14] text-white">
      <aside className="w-72 border-r border-black/60 bg-[#181820] flex flex-col">
        <div className="px-4 py-3 border-b border-black/60">
          <h2 className="text-sm font-semibold">Messages privés</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations && (
            <div className="p-3 text-xs text-[#B6B6B6]">Chargement des conversations...</div>
          )}
          {!loadingConversations && conversations.length === 0 && (
            <div className="p-3 text-xs text-[#B6B6B6]">
              Aucune conversation pour le moment.
            </div>
          )}
          {conversations.map((conversation) => {
            const otherParticipants =
              user &&
              conversation.participants.filter((p: any) => p.user.id !== user.id).map((p: any) => p.user);
            const title =
              otherParticipants && otherParticipants.length
                ? otherParticipants.map((u: any) => u.nickname).join(', ')
                : 'Conversation';

            return (
              <button
                key={conversation.id}
                onClick={() => setCurrentConversationId(conversation.id)}
                className={classNames(
                  'w-full text-left px-3 py-2 flex flex-col gap-0.5 text-xs hover:bg-white/5 transition',
                  currentConversationId === conversation.id && 'bg-white/10',
                )}
              >
                <span className="font-semibold truncate">{title}</span>
                <span className="text-[11px] text-[#B6B6B6]">
                  {new Date(conversation.createdAt).toLocaleString('fr-FR')}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-gradient-to-b from-[#181820] via-[#0F0F14] to-black">
        <div className="px-4 py-3 border-b border-black/60 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold">
              {currentConversationId ? 'Conversation' : 'Aucune conversation sélectionnée'}
            </h1>
            <p className="text-[11px] text-[#B6B6B6]">
              Messagerie instantanée en temps réel, comme Discord.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
          {error && (
            <div className="bg-[#CF11BC]/10 border border-[#CF11BC]/40 text-[#CF11BC] px-3 py-2 rounded-md text-xs">
              {error}
            </div>
          )}

          {loadingMessages && (
            <div className="text-xs text-[#B6B6B6]">Chargement des messages...</div>
          )}

          {!loadingMessages && currentMessages.length === 0 && currentConversationId && (
            <div className="text-xs text-[#B6B6B6]">
              Aucun message pour cette conversation. Démarrez la discussion !
            </div>
          )}

          {currentMessages.map((message: any) => {
            const isMe = user && message.sender.id === user.id;
            return (
              <div
                key={message.id}
                className={classNames(
                  'flex w-full',
                  isMe ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={classNames(
                    'max-w-[70%] px-3 py-2 rounded-2xl text-xs shadow-md',
                    isMe
                      ? 'bg-[#A016D9] text-white rounded-br-sm'
                      : 'bg-white/5 text-[#E3E3E3] rounded-bl-sm',
                  )}
                >
                  <div className="text-[10px] text-[#B6B6B6]/80 mb-0.5">
                    {message.sender.nickname || message.sender.email}
                  </div>
                  <div>{message.content}</div>
                  <div className="mt-0.5 text-[10px] text-[#B6B6B6]/70 text-right">
                    {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-black/60">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envoyer un message à vos amis..."
              className="flex-1 px-3 py-2 rounded-2xl bg-black/40 border border-white/10 text-xs placeholder-[#B6B6B6]/60 focus:outline-none focus:ring-2 focus:ring-[#A016D9]"
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-xs font-semibold shadow-lg shadow-[#5865F2]/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!newMessage.trim() || !currentConversationId}
            >
              Envoyer
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

