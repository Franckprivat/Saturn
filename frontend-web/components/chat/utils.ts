export function cx(...cs: (string | false | null | undefined)[]) {
  return cs.filter(Boolean).join(' ');
}

export const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

// Surnom donné localement à un contact (stocké dans le navigateur)
export function getLocalAlias(myId: string, otherId: string) {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`saturn_alias_${myId}_${otherId}`) || '';
}
export function setLocalAlias(myId: string, otherId: string, name: string) {
  if (name.trim()) localStorage.setItem(`saturn_alias_${myId}_${otherId}`, name.trim());
  else localStorage.removeItem(`saturn_alias_${myId}_${otherId}`);
}
