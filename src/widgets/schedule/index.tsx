import type { Day as DayType } from '@/shared/model/day'
import { Day } from '@/widgets/schedule/day'
import { useRouter } from 'next/router'
import React from 'react'
import { getDayOfWeek } from '@/shared/utils'

export function Schedule({ days }: {
  days: DayType[]
}) {
  const group = useRouter().query['group']
  const hasScrolledRef = React.useRef(false)

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
      {days.map((day, i) => (
        <Day day={day} key={`${group}_day${i}`} />
      ))}
    </div>
  )
}
