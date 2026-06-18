'use client';

import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

const line = (size: number, className?: string, style?: CSSProperties, sw = 2) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  className, style,
});
const fill = (size: number, className?: string, style?: CSSProperties) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', className, style,
});

// ── Appels (style WhatsApp, pleins) ──
export const PhoneIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
);
export const PhoneOffIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.69-1.36-2.67-1.85a.992.992 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
);
export const VideoIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
);
export const VideoOffIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" /></svg>
);

// ── Micro ──
export const MicIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
);
export const MicOffIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6 6V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" /></svg>
);
export const SpeakerIcon = ({ size = 20, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
);

// ── Saisie ──
export const SmileyIcon = ({ size = 20, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
);
export const PaperclipIcon = ({ size = 20, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
);
export const SendIcon = ({ size = 18, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
);
export const CameraIcon = ({ size = 20, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
);

// ── Actions message ──
export const ReplyIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
);
export const EditIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
export const TrashIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>
);
export const CopyIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const PinIcon = ({ size = 18, className, style }: IconProps) => (
  <svg {...fill(size, className, style)}><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" /></svg>
);

// ── Divers ──
export const SearchIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
export const UsersIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
export const PlusIcon = ({ size = 18, className, style, strokeWidth = 2.5 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const CloseIcon = ({ size = 18, className, style, strokeWidth = 2.5 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
export const GhostIcon = ({ size = 18, className, style, strokeWidth = 2 }: IconProps) => (
  <svg {...line(size, className, style, strokeWidth)}><path d="M12 2a7 7 0 0 0-7 7v11l2.5-2 2.5 2 2-2 2 2 2.5-2 2.5 2V9a7 7 0 0 0-7-7z" /><line x1="9" y1="10" x2="9.01" y2="10" /><line x1="15" y1="10" x2="15.01" y2="10" /></svg>
);
