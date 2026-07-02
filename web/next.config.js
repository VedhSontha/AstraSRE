/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/orchestrator/:path*',
        destination: 'http://localhost:5010/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
