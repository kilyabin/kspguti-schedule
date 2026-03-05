import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <meta property="og:site_name" content="Расписание занятий в Колледже связи ПГУТИ" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon1.png" />
        <link rel="icon" type="image/svg+xml" href="/icon0.svg" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;600;700&family=Onest:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <meta name="msapplication-TileColor" content="#0d0f14" />
        <meta name="theme-color" content="#0d0f14" />
        <meta name="apple-mobile-web-app-title" content="Расписание КС" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
