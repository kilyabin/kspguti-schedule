/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  redirects: async () => [{
    permanent: false,
    destination: '/ps7',
    source: '/'
  }],
  generateEtags: false
}

module.exports = nextConfig
