import { Schedule } from '@/widgets/schedule'
import { Day } from '@/shared/model/day'
import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { getSchedule, ScheduleResult, ScheduleTimeoutError } from '@/app/agregator/schedule'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shadcn/ui/card'
import { AlertCircle } from 'lucide-react'

type PageProps = {
  schedule?: Day[]
  group: {
    id: string
    name: string
  }
  parsedAt?: Date
  cacheAvailableFor: string[]
  groups: GroupsData
  currentWk?: number | null
  availableWeeks?: WeekInfo[] | null
  settings: AppSettings
  error?: {
    message: string
    isTimeout: boolean
  }
  isFromCache?: boolean
  cacheAge?: number // возраст кэша в минутах
  cacheInfo?: {
    size: number
    entries: number
  }
}

export default function HomePage(props: NextSerialized<PageProps>) {
  const { schedule, group, cacheAvailableFor, parsedAt, groups, currentWk, availableWeeks, settings, error, isFromCache, cacheAge, cacheInfo } = nextDeserialized<PageProps>(props)

  React.useEffect(() => {
    if (typeof window === 'undefined' || error) return

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
  }, [schedule, error])

  return (
    <>
      <Head>
        <title>{error ? `Ошибка — Расписание группы ${group.name}` : `Группа ${group.name} — Расписание занятий в Колледже Связи`}</title>
        <link rel="canonical" href={`${SITE_URL}/${group.id}`} />
        <meta name="description" content={error ? `Не удалось загрузить расписание группы ${group.name}` : `Расписание занятий группы ${group.name} на неделю в Колледже Связи ПГУТИ. Расписание пар, материалы для подготовки и изменения в расписании.`} />
        <meta property="og:title" content={error ? `Ошибка — Расписание группы ${group.name}` : `Группа ${group.name} — Расписание занятий в Колледже Связи`} />
        <meta property="og:description" content={error ? `Не удалось загрузить расписание группы ${group.name}` : `Расписание занятий группы ${group.name} на неделю в Колледже Связи ПГУТИ. Расписание пар, материалы для подготовки и изменения в расписании.`} />
      </Head>
      <NavBar cacheAvailableFor={cacheAvailableFor} groups={groups} />
      {error ? (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="stagger-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>Не удалось загрузить расписание</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base whitespace-pre-wrap">
                {error?.message || 'Произошла ошибка при загрузке расписания'}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {parsedAt && <LastUpdateAt date={parsedAt} />}
          {schedule && (
            <Schedule 
              days={schedule} 
              currentWk={currentWk ?? null} 
              availableWeeks={availableWeeks ?? null} 
              weekNavigationEnabled={settings.weekNavigationEnabled}
              isFromCache={isFromCache}
              cacheAge={cacheAge}
              cacheInfo={cacheInfo}
            />
          )}
        </>
      )}
    </>
  )
}

const cachedSchedules = new Map<string, { lastFetched: Date, results: ScheduleResult }>()
const maxCacheDurationInMS = 1000 * 60 * 15 // 15 минут для нормального использования кэша
const fallbackCacheDurationInMS = 1000 * 60 * 60 * 24 // 24 часа для fallback кэша при ошибках парсинга
const maxCacheSize = 50 // Максимальное количество записей в кэше (только текущие недели)

// Очистка старых записей из кэша
function cleanupCache() {
  const now = Date.now()
  const entriesToDelete: string[] = []
  
  // Находим устаревшие записи (используем fallback TTL для сохранения кэша при ошибках)
  for (const [key, value] of cachedSchedules.entries()) {
    if (now - value.lastFetched.getTime() >= fallbackCacheDurationInMS) {
      entriesToDelete.push(key)
    }
  }
  
  // Удаляем устаревшие записи
  entriesToDelete.forEach(key => cachedSchedules.delete(key))
  
  // Если кэш все еще слишком большой, удаляем самые старые записи
  if (cachedSchedules.size > maxCacheSize) {
    const sortedEntries = Array.from(cachedSchedules.entries())
      .sort((a, b) => a[1].lastFetched.getTime() - b[1].lastFetched.getTime())
    
    const toRemove = sortedEntries.slice(0, cachedSchedules.size - maxCacheSize)
    toRemove.forEach(([key]) => cachedSchedules.delete(key))
  }
}

export async function getServerSideProps(context: GetServerSidePropsContext<{ group: string }>): Promise<GetServerSidePropsResult<NextSerialized<PageProps>>> {
  // Используем кеш (обновляется каждую минуту автоматически)
  const groups = loadGroups()
  const settings = loadSettings()
  const group = context.params?.group
  const wkParam = context.query.wk
  // Валидация wk параметра: проверка на валидное число (не NaN, не Infinity)
  const wk = wkParam && !isNaN(Number(wkParam)) && isFinite(Number(wkParam)) && Number.isInteger(Number(wkParam)) && Number(wkParam) > 0
    ? Number(wkParam)
    : undefined
  
  if (group && Object.hasOwn(groups, group) && group in groups) {
    // Проверяем debug опции
    const debug = settings.debug || {}
    
    // Debug: принудительно показать ошибку
    if (debug.forceError) {
      const cacheAvailableFor = Array.from(cachedSchedules.entries())
        .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
        .map(([k]) => k.split('_')[0])
      
      return {
        props: nextSerialized({
          group: {
            id: group,
            name: groups[group].name
          },
          cacheAvailableFor,
          groups,
          settings,
          error: {
            message: 'Debug: принудительная ошибка',
            isTimeout: false
          }
        }) as NextSerialized<PageProps>
      }
    }
    
    // Debug: принудительно симулировать таймаут
    if (debug.forceTimeout) {
      const cacheAvailableFor = Array.from(cachedSchedules.entries())
        .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
        .map(([k]) => k.split('_')[0])
      
      return {
        props: nextSerialized({
          group: {
            id: group,
            name: groups[group].name
          },
          cacheAvailableFor,
          groups,
          settings,
          error: {
            message: 'Debug: принудительный таймаут',
            isTimeout: true
          }
        }) as NextSerialized<PageProps>
      }
    }
    
    let scheduleResult: ScheduleResult
    let parsedAt
    let isFromCache = false
    let cacheAge: number | undefined

    // Очищаем старые записи из кэша перед использованием
    cleanupCache()
    
    // Кэшируем только текущую неделю (без параметра wk)
    // Если запрашивается конкретная неделя (wk указан), не используем кэш
    const useCache = !wk
    const cacheKey = group // Ключ кэша - только группа (текущая неделя)
    const cachedSchedule = useCache ? cachedSchedules.get(cacheKey) : undefined
    
    // Debug: принудительно использовать кэш
    if (debug.forceCache && cachedSchedule) {
      scheduleResult = cachedSchedule.results
      parsedAt = cachedSchedule.lastFetched
      isFromCache = true
      const cacheAgeMs = Date.now() - cachedSchedule.lastFetched.getTime()
      cacheAge = Math.floor(cacheAgeMs / (1000 * 60))
    } else if (cachedSchedule?.lastFetched && Date.now() - cachedSchedule.lastFetched.getTime() < maxCacheDurationInMS) {
      scheduleResult = cachedSchedule.results
      parsedAt = cachedSchedule.lastFetched
    } else {
      try {
        const groupInfo = groups[group]
        // Передаем настройки в getSchedule для условного парсинга навигации
        scheduleResult = await getSchedule(groupInfo.parseId, groupInfo.name, wk, settings.weekNavigationEnabled)
        parsedAt = new Date()
        
        // Кэшируем только текущую неделю
        if (useCache) {
          cachedSchedules.set(cacheKey, { lastFetched: new Date(), results: scheduleResult })
          // Очищаем кэш после добавления новой записи, если он стал слишком большим
          cleanupCache()
        }
      } catch(e) {
        // При таймауте или любой другой ошибке используем кэш, если он доступен (fallback кэш)
        // Используем кэш независимо от возраста при ошибке парсинга
        if (cachedSchedule) {
          scheduleResult = cachedSchedule.results
          parsedAt = cachedSchedule.lastFetched
          isFromCache = true
          const cacheAgeMs = Date.now() - cachedSchedule.lastFetched.getTime()
          cacheAge = Math.floor(cacheAgeMs / (1000 * 60))
          // Логируем использование fallback кэша с указанием возраста
          if (e instanceof ScheduleTimeoutError) {
            console.warn(`Schedule fetch timeout for group ${group}, using fallback cache from ${cachedSchedule.lastFetched.toISOString()} (${cacheAge} minutes old)`)
          } else {
            console.warn(`Schedule fetch error for group ${group}, using fallback cache from ${cachedSchedule.lastFetched.toISOString()} (${cacheAge} minutes old)`)
          }
        } else {
          // Если кэша нет, возвращаем страницу с ошибкой вместо throw
          const isTimeout = e instanceof ScheduleTimeoutError
          const errorMessageObj = e instanceof Error ? e : new Error(String(e))
          const isSSLError = errorMessageObj.message?.includes('колледже что-то сломалось') || 
                            errorMessageObj.message?.includes('SSL сертификата') || 
                            errorMessageObj.message?.includes('self-signed certificate') ||
                            errorMessageObj.message?.includes('certificate') ||
                            (errorMessageObj.cause instanceof Error && (
                              (errorMessageObj.cause as any).code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                              errorMessageObj.cause.message?.includes('self-signed certificate')
                            ))
          
          // Если ошибка уже содержит нужное сообщение, используем его напрямую
          let errorMessage: string
          if (isTimeout) {
            errorMessage = 'Превышено время ожидания ответа от сервера'
          } else if (isSSLError || errorMessageObj.message?.includes('колледже что-то сломалось')) {
            errorMessage = 'В колледже что-то сломалось (проблема с сертификатом безопасности). Здесь я бессилен, проблема не на моей стороне.'
          } else {
            errorMessage = errorMessageObj.message || 'Произошла ошибка при загрузке расписания'
          }
          
          console.error(`Schedule fetch failed for group ${group}, no cache available:`, e)
          console.error(`Error message: ${errorMessage}`)
          
          const cacheAvailableFor = Array.from(cachedSchedules.entries())
            .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
            .map(([k]) => k.split('_')[0])
          
          return {
            props: nextSerialized({
              group: {
                id: group,
                name: groups[group].name
              },
              cacheAvailableFor,
              groups,
              settings,
              error: {
                message: errorMessage,
                isTimeout
              }
            }) as NextSerialized<PageProps>
          }
        }
      }
    }
    
    // Debug: принудительно показать пустое расписание
    if (debug.forceEmpty) {
      scheduleResult = {
        days: [],
        currentWk: scheduleResult.currentWk,
        availableWeeks: scheduleResult.availableWeeks
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

    // Debug: информация о кэше
    const cacheInfo = debug.showCacheInfo ? {
      size: cachedSchedules.size,
      entries: cachedSchedules.size
    } : undefined

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
        settings,
        isFromCache: isFromCache ?? false,
        cacheAge: cacheAge ?? null,
        cacheInfo: cacheInfo ?? null
      }) as NextSerialized<PageProps>
    }
  } else {
    return {
      notFound: true
    }
  }  
}