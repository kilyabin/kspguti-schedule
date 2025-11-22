import type { Day as DayType } from '@/shared/model/day'
import { Day } from '@/widgets/schedule/day'
import { WeekNavigation } from '@/widgets/schedule/week-navigation'
import { useRouter } from 'next/router'
import React from 'react'
import { getDayOfWeek } from '@/shared/utils'
import { WeekInfo } from '@/app/parser/schedule'

export function Schedule({ 
  days,
  currentWk,
  availableWeeks,
  weekNavigationEnabled = true
}: {
  days: DayType[]
  currentWk: number | null | undefined
  availableWeeks: WeekInfo[] | null | undefined
  weekNavigationEnabled?: boolean
}) {
  const group = useRouter().query['group']
  const hasScrolledRef = React.useRef(false)
  
  // Определяем текущий номер недели из дней
  const currentWeekNumber = days.length > 0 ? days[0]?.weekNumber : undefined

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
      // Небольшая задержка для завершения рендеринга
      const timeoutId = setTimeout(() => {
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
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [days])

  return (
    <div className="flex flex-col p-4 md:p-8 lg:p-16 gap-6 md:gap-12 lg:gap-14">
      {weekNavigationEnabled && (
        <WeekNavigation 
          currentWk={currentWk}
          availableWeeks={availableWeeks}
          currentWeekNumber={currentWeekNumber}
        />
      )}
      {days.map((day, i) => (
        <div
          key={`${group}_day${i}`}
          className="stagger-card"
          style={{
            animationDelay: `${i * 0.1}s`,
          } as React.CSSProperties}
        >
          <Day day={day} />
        </div>
      ))}
    </div>
  )
}
