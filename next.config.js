/** @type {import('next').NextConfig} */
const path = require('path')

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
    
    // Явно настраиваем resolve alias для path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    }
    
    return config
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
