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
  'Прописываем сетевые настройки...',
  'Настраиваем антенны...',
  'Обновляем кэш...',
  'Готовим кофе...',
  'Подкручиваем позитив...',
]

// Размер истории последних сообщений для избежания повторений
const MAX_HISTORY_SIZE = Math.min(3, Math.floor(loadingMessages.length / 2))

interface LoadingOverlayProps {
  isLoading: boolean
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [currentMessage, setCurrentMessage] = React.useState<string>('')
  const [messageOpacity, setMessageOpacity] = React.useState(0)
  const [showError, setShowError] = React.useState(false)
  const [errorOpacity, setErrorOpacity] = React.useState(0)
  // Храним историю последних показанных сообщений для избежания повторений
  const messageHistoryRef = React.useRef<string[]>([])

  React.useEffect(() => {
    if (!isLoading) {
      setCurrentMessage('')
      setMessageOpacity(0)
      setShowError(false)
      setErrorOpacity(0)
      messageHistoryRef.current = []
      return
    }

    // Выбираем случайное сообщение, исключая последние показанные
    const getRandomMessage = (excludeMessages: string[] = []) => {
      const availableMessages = loadingMessages.filter(
        msg => !excludeMessages.includes(msg)
      )
      
      // Если все сообщения были недавно показаны, сбрасываем историю
      if (availableMessages.length === 0) {
        messageHistoryRef.current = []
        const randomIndex = Math.floor(Math.random() * loadingMessages.length)
        return loadingMessages[randomIndex]
      }
      
      const randomIndex = Math.floor(Math.random() * availableMessages.length)
      return availableMessages[randomIndex]
    }

    // Устанавливаем первое сообщение
    const firstMessage = getRandomMessage()
    setCurrentMessage(firstMessage)
    messageHistoryRef.current = [firstMessage]
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
        const newMessage = getRandomMessage(messageHistoryRef.current)
        setCurrentMessage(newMessage)
        
        // Обновляем историю: добавляем новое сообщение и ограничиваем размер истории
        messageHistoryRef.current = [
          ...messageHistoryRef.current.slice(-(MAX_HISTORY_SIZE - 1)),
          newMessage
        ]
        
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
        isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none invisible'
      )}
      style={isLoading ? { touchAction: 'none' } : undefined}
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
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/70 dark:bg-black/80 backdrop-blur-sm border border-border/30 rounded-lg p-4 w-[calc(100%-2rem)] sm:max-w-md sm:w-auto transition-all duration-500 ease-out"
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

