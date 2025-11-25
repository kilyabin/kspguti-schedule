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
        <meta name="msapplication-TileColor" content="#bc7b7b" />
        <meta name="theme-color" content="#bc7b7b" />
        <meta name="apple-mobile-web-app-title" content="Расписание КС" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
