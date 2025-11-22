import { Schedule } from '@/widgets/schedule'
import { Day } from '@/shared/model/day'
import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { getSchedule, ScheduleResult } from '@/app/agregator/schedule'
import { NextSerialized, nextDeserialized, nextSerialized } from '@/app/utils/date-serializer'
import { NavBar } from '@/widgets/navbar'
import { LastUpdateAt } from '@/entities/last-update-at'
import { loadGroups, GroupsData } from '@/shared/data/groups-loader'
import { loadSettings, AppSettings } from '@/shared/data/settings-loader'
import { SITE_URL } from '@/shared/constants/urls'
import crypto from 'crypto'
import React from 'react'
import { getDayOfWeek } from '@/shared/utils'
import Head from 'next/head'
import { WeekInfo } from '@/app/parser/schedule'

type PageProps = {
  schedule: Day[]
  group: {
    id: string
    name: string
  }
  parsedAt: Date
  cacheAvailableFor: string[]
  groups: GroupsData
  currentWk: number | null
  availableWeeks: WeekInfo[] | null
  settings: AppSettings
}

export default function HomePage(props: NextSerialized<PageProps>) {
  const { schedule, group, cacheAvailableFor, parsedAt, groups, currentWk, availableWeeks, settings } = nextDeserialized<PageProps>(props)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    // Используем 'auto' для нормальной работы обновления страницы
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'auto'
    }

    let attempts = 0
    const MAX_ATTEMPTS = 50 // Максимум 5 секунд (50 * 100ms)

    const interval = setInterval(() => {
      attempts++
      const today = getDayOfWeek(new Date())
      const todayBlock = document.getElementById(today)
      
      if (todayBlock) {
        const GAP = 48
        const HEADER_HEIGHT = 64
        window.scrollTo({ top: todayBlock.offsetTop - GAP - HEADER_HEIGHT, behavior: 'smooth' })
        clearInterval(interval)
      } else if (attempts >= MAX_ATTEMPTS) {
        // Прекращаем попытки после максимального количества
        clearInterval(interval)
      }
    }, 100)

    // Cleanup функция для очистки интервала при размонтировании
    return () => {
      clearInterval(interval)
    }
  }, [schedule])

  return (
    <>
      <Head>
        <title>{`Группа ${group.name} — Расписание занятий в Колледже Связи`}</title>
        <link rel="canonical" href={`${SITE_URL}/${group.id}`} />
        <meta name="description" content={`Расписание занятий группы ${group.name} на неделю в Колледже Связи ПГУТИ. Расписание пар, материалы для подготовки и изменения в расписании.`} />
        <meta property="og:title" content={`Группа ${group.name} — Расписание занятий в Колледже Связи`} />
        <meta property="og:description" content={`Расписание занятий группы ${group.name} на неделю в Колледже Связи ПГУТИ. Расписание пар, материалы для подготовки и изменения в расписании.`} />
      </Head>
      <NavBar cacheAvailableFor={cacheAvailableFor} groups={groups} />
      <LastUpdateAt date={parsedAt} />
      <Schedule days={schedule} currentWk={currentWk} availableWeeks={availableWeeks} weekNavigationEnabled={settings.weekNavigationEnabled} />
    </>
  )
}

const cachedSchedules = new Map<string, { lastFetched: Date, results: ScheduleResult }>()
const maxCacheDurationInMS = 1000 * 60 * 60
export async function getServerSideProps(context: GetServerSidePropsContext<{ group: string }>): Promise<GetServerSidePropsResult<NextSerialized<PageProps>>> {
  const groups = loadGroups()
  const settings = loadSettings()
  const group = context.params?.group
  const wkParam = context.query.wk
  const wk = wkParam ? Number(wkParam) : undefined
  
  if (group && Object.hasOwn(groups, group) && group in groups) {
    let scheduleResult: ScheduleResult
    let parsedAt

    // Ключ кэша включает группу и неделю
    const cacheKey = wk ? `${group}_${wk}` : group
    const cachedSchedule = cachedSchedules.get(cacheKey)
    
    if (cachedSchedule?.lastFetched && Date.now() - cachedSchedule.lastFetched.getTime() < maxCacheDurationInMS) {
      scheduleResult = cachedSchedule.results
      parsedAt = cachedSchedule.lastFetched
    } else {
      try {
        const groupInfo = groups[group]
        scheduleResult = await getSchedule(groupInfo.parseId, groupInfo.name, wk)
        parsedAt = new Date()
        cachedSchedules.set(cacheKey, { lastFetched: new Date(), results: scheduleResult })
      } catch(e) {
        if (cachedSchedule?.lastFetched) {
          scheduleResult = cachedSchedule.results
          parsedAt = cachedSchedule.lastFetched
        } else {
          throw e
        }
      }
    }
    
    const schedule = scheduleResult.days

    const getSha256Hash = (input: string) => {
      const hash = crypto.createHash('sha256')
      hash.update(input)
      return hash.digest('hex')
    }

    const etag = getSha256Hash(JSON.stringify(nextSerialized(schedule)))

    const ifNoneMatch = context.req.headers['if-none-match']
    if (ifNoneMatch === etag) {
      context.res.writeHead(304, { ETag: `"${etag}"` })
      context.res.end()
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Content has not changed
      return { props: {} }
    }

    const cacheAvailableFor = Array.from(cachedSchedules.entries())
      .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
      .map(([k]) => k.split('_')[0]) // Берем только группу из ключа кэша

    context.res.setHeader('ETag', `"${etag}"`)
    return {
      props: nextSerialized({
        schedule: schedule,
        parsedAt: parsedAt,
        group: {
          id: group,
          name: groups[group].name
        },
        cacheAvailableFor,
        groups,
        currentWk: scheduleResult.currentWk ?? null,
        availableWeeks: scheduleResult.availableWeeks ?? null,
        settings
      })
    }
  } else {
    return {
      notFound: true
    }
  }  
}