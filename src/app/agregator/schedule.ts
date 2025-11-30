import { Day } from '@/shared/model/day'
import { parsePage, ParseResult, WeekInfo } from '@/app/parser/schedule'
import contentTypeParser from 'content-type'
import { JSDOM } from 'jsdom'
import { reportParserError } from '@/app/logger'
import { PROXY_URL } from '@/shared/constants/urls'

export type ScheduleResult = {
  days: Day[]
  currentWk?: number
  availableWeeks?: WeekInfo[]
}

export class ScheduleTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduleTimeoutError'
  }
}

export async function getSchedule(groupID: number, groupName: string, wk?: number, parseWeekNavigation: boolean = true): Promise<ScheduleResult> {
  // Валидация параметров
  if (!Number.isInteger(groupID) || groupID <= 0) {
    throw new Error('Invalid groupID: must be a positive integer')
  }
  
  if (wk !== undefined && (!Number.isInteger(wk) || wk <= 0 || !isFinite(wk))) {
    throw new Error('Invalid wk parameter: must be a positive integer')
  }
  
  const url = `${PROXY_URL}/?mn=2&obj=${groupID}${wk ? `&wk=${wk}` : ''}`
  
  // Добавляем таймаут 8 секунд для fetch запроса
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 секунд
  
  try {
    const page = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    const content = await page.text()
    const contentType = page.headers.get('content-type')
    if (page.status === 200 && contentType && contentTypeParser.parse(contentType).type === 'text/html') {
      let dom: JSDOM | null = null
      try {
        dom = new JSDOM(content, { url })
        const root = dom.window.document
        const result = parsePage(root, groupName, url, parseWeekNavigation)
        const scheduleResult = {
          days: result.days,
          currentWk: result.currentWk || wk,
          availableWeeks: result.availableWeeks
        }
        // Явно очищаем JSDOM для освобождения памяти
        dom.window.close()
        dom = null
        return scheduleResult
      } catch(e) {
        // Очищаем JSDOM даже в случае ошибки
        if (dom) {
          dom.window.close()
        }
        console.error(`Error while parsing ${PROXY_URL}`)
        reportParserError(new Date().toISOString(), 'Не удалось сделать парсинг для группы', groupName)
        throw e
      }
    } else {
      // Логируем только метаданные, без содержимого ответа
      console.error(`Failed to fetch schedule: status=${page.status}, contentType=${contentType}, contentLength=${content.length}`)
      reportParserError(new Date().toISOString(), 'Не удалось получить страницу для группы', groupName)
      throw new Error(`Error while fetching ${PROXY_URL}: status ${page.status}`)
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ScheduleTimeoutError(`Request timeout while fetching ${PROXY_URL}`)
    }
    throw error
  }
}