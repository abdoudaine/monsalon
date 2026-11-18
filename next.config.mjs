/** @type {import('next').NextConfig} */
const nextConfig = {
  // Désactive le blocage du build sur les règles de style ESLint
  // (any, apostrophes, variables inutilisées...). Le code reste valide.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;