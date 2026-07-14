/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained production server (.next/standalone/server.js) for a lean
  // Docker image — see Admin/Dockerfile + docs/DEPLOY-COOLIFY.md.
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Scoped to our cloud: res.cloudinary.com is multi-tenant, and a
      // whole-host allowance would let /_next/image proxy any tenant's images
      // (open image proxy + bandwidth-amplification DoS). Mirrors Frontend.
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/j5gjlpct/image/upload/**' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
