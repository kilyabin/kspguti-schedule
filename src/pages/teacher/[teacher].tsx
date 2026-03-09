import { Schedule } from '@/widgets/schedule'
import { Day } from '@/shared/model/day'
import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { getTeacherSchedule, ScheduleResult, ScheduleTimeoutError } from '@/app/agregator/schedule'
import { NextSerialized, nextDeserialized, nextSerialized } from '@/app/utils/date-serializer'
import { NavBar } from '@/widgets/navbar'
import { LastUpdateAt } from '@/entities/last-update-at'
import { loadGroups, GroupsData } from '@/shared/data/groups-loader'
import { loadSettings, AppSettings } from '@/shared/data/settings-loader'
import { getTeacherByParseId } from '@/shared/data/database'
import { SITE_URL } from '@/shared/constants/urls'
import crypto from 'crypto'
import React from 'react'
import { getDayOfWeek } from '@/shared/utils'
import Head from 'next/head'
import { WeekInfo } from '@/app/parser/schedule'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shadcn/ui/card'
import { Button } from '@/shadcn/ui/button'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

type PageProps = {
  schedule?: Day[]
  teacher: {
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

export default function TeacherPage(props: NextSerialized<PageProps>) {
  const { schedule, teacher, cacheAvailableFor, parsedAt, groups, currentWk, availableWeeks, settings, error, isFromCache, cacheAge, cacheInfo } = nextDeserialized<PageProps>(props)

  React.useEffect(() => {
    if (typeof window === 'undefined' || error) return

    // Используем 'auto' для нормальной работы обновления страницы
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'auto'
    }
  }, [error])

  return (
    <>
      <Head>
        <title>{error ? `Ошибка — Расписание преподавателя ${teacher.name}` : `Преподаватель ${teacher.name} — Расписание занятий в Колледже Связи`}</title>
        <link rel="canonical" href={`${SITE_URL}/teacher/${teacher.id}`} />
        <meta name="description" content={error ? `Не удалось загрузить расписание преподавателя ${teacher.name}` : `Расписание занятий преподавателя ${teacher.name} на неделю в Колледже Связи ПГУТИ. Расписание пар, материалы для подготовки и изменения в расписании.`} />
        <meta property="og:title" content={error ? `Ошибка — Расписание преподавателя ${teacher.name}` : `Преподаватель ${teacher.name} — Расписание занятий в Колледже Связи`} />
        <meta property="og:description" content={error ? `Не удалось загрузить расписание преподавателя ${teacher.name}` : `Расписание занятий преподавателя ${teacher.name} на неделю в Колледже Связи ПГУТИ. Расписание пар, материалы для подготовки и изменения в расписании.`} />
      </Head>
      <NavBar cacheAvailableFor={cacheAvailableFor} groups={groups} isTeacherPage={true} />
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
              <CardDescription className="text-base">
                {error.isTimeout 
                  ? 'Превышено время ожидания ответа от сервера при загрузке расписания преподавателя. Пожалуйста, попробуйте обновить страницу через несколько минут.'
                  : `Не удалось загрузить расписание преподавателя ${teacher.name}. Возможно, расписание временно недоступно или произошла ошибка на сервере. Пожалуйста, попробуйте обновить страницу позже или вернитесь к списку преподавателей.`}
              </CardDescription>
              <div className="mt-4">
                <Link href="/teachers">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Вернуться к списку преподавателей
                  </Button>
                </Link>
              </div>
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
              hideTeacher={true}
            />
          )}
        </>
      )}
    </>
  )
}

const cachedTeacherSchedules = new Map<string, { lastFetched: Date, results: ScheduleResult }>()
const maxCacheDurationInMS = 1000 * 60 * 15 // 15 минут
const fallbackCacheDurationInMS = 1000 * 60 * 60 * 24 // 24 часа
const maxCacheSize = 50 // Максимальное количество записей в кэше

// Очистка старых записей из кэша
function cleanupCache() {
  const now = Date.now()
  const entriesToDelete: string[] = []

  // Находим устаревшие записи
  for (const [key, value] of cachedTeacherSchedules.entries()) {
    if (now - value.lastFetched.getTime() >= fallbackCacheDurationInMS) {
      entriesToDelete.push(key)
    }
  }
  
  // Удаляем устаревшие записи
  entriesToDelete.forEach(key => cachedTeacherSchedules.delete(key))
  
  // Если кэш все еще слишком большой, удаляем самые старые записи
  if (cachedTeacherSchedules.size > maxCacheSize) {
    const sortedEntries = Array.from(cachedTeacherSchedules.entries())
      .sort((a, b) => a[1].lastFetched.getTime() - b[1].lastFetched.getTime())
    
    const toRemove = sortedEntries.slice(0, cachedTeacherSchedules.size - maxCacheSize)
    toRemove.forEach(([key]) => cachedTeacherSchedules.delete(key))
  }
}

export async function getServerSideProps(context: GetServerSidePropsContext<{ teacher: string }>): Promise<GetServerSidePropsResult<NextSerialized<PageProps>>> {
  const groups = await loadGroups()
  const settings = loadSettings()
  const teacherParam = context.params?.teacher
  const wkParam = context.query.wk
  // Валидация wk параметра: проверка на валидное число (не NaN, не Infinity)
  const wk = wkParam && !isNaN(Number(wkParam)) && isFinite(Number(wkParam)) && Number.isInteger(Number(wkParam)) && Number(wkParam) > 0
    ? Number(wkParam)
    : undefined
  
  // Валидация teacher параметра: должен быть числом (parseId)
  const teacherParseId = teacherParam && !isNaN(Number(teacherParam)) && isFinite(Number(teacherParam)) && Number.isInteger(Number(teacherParam)) && Number(teacherParam) > 0
    ? Number(teacherParam)
    : null
  
  if (!teacherParseId) {
    return {
      notFound: true
    }
  }

  const teacherInfo = getTeacherByParseId(teacherParseId)
  if (!teacherInfo) {
    return {
      notFound: true
    }
  }

  const debug = settings.debug || {}

  // Debug: принудительно показать ошибку
  if (debug.forceError) {
    const cacheAvailableFor = Array.from(cachedTeacherSchedules.entries())
      .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
      .map(([k]) => k.split('_')[0])
    
    return {
      props: nextSerialized({
        teacher: {
          id: teacherInfo.id,
          name: teacherInfo.name
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
  
  // Debug: симулировать таймаут
  if (debug.forceTimeout) {
    const cacheAvailableFor = Array.from(cachedTeacherSchedules.entries())
      .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
      .map(([k]) => k.split('_')[0])
    
    return {
      props: nextSerialized({
        teacher: {
          id: teacherInfo.id,
          name: teacherInfo.name
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
  const cacheKey = `teacher_${teacherParseId}` // Ключ кэша для преподавателя
  const cachedSchedule = useCache ? cachedTeacherSchedules.get(cacheKey) : undefined
  
  // Debug: использовать кэш
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
      // Передаем настройки в getTeacherSchedule для условного парсинга навигации
      scheduleResult = await getTeacherSchedule(teacherParseId, teacherInfo.name, wk, settings.weekNavigationEnabled)
      parsedAt = new Date()
      
      // Кэшируем только текущую неделю
      if (useCache) {
        cachedTeacherSchedules.set(cacheKey, { lastFetched: new Date(), results: scheduleResult })
        // Очищаем кэш после добавления новой записи, если он стал слишком большим
        cleanupCache()
      }
    } catch(e) {
      // При ошибке используем кэш, если он доступен
      if (cachedSchedule) {
        scheduleResult = cachedSchedule.results
        parsedAt = cachedSchedule.lastFetched
        isFromCache = true
        const cacheAgeMs = Date.now() - cachedSchedule.lastFetched.getTime()
        cacheAge = Math.floor(cacheAgeMs / (1000 * 60))
        // Логируем использование fallback кэша с указанием возраста
        if (e instanceof ScheduleTimeoutError) {
          console.warn(`Schedule fetch timeout for teacher ${teacherInfo.name}, using fallback cache from ${cachedSchedule.lastFetched.toISOString()} (${cacheAge} minutes old)`)
        } else {
          console.warn(`Schedule fetch error for teacher ${teacherInfo.name}, using fallback cache from ${cachedSchedule.lastFetched.toISOString()} (${cacheAge} minutes old)`)
        }
        } else {
          // Если кэша нет, возвращаем страницу с ошибкой
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
          
          const errorMessage = isTimeout 
            ? 'Превышено время ожидания ответа от сервера'
            : isSSLError
            ? 'В колледже что-то сломалось (проблема с сертификатом безопасности). Здесь я бессилен, проблема не на моей стороне.'
            : errorMessageObj.message || 'Произошла ошибка при загрузке расписания'
          
          console.error(`Schedule fetch failed for teacher ${teacherInfo.name}, no cache available:`, e)
          
          const cacheAvailableFor = Array.from(cachedTeacherSchedules.entries())
            .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
            .map(([k]) => k.split('_')[1]) // Берем parseId из ключа кэша
          
          return {
            props: nextSerialized({
              teacher: {
                id: teacherInfo.id,
                name: teacherInfo.name
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
  
  // Debug: показать пустое расписание
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

  const cacheAvailableFor = Array.from(cachedTeacherSchedules.entries())
    .filter(([, v]) => v.lastFetched.getTime() + maxCacheDurationInMS > Date.now())
    .map(([k]) => k.split('_')[1])

  // Информация о кэше (debug)
  const cacheInfo = debug.showCacheInfo ? {
    size: cachedTeacherSchedules.size,
    entries: cachedTeacherSchedules.size
  } : undefined

  context.res.setHeader('ETag', `"${etag}"`)
  return {
    props: nextSerialized({
      schedule: schedule,
      parsedAt: parsedAt,
      teacher: {
        id: teacherInfo.id,
        name: teacherInfo.name
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
}
