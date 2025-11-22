/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  generateEtags: false,
  allowedDevOrigins: ['192.168.1.10']
}

module.exports = nextConfig
