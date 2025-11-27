import '@/shared/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/shared/providers/theme-provider'
import { LoadingContextProvider, LoadingContext, LoadingOverlay } from '@/shared/context/loading-context'
import Head from 'next/head'
import React from 'react'

function AppContent({ Component, pageProps }: AppProps) {
  const { isLoading } = React.useContext(LoadingContext)

  return (
    <>
      <div className="page-transition-wrapper">
        <Component {...pageProps} />
      </div>
      <LoadingOverlay isLoading={isLoading} />
    </>
  )
}

export default function App(props: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </Head>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <LoadingContextProvider>
          <AppContent {...props} />
        </LoadingContextProvider>
      </ThemeProvider>
    </>
  )
}
