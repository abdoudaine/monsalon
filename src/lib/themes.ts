// ============================================================
// FICHIER : src/lib/themes.ts
// citron = Classique (NOIR sur BLANC pur, monochrome)
// cacao  = Studio (BLANC/NOIR + accent ROSE vif, style Freebie)
// Clés techniques inchangées → aucun SQL à refaire
// ============================================================

export type SalonTheme = 'luxe' | 'emeraude' | 'citron' | 'moutarde' | 'ocean' | 'cacao';

export interface ThemeConfig {
  name: string;
  description: string;
  bg: string;
  bgCard: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
  button: string;
  buttonText: string;
  gradient: string;
}

export const THEMES: Record<SalonTheme, ThemeConfig> = {
  luxe: {
    name: 'Luxe',
    description: 'Noir profond & Or — Élégance intemporelle',
    bg: 'bg-zinc-950', bgCard: 'bg-zinc-900', text: 'text-zinc-50',
    textMuted: 'text-zinc-400', accent: 'text-amber-400', border: 'border-zinc-800',
    button: 'bg-amber-500', buttonText: 'text-black',
    gradient: 'from-zinc-950 via-zinc-900 to-amber-950',
  },
  emeraude: {
    name: 'Émeraude',
    description: 'Émeraude & Or — Prestige audacieux',
    bg: 'bg-emerald-950', bgCard: 'bg-emerald-900', text: 'text-emerald-50',
    textMuted: 'text-emerald-300', accent: 'text-yellow-400', border: 'border-emerald-800',
    button: 'bg-yellow-500', buttonText: 'text-emerald-950',
    gradient: 'from-emerald-950 via-emerald-900 to-yellow-950',
  },
  citron: {
    name: 'Classique',
    description: 'Noir sur Blanc — Typographie pure, monochrome',
    bg: 'bg-white', bgCard: 'bg-neutral-50', text: 'text-neutral-950',
    textMuted: 'text-neutral-500', accent: 'text-neutral-950', border: 'border-neutral-200',
    button: 'bg-neutral-950', buttonText: 'text-white',
    gradient: 'from-white via-neutral-50 to-neutral-100',
  },
  moutarde: {
    name: 'Moutarde',
    description: 'Blanc & Jaune moutarde — Mode & Retail',
    bg: 'bg-white', bgCard: 'bg-yellow-50', text: 'text-neutral-950',
    textMuted: 'text-neutral-600', accent: 'text-yellow-600', border: 'border-yellow-200',
    button: 'bg-neutral-950', buttonText: 'text-white',
    gradient: 'from-white via-yellow-50 to-yellow-100',
  },
  ocean: {
    name: 'Océan',
    description: 'Blanc & Bleu royal — Tech & Automobile',
    bg: 'bg-white', bgCard: 'bg-blue-50', text: 'text-neutral-950',
    textMuted: 'text-neutral-600', accent: 'text-blue-600', border: 'border-blue-200',
    button: 'bg-blue-600', buttonText: 'text-white',
    gradient: 'from-white via-blue-50 to-blue-100',
  },
  cacao: {
    name: 'Studio',
    description: 'Blanc & Noir, accent Corail — E-commerce moderne',
    bg: 'bg-white', bgCard: 'bg-neutral-50', text: 'text-neutral-950',
    textMuted: 'text-neutral-600', accent: 'text-rose-500', border: 'border-neutral-200',
    button: 'bg-neutral-950', buttonText: 'text-white',
    gradient: 'from-white via-rose-50 to-rose-100',
  },
};

export interface ThemeInlineStyles {
  bg: string; bgCard: string; text: string; textMuted: string;
  accent: string; border: string; button: string; buttonText: string; gradient: string;
}

export const THEME_STYLES: Record<SalonTheme, ThemeInlineStyles> = {
  luxe: {
    bg: '#09090b', bgCard: '#18181b', text: '#fafafa', textMuted: '#a1a1aa',
    accent: '#fbbf24', border: '#27272a', button: '#f59e0b', buttonText: '#000000',
    gradient: 'linear-gradient(to bottom, #09090b, #18181b, #451a03)',
  },
  emeraude: {
    bg: '#022c22', bgCard: '#064e3b', text: '#ecfdf5', textMuted: '#6ee7b7',
    accent: '#facc15', border: '#065f46', button: '#eab308', buttonText: '#052e16',
    gradient: 'linear-gradient(to bottom, #022c22, #064e3b, #422006)',
  },
  citron: {
    bg: '#ffffff', bgCard: '#fafafa', text: '#000000', textMuted: '#525252',
    accent: '#000000', border: '#e5e5e5', button: '#000000', buttonText: '#ffffff',
    gradient: 'linear-gradient(to bottom, #ffffff, #fafafa, #f5f5f5)',
  },
  moutarde: {
    bg: '#ffffff', bgCard: '#fefce8', text: '#000000', textMuted: '#525252',
    accent: '#ca8a04', border: '#fef08a', button: '#000000', buttonText: '#ffffff',
    gradient: 'linear-gradient(to bottom, #ffffff, #fefce8, #fef9c3)',
  },
  ocean: {
    bg: '#ffffff', bgCard: '#eff6ff', text: '#000000', textMuted: '#475569',
    accent: '#2563eb', border: '#bfdbfe', button: '#2563eb', buttonText: '#ffffff',
    gradient: 'linear-gradient(to bottom, #ffffff, #eff6ff, #dbeafe)',
  },
  cacao: {
    bg: '#ffffff', bgCard: '#fafafa', text: '#000000', textMuted: '#525252',
    accent: '#f43f5e', border: '#e5e5e5', button: '#000000', buttonText: '#ffffff',
    gradient: 'linear-gradient(to bottom, #ffffff, #fff1f2, #ffe4e6)',
  },
};

export function getTheme(themeName: string | null | undefined): ThemeConfig {
  if (!themeName || !(themeName in THEMES)) return THEMES.luxe;
  return THEMES[themeName as SalonTheme];
}

export function getThemeStyles(themeName: string | null | undefined): ThemeInlineStyles {
  if (!themeName || !(themeName in THEME_STYLES)) return THEME_STYLES.luxe;
  return THEME_STYLES[themeName as SalonTheme];
}