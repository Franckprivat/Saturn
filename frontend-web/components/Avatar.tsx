'use client';

import { useState } from 'react';
import { mediaUrl } from '@/lib/media';

const DEFAULT_GRADIENT = 'from-[#2563EB] to-[#60A5FA]';

interface AvatarProps {
  user: {
    nickname?: string | null;
    email?: string | null;
    image?: string | null;
    avatarColor?: string | null;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

/**
 * Avatar utilisateur : image résolue via mediaUrl, avec retour automatique
 * aux initiales sur dégradé si l'image ne charge pas (URL morte, 404, réseau).
 */
export function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (user.nickname || user.email || '?').charAt(0).toUpperCase();
  const gradient = user.avatarColor || DEFAULT_GRADIENT;
  const sizeClass = SIZES[size];
  const src = !failed ? mediaUrl(user.image) : undefined;

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 overflow-hidden ${
        src ? '' : `bg-gradient-to-br ${gradient}`
      } ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={initial}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-white">{initial}</span>
      )}
    </div>
  );
}
