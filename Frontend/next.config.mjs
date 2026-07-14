/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained production server (.next/standalone/server.js) for a lean
  // Docker image — see Frontend/Dockerfile + docs/DEPLOY-COOLIFY.md.
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.woodhouseherbals.com' },
      { protocol: 'https', hostname: 'r2.woodhouseherbals.com' },
      // Scoped to our cloud: res.cloudinary.com is multi-tenant, and a
      // whole-host allowance would let /_next/image proxy any tenant's images.
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/j5gjlpct/image/upload/**' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
