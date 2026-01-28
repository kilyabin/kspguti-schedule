import type { Day as DayType } from '@/shared/model/day'
import { Day } from '@/widgets/schedule/day'
import { WeekNavigation } from '@/widgets/schedule/week-navigation'
import { useRouter } from 'next/router'
import React from 'react'
import { getDayOfWeek } from '@/shared/utils'
import { WeekInfo } from '@/app/parser/schedule'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shadcn/ui/card'
import { CalendarX, AlertTriangle, X } from 'lucide-react'
import { ToastContainer, Toast } from '@/shared/ui/toast'
import { Badge } from '@/shadcn/ui/badge'
import { cn } from '@/shared/utils'

export function Schedule({ 
  days,
  currentWk,
  availableWeeks,
  weekNavigationEnabled = true,
  isFromCache,
  cacheAge,
  cacheInfo,
  hideTeacher = false
}: {
  days: DayType[]
  currentWk: number | null | undefined
  availableWeeks: WeekInfo[] | null | undefined
  weekNavigationEnabled?: boolean
  isFromCache?: boolean
  cacheAge?: number
  cacheInfo?: {
    size: number
    entries: number
  }
  hideTeacher?: boolean
}) {
  const group = useRouter().query['group']
  const hasScrolledRef = React.useRef(false)
  const [toasts, setToasts] = React.useState<Toast[]>([])
  
  // Определяем текущий номер недели из дней
  const currentWeekNumber = days.length > 0 ? days[0]?.weekNumber : undefined
  
  // Показываем toast при использовании кэша
  React.useEffect(() => {
    if (isFromCache) {
      const toastId = Date.now().toString()
      const cacheAgeText = cacheAge !== undefined 
        ? ` (возраст: ${cacheAge} ${cacheAge === 1 ? 'минута' : cacheAge < 5 ? 'минуты' : 'минут'})`
        : ''
      setToasts([{
        id: toastId,
        message: `Показаны данные из кэша${cacheAgeText}. Расписание может быть неактуальным.`,
        type: 'error'
      }])
    }
  }, [isFromCache, cacheAge])
  
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  // Компонент баннера предупреждения о кэше
  function CacheWarningBanner({ cacheAge, onClose }: { cacheAge?: number; onClose?: () => void }) {
    const [isVisible, setIsVisible] = React.useState(true)

    const handleClose = () => {
      setIsVisible(false)
      onClose?.()
    }

    if (!isVisible) return null

    const formatCacheAge = (minutes?: number) => {
      if (!minutes) return 'неизвестно'
      if (minutes < 60) return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'}`
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (hours < 24) {
        if (remainingMinutes === 0) {
          return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`
        }
        return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} ${remainingMinutes} ${remainingMinutes === 1 ? 'минуту' : remainingMinutes < 5 ? 'минуты' : 'минут'}`
      }
      const days = Math.floor(hours / 24)
      return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`
    }

    return (
      <div
        className={cn(
          'relative w-full rounded-lg border border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/30 backdrop-blur-sm',
          'p-4'
        )}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
              Возможна неактуальность расписания
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Не удалось получить актуальное расписание с официального сайта. 
              Показаны данные из кэша {cacheAge !== undefined && `(возраст: ${formatCacheAge(cacheAge)})`}.
              Расписание может быть устаревшим. Попробуйте обновить страницу позже.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 min-w-[24px] min-h-[24px] flex items-center justify-center text-amber-900 dark:text-amber-100"
            aria-label="Закрыть предупреждение"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  React.useEffect(() => {
    if (hasScrolledRef.current || typeof window === 'undefined') return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Находим текущий день
    const todayDay = days.find(day => {
      const dayDate = new Date(day.date)
      dayDate.setHours(0, 0, 0, 0)
      return dayDate.getTime() === today.getTime()
    })

    if (todayDay) {
      // Увеличиваем задержку, если используется кэш (баннер может рендериться позже)
      const delay = isFromCache ? 300 : 100
      
      const scrollToToday = () => {
        const elementId = getDayOfWeek(todayDay.date)
        const element = document.getElementById(elementId)
        
        if (element) {
          // Прокручиваем с отступом для sticky header
          const headerOffset = 100
          const elementPosition = element.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
          hasScrolledRef.current = true
          return true
        }
        return false
      }

      // Используем requestAnimationFrame для более точного ожидания рендеринга
      let timeoutId: NodeJS.Timeout | null = null
      let retryTimeoutId: NodeJS.Timeout | null = null
      
      const frameId = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          if (!scrollToToday() && isFromCache) {
            // Если не удалось найти элемент и используется кэш, пробуем еще раз через небольшую задержку
            retryTimeoutId = setTimeout(scrollToToday, 100)
          }
        }, delay)
      })

      return () => {
        cancelAnimationFrame(frameId)
        if (timeoutId) clearTimeout(timeoutId)
        if (retryTimeoutId) clearTimeout(retryTimeoutId)
      }
    }
  }, [days, isFromCache])

  // Проверка на пустое расписание
  const isEmpty = days.length === 0 || days.every(day => day.lessons.length === 0)

  return (
    <>
      <div className="flex flex-col p-4 md:p-8 lg:p-16 gap-6 md:gap-12 lg:gap-14">
        {isFromCache && (
          <CacheWarningBanner cacheAge={cacheAge} />
        )}
        {cacheInfo && (
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              Debug: Кэш содержит {cacheInfo.entries} {cacheInfo.entries === 1 ? 'запись' : cacheInfo.entries < 5 ? 'записи' : 'записей'}
            </Badge>
          </div>
        )}
        {weekNavigationEnabled && (
          <WeekNavigation 
            currentWk={currentWk}
            availableWeeks={availableWeeks}
            currentWeekNumber={currentWeekNumber}
          />
        )}
      {isEmpty ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="stagger-card max-w-md w-full">
            <CardHeader className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center text-muted-foreground">
                <CalendarX className="w-full h-full" strokeWidth={1.5} />
              </div>
              <CardTitle className="text-xl md:text-2xl">
                Расписание пусто
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base md:text-lg">
                Пар нет, либо расписание еще не заполнено
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (
        days.map((day, i) => (
          <div
            key={`${group}_day${i}`}
            className="stagger-card"
            style={{
              animationDelay: `${i * 0.1}s`,
            } as React.CSSProperties}
          >
            <Day day={day} hideTeacher={hideTeacher} />
          </div>
        ))
      )}
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
