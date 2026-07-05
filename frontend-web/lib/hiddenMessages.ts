/**
 * « Supprimer pour moi » : masquage local d'un message (façon WhatsApp).
 * Le message reste chez les autres participants — seul cet appareil le cache.
 */

const MAX_HIDDEN = 1000;

function key(userId: string) {
  return `saturn_hidden_messages_${userId}`;
}

export function getHiddenMessageIds(userId: string): Set<string> {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

export function hideMessageForMe(userId: string, messageId: string): Set<string> {
  const ids = getHiddenMessageIds(userId);
  ids.add(messageId);
  const list = Array.from(ids).slice(-MAX_HIDDEN);
  localStorage.setItem(key(userId), JSON.stringify(list));
  return new Set(list);
}
