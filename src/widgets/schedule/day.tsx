import React from 'react'
import type { Day as DayType } from '@/shared/model/day'
import { getDayOfWeek } from '@/shared/utils'
import { Lesson } from '@/widgets/schedule/lesson'
import { cx } from 'class-variance-authority'

export function Day({ day }: {
  day: DayType
}) {
  const dayOfWeek = [
    'Понедельник', 
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
    'Воскресенье'
  ][(day.date.getDay() + 6) % 7]

  const longNames = day.lessons
    .some(lesson => 'subject' in lesson && lesson.subject.length > 20)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayDate = new Date(day.date)
  dayDate.setHours(0, 0, 0, 0)
  const dayPassed = dayDate.getTime() < today.getTime()
  const isToday = dayDate.getTime() === today.getTime()

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <h2 className={cx('scroll-m-20 text-xl md:text-2xl lg:text-4xl font-extrabold tracking-tight', { 
        'text-[hsl(var(--grayed-out))]': dayPassed,
        'text-foreground': isToday,
        'text-muted-foreground': !dayPassed && !isToday
      })} id={getDayOfWeek(day.date)}>
        {dayOfWeek} <span className={cx('ml-2 md:ml-3', { 
          'text-border': isToday,
          'text-muted-foreground/70': !dayPassed && !isToday
        })}>{Intl.DateTimeFormat('ru-RU', {
          day: 'numeric',
          month: 'long',
          // year: 'numeric'
        }).format(day.date)}</span>
      </h2>
      <div>
        <div className='overflow-x-hidden md:overflow-x-auto md:snap-x md:snap-proximity md:-translate-x-16 md:w-[calc(100%+8rem)] scrollbar-hide'>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-max">
            <div className='snap-start hidden md:block' style={{ flex: '0 0 3rem' }} />
            {day.lessons.map((lesson, i) => (
              <Lesson 
                key={i}
                width={longNames ? 450 : 350}
                lesson={lesson}
                animationDelay={i * 0.08}
              />
            ))}
            <div className='snap-start hidden md:block' style={{ flex: `0 0 calc(100vw - 4rem - ${longNames ? 450 : 350}px - 1rem)` }} />
          </div>
        </div>
      </div>
    </div>
  )
}