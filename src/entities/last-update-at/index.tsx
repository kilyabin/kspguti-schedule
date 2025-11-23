import React from 'react'
import { formatDistanceStrict } from 'date-fns'
import { ru as dateFnsRuLocale } from 'date-fns/locale'

export function LastUpdateAt({ date }: {
  date: Date
}) {
  const [now, setNow] = React.useState<number>()

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 10000)
    setNow(Date.now())
    return () => clearInterval(interval)
  }, [])

  return (
    <div className='flex md:justify-end px-2 md:px-4 md:h-0'>
      <span className='text-xs md:text-sm text-muted-foreground md:whitespace-pre-wrap md:text-right'>
        Последнее обновление:{'\n'}{now && date.getTime() <= now ? formatDistanceStrict(date, now, { locale: dateFnsRuLocale, addSuffix: true }) : 'только что'}
      </span>
    </div>
  )
}
