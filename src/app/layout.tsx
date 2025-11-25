import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  appleWebApp: {
    title: 'Расписание КС',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon1.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon0.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}

