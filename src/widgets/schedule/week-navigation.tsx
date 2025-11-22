import React from 'react'
import { useRouter } from 'next/router'
import { Button } from '@/shadcn/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WeekInfo } from '@/app/parser/schedule'

export function WeekNavigation({ 
  currentWk, 
  availableWeeks,
  currentWeekNumber 
}: {
  currentWk: number | null | undefined
  availableWeeks: WeekInfo[] | null | undefined
  currentWeekNumber?: number
}) {
  const router = useRouter()
  const group = router.query.group as string

  if (!availableWeeks || availableWeeks.length === 0) {
    return null
  }

  // Находим текущую неделю в списке
  const currentIndex = currentWk 
    ? availableWeeks.findIndex(w => w.wk === currentWk)
    : currentWeekNumber
      ? availableWeeks.findIndex(w => w.weekNumber === currentWeekNumber)
      : -1

  const currentWeek = currentIndex >= 0 ? availableWeeks[currentIndex] : availableWeeks[0]
  const prevWeek = currentIndex > 0 ? availableWeeks[currentIndex - 1] : null
  const nextWeek = currentIndex >= 0 && currentIndex < availableWeeks.length - 1 
    ? availableWeeks[currentIndex + 1] 
    : null

  const navigateToWeek = (wk: number) => {
    router.push({
      pathname: `/${group}`,
      query: { wk }
    }, undefined, { scroll: false })
  }

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-background/50 rounded-lg border">
      <Button
        variant="outline"
        size="icon"
        onClick={() => prevWeek && navigateToWeek(prevWeek.wk)}
        disabled={!prevWeek}
        aria-label="Предыдущая неделя"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="text-center min-w-[120px]">
        <div className="text-sm font-medium">
          {currentWeek ? `Неделя ${currentWeek.weekNumber}` : 'Неделя'}
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => nextWeek && navigateToWeek(nextWeek.wk)}
        disabled={!nextWeek}
        aria-label="Следующая неделя"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

