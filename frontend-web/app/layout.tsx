import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Serif éditorial (esthétique Claude) — pour les titres
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saturn",
  description: "Messagerie temps réel",
};

// Anti-FOUC : applique le thème mémorisé avant le premier paint.
// ⚠️ Les palettes ci-dessous doivent refléter store/themeStore.ts
const themeBootstrap = `(function(){try{
var raw=localStorage.getItem('saturn-theme');
var st=raw?(JSON.parse(raw).state||{}):{};var theme=st.theme||'amber';var accent=st.accent||'amber';
var T={
amber:['#F5F4EE','#EFEDE4','#FBFAF7','#FBFAF7','#EDEBE2','#E4E1D6','rgba(245,244,238,0.85)','rgba(120,90,60,0.14)','rgba(60,52,40,0.10)','rgba(60,52,40,0.16)','#2B2A27','#6B655C','#9C968B',0],
light:['#F8FAFC','#FFFFFF','#FFFFFF','#FFFFFF','#F1F5F9','#E2E8F0','rgba(255,255,255,0.88)','rgba(37,99,235,0.12)','rgba(30,41,59,0.08)','rgba(30,41,59,0.14)','#1E293B','#64748B','#94A3B8',0],
dark:['#0B0F19','#0F1623','#131C2B','#131C2B','#1C2638','#243044','rgba(19,28,43,0.85)','rgba(255,255,255,0.08)','rgba(255,255,255,0.07)','rgba(255,255,255,0.12)','#E8EDF5','#94A3B8','#64748B',1],
midnight:['#0B0A1A','#110F26','#161334','#161334','#1F1A45','#2A2356','rgba(22,19,52,0.85)','rgba(124,58,237,0.18)','rgba(150,130,255,0.10)','rgba(150,130,255,0.18)','#EAE6FF','#A99FD6','#6E649E',1],
solarized:['#002029','#002B36','#073642','#073642','#0A4351','#0E5160','rgba(7,54,66,0.85)','rgba(147,161,161,0.18)','rgba(147,161,161,0.12)','rgba(147,161,161,0.20)','#FDF6E3','#93A1A1','#657B83',1],
forest:['#0A1A0A','#0D1F0D','#142114','#142114','#1B2E1B','#233B23','rgba(20,33,20,0.85)','rgba(80,160,80,0.18)','rgba(80,160,80,0.12)','rgba(80,160,80,0.20)','#E8F5E8','#8FB98F','#5E835E',1]};
var A={amber:['#C17629','#D48E45','rgba(193,118,41,0.22)'],clay:['#C96442','#DA8A6A','rgba(201,100,66,0.22)'],blue:['#2563EB','#60A5FA','rgba(37,99,235,0.22)'],purple:['#7C3AED','#A78BFA','rgba(124,58,237,0.22)'],green:['#10B981','#34D399','rgba(16,185,129,0.22)'],red:['#EF4444','#F97316','rgba(239,68,68,0.22)'],orange:['#F97316','#EAB308','rgba(249,115,22,0.22)'],pink:['#EC4899','#F43F5E','rgba(236,72,153,0.22)']};
var t=T[theme]||T.amber,a=A[accent]||A.amber,s=document.documentElement.style,P=function(k,v){s.setProperty(k,v)};
P('--sat-void',t[0]);P('--sat-main',t[0]);P('--sat-sidebar',t[1]);P('--sat-panel',t[2]);P('--sat-surface',t[3]);P('--sat-hover',t[4]);P('--sat-active',t[5]);P('--sat-glass',t[6]);P('--sat-glass-border',t[7]);P('--sat-border',t[8]);P('--sat-border-2',t[9]);P('--sat-text',t[10]);P('--sat-muted',t[11]);P('--sat-faint',t[12]);
P('--bg',t[0]);P('--surface',t[3]);P('--border',t[8]);P('--text',t[10]);P('--muted',t[11]);
P('--sat-accent',a[0]);P('--sat-accent2',a[1]);P('--sat-accent3',a[1]);P('--sat-accent-glow',a[2]);P('--accent',a[0]);P('--accent2',a[1]);P('--accent-hex',a[0]);
P('--logo-invert',t[13]?'0':'1');
s.colorScheme=t[13]?'dark':'light';
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${jakarta.variable} ${newsreader.variable} antialiased`} style={{ color: 'var(--sat-text)' }}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
