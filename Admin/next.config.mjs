/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained production server (.next/standalone/server.js) for a lean
  // Docker image — see Admin/Dockerfile + docs/DEPLOY-COOLIFY.md.
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
