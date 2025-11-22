import { Schedule } from '@/widgets/schedule'
import { Day } from '@/shared/model/day'
import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { getSchedule } from '@/app/agregator/schedule'
import { NextSerialized, nextDeserialized, nextSerialized } from '@/app/utils/date-serializer'
import { NavBar } from '@/widgets/navbar'
import { LastUpdateAt } from '@/entities/last-update-at'
import { loadGroups, GroupsData } from '@/shared/data/groups-loader'
import { SITE_URL } from '@/shared/constants/urls'
import crypto from 'crypto'
import React from 'react'
import { getDayOfWeek } from '@/shared/utils'
import Head from 'next/head'

type PageProps = {
  schedule: Day[]
  group: {
    id: string
    name: string
  }
  parsedAt: Date
  cacheAvailableFor: string[]
  groups: GroupsData
}

export default function HomePage(props: NextSerialized<PageProps>) {
  const { schedule, group, cacheAvailableFor, parsedAt, groups } = nextDeserialized<PageProps>(props)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    // Используем 'auto' для нормальной работы обновления страницы
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'auto'
    }

    // Отключаем автоматическую прокрутку на мобильных, чтобы избежать зависаний
    // Пользователь может прокрутить страницу вручную
    // Автоматическая прокрутка может блокировать рендеринг и вызывать зависания
  }, [])

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
      <Schedule days={schedule} />
    </>
  )
}

const cachedSchedules = new Map<string, { lastFetched: Date, results: Day[] }>()
const maxCacheDurationInMS = 1000 * 60 * 60
export async function getServerSideProps(context: GetServerSidePropsContext<{ group: string }>): Promise<GetServerSidePropsResult<NextSerialized<PageProps>>> {
  const groups = loadGroups()
  const group = context.params?.group
  if (group && Object.hasOwn(groups, group) && group in groups) {
    let schedule
    let parsedAt

    const cachedSchedule = cachedSchedules.get(group)
    if (cachedSchedule?.lastFetched && Date.now() - cachedSchedule.lastFetched.getTime() < maxCacheDurationInMS) {
      schedule = cachedSchedule.results
      parsedAt = cachedSchedule.lastFetched
    } else {
      try {
        const groupInfo = groups[group]
        schedule = await getSchedule(groupInfo.parseId, groupInfo.name)
        parsedAt = new Date()
        cachedSchedules.set(group, { lastFetched: new Date(), results: schedule })
      } catch(e) {
        if (cachedSchedule?.lastFetched) {
          schedule = cachedSchedule.results
          parsedAt = cachedSchedule.lastFetched
        } else {
          throw e
        }
      }
    }

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
      .map(([k]) => k)

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
        groups
      })
    }
  } else {
    return {
      notFound: true
    }
  }  
}