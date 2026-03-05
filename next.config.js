/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  generateEtags: false,
  allowedDevOrigins: ['192.168.1.10'],
  webpack: (config, { isServer }) => {
    // Исключаем fs и path из клиентской сборки
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }
    return config
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
