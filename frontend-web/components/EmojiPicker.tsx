'use client';

import { useEffect, useRef, useState } from 'react';

// Twemoji CDN — rendu identique aux emojis Apple sur tous les OS
function TwEmoji({ emoji, size = 22 }: { emoji: string; size?: number }) {
  const cp = emoji.codePointAt(0)?.toString(16);
  if (!cp) return <span style={{ fontSize: size }}>{emoji}</span>;

  // Convertir l'emoji en séquence de codepoints pour Twemoji
  const codes = [...emoji].map((c) => c.codePointAt(0)?.toString(16)).filter(Boolean).join('-');
  const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codes}.svg`;

  return (
    <img
      src={url}
      alt={emoji}
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      onError={(e) => {
        // fallback texte si Twemoji manque
        const el = e.currentTarget;
        el.style.display = 'none';
        el.parentElement!.textContent = emoji;
      }}
    />
  );
}

const CATEGORIES = [
  {
    icon: '😀', label: 'Émotions',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','😵','🤯','🥳','🥸','😎','🤓','🧐','😈','👿','👹','👺','💀','☠️','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  },
  {
    icon: '👋', label: 'Gestes',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃'],
  },
  {
    icon: '❤️', label: 'Cœurs',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💋','💌','💍','💎','🎀','🎁','🎊','🎉','✨','🌟','⭐','🌠','🎆','🎇','🎋','🎍','🎎','🎏','🎐'],
  },
  {
    icon: '🐶', label: 'Animaux',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔'],
  },
  {
    icon: '🍕', label: 'Nourriture',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
  },
  {
    icon: '🏀', label: 'Sports',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺','🏇','⛹️','🤾','🏌️','🏄','🚣','🧘','🏊','🤽','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🏵️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎸','🥁','🎷','🎺','🎻','🪕','🎹'],
  },
  {
    icon: '🚀', label: 'Voyage',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸','🪐','🌍','🌎','🌏','🗺️','🧭','🌋','🏔️','⛰️','🏕️','🏖️','🏗️','🏘️','🏙️','🏚️','🏛️','🏟️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','⛩️','🕍'],
  },
  {
    icon: '💡', label: 'Objets',
    emojis: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💳','💎','⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','🪛','🔑','🗝️','🔓','🔒','🗄️','🗃️','📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖊️','🖋️','📝','📁','📂','🗂️','📅','📆','📇','📈','📉','📊','📋','📌','📍','🗺️'],
  },
  {
    icon: '#️⃣', label: 'Symboles',
    emojis: ['✅','❎','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','⬛','⬜','◼️','◻️','◾','◽','▪️','▫️','🔈','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯️','♠️','♥️','♦️','♣️','🃏','🀄','🎴','🔮','🧿','🪬','🧲','🧪','🧫','🧬','🔭','🔬','🩺','🩻','🩹','🩼','💊','🩸','🔪','🗡️','⚔️','🛡️','🚬','⚰️','⚱️','🏺','🧱','🔑','🪤','🧩','🪆','🎭','🎨','🖼️','🎪','🎠','🎡','🎢','🎪'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const displayed = search.trim()
    ? CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
        e.includes(search) || CATEGORIES.find((c) => c.emojis.includes(e))?.label.toLowerCase().includes(search.toLowerCase()),
      ).slice(0, 80)
    : CATEGORIES[activeCategory].emojis;

  return (
    // Panneau horizontal rectangulaire large
    <div
      ref={ref}
      className="absolute bottom-14 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-300/50 overflow-hidden"
      style={{ width: 480, maxWidth: '90vw' }}
    >
      {/* Barre de recherche */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un emoji..."
          className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
        />
      </div>

      {/* Onglets catégories — horizontaux */}
      {!search && (
        <div className="flex overflow-x-auto scrollbar-none border-b border-slate-200 px-2">
          {CATEGORIES.map((cat, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              title={cat.label}
              className={`flex-shrink-0 px-2.5 py-2 text-base transition rounded-t-lg ${
                activeCategory === i ? 'border-b-2 border-[#2563EB] opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
            >
              <TwEmoji emoji={cat.icon} size={18} />
            </button>
          ))}
        </div>
      )}

      {/* Grille d'emojis — 10 colonnes, 4 lignes visibles avec scroll */}
      <div className="grid gap-0.5 p-2 overflow-y-auto" style={{ gridTemplateColumns: 'repeat(10, 1fr)', maxHeight: 200 }}>
        {displayed.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="flex items-center justify-center rounded-xl hover:bg-[#F1F5F9] transition aspect-square"
            style={{ minWidth: 36, minHeight: 36 }}
          >
            <TwEmoji emoji={emoji} size={22} />
          </button>
        ))}
        {displayed.length === 0 && (
          <p className="col-span-10 text-center text-xs text-[#94A3B8] py-6">Aucun emoji trouvé</p>
        )}
      </div>

      {/* Label catégorie */}
      {!search && (
        <div className="px-3 py-1.5 border-t border-slate-200">
          <p className="text-[10px] uppercase tracking-widest text-[#94A3B8] font-semibold">{CATEGORIES[activeCategory].label}</p>
        </div>
      )}
    </div>
  );
}
