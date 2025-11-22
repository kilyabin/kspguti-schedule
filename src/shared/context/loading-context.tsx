import React from 'react'
import { useRouter } from 'next/router'

interface LoadingContextType {
  isLoading: boolean
}

export const LoadingContext = React.createContext<LoadingContextType>({
  isLoading: false,
})

export function LoadingContextProvider({ children }: React.PropsWithChildren) {
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const handleRouteChangeStart = () => {
      setIsLoading(true)
    }

    const handleRouteChangeComplete = () => {
      setIsLoading(false)
    }

    const handleRouteChangeError = () => {
      setIsLoading(false)
    }

    router.events.on('routeChangeStart', handleRouteChangeStart)
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    router.events.on('routeChangeError', handleRouteChangeError)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
      router.events.off('routeChangeError', handleRouteChangeError)
    }
  }, [router])

  return (
    <LoadingContext.Provider value={{ isLoading }}>
      {children}
    </LoadingContext.Provider>
  )
}

