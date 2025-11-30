import React from 'react'
import { useRouter } from 'next/router'
import { Spinner } from '@/shared/ui/spinner'
import { cn } from '@/shared/utils'

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

const loadingMessages = [
  'Вайбкодим…',
  'Отменяем пары…',
  'Объезжаем пробки…',
  'Ищем замены…',
  'Ждем выходных…',
]

interface LoadingOverlayProps {
  isLoading: boolean
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [currentMessage, setCurrentMessage] = React.useState<string>('')
  const [messageOpacity, setMessageOpacity] = React.useState(0)
  const [showError, setShowError] = React.useState(false)
  const [errorOpacity, setErrorOpacity] = React.useState(0)

  React.useEffect(() => {
    if (!isLoading) {
      setCurrentMessage('')
      setMessageOpacity(0)
      setShowError(false)
      setErrorOpacity(0)
      return
    }

    // Выбираем случайное сообщение при старте загрузки
    const getRandomMessage = () => {
      const randomIndex = Math.floor(Math.random() * loadingMessages.length)
      return loadingMessages[randomIndex]
    }

    // Устанавливаем первое сообщение
    setCurrentMessage(getRandomMessage())
    setMessageOpacity(1)

    // Таймер для показа сообщения об ошибке после 5 секунд
    const errorTimeout = setTimeout(() => {
      setShowError(true)
      // Плавное появление с небольшой задержкой для анимации
      setTimeout(() => {
        setErrorOpacity(1)
      }, 50)
    }, 5000)

    // Меняем сообщение каждые 2 секунды
    const interval = setInterval(() => {
      // Fade out
      setMessageOpacity(0)
      
      // После fade out меняем сообщение и fade in
      setTimeout(() => {
        setCurrentMessage(getRandomMessage())
        setMessageOpacity(1)
      }, 300) // Длительность fade анимации
    }, 2000)

    return () => {
      clearInterval(interval)
      clearTimeout(errorTimeout)
    }
  }, [isLoading])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-md',
        'transition-opacity duration-300',
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-label="Загрузка"
      role="status"
      aria-hidden={!isLoading}
    >
      {isLoading && (
        <>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16">
              <Spinner size="large" />
            </div>
            <div 
              className="min-h-[1.5rem] text-center transition-opacity duration-300"
              style={{ opacity: messageOpacity }}
            >
              {currentMessage}
            </div>
          </div>
          {showError && (
            <div 
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-background/10 backdrop-blur-sm border border-border/30 rounded-lg p-4 max-w-md mx-4 transition-all duration-500 ease-out"
              style={{ 
                opacity: errorOpacity,
                transform: `translateX(-50%) translateY(${errorOpacity === 1 ? '0' : '100px'})`
              }}
            >
              <p className="text-sm text-foreground text-center">
                ⚠️ Не удается получить актуальное расписание с официального сайта. Возможно, сервер временно недоступен. Будут показаны данные из кэша. Попробуйте обновить страницу позже.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

