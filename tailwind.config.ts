/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette Gentlemen (Cuir, Noir, Or)
        gentlemen: {
          bg: '#0A0A0A',         // Noir profond mat (fond global)
          card: '#141414',       // Noir légèrement plus clair (cartes)
          leather: '#1A120B',    // Brun cuir très foncé (sidebar)
          leatherLight: '#2C1E12', // Brun cuir plus clair (dégradé)
          gold: '#D4AF37',       // Or classique
          goldLight: '#F4D03F',  // Or clair (accents, icônes)
          text: '#F5F5F5',       // Blanc cassé (texte principal)
          muted: '#9CA3AF',      // Gris clair (texte secondaire)
        },
        // On garde les thèmes des salons pour plus tard
        luxe: { 500: '#D4AF37' },
        urban: { 500: '#FFFFFF' },
        classique: { 500: '#8B6F3A' },
        dark: { 500: '#4B5563' },
        rose_gold: { 500: '#E65274' },
        vibrant: { 500: '#8B5CF6' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(212, 175, 55, 0.15)',
        'gold-glow-hover': '0 0 25px rgba(212, 175, 55, 0.3)',
      },
    },
  },
  plugins: [],
}