import { Day } from '@/shared/model/day'
import { parsePage, ParseResult, WeekInfo } from '@/app/parser/schedule'
import contentTypeParser from 'content-type'
import { JSDOM } from 'jsdom'
import { reportParserError, logErrorToFile, logInfo } from '@/app/logger'
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
  logInfo('Schedule fetch start', { groupID, groupName, wk: wk ?? 'current' })

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
        logInfo('Schedule fetch success', { groupName, daysCount: result.days.length, currentWk: result.currentWk })
        // Явно очищаем JSDOM для освобождения памяти
        dom.window.close()
        dom = null
        return scheduleResult
      } catch(e) {
        // Очищаем JSDOM при ошибке
        if (dom) {
          dom.window.close()
        }
        console.error(`Error while parsing ${PROXY_URL}`)
        const error = e instanceof Error ? e : new Error(String(e))
        logErrorToFile(error, {
          type: 'parsing_error',
          groupName,
          url,
          groupID
        })
        reportParserError(new Date().toISOString(), 'Не удалось сделать парсинг для группы', groupName)
        throw e
      }
    } else {
      // Логируем только метаданные, без содержимого ответа
      console.error(`Failed to fetch schedule: status=${page.status}, contentType=${contentType}, contentLength=${content.length}`)
      const error = new Error(`Error while fetching ${PROXY_URL}: status ${page.status}`)
      logErrorToFile(error, {
        type: 'fetch_error',
        groupName,
        url,
        groupID,
        status: page.status,
        contentType
      })
      reportParserError(new Date().toISOString(), 'Не удалось получить страницу для группы', groupName)
      throw error
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new ScheduleTimeoutError(`Request timeout while fetching ${PROXY_URL}`)
      logErrorToFile(timeoutError, {
        type: 'timeout_error',
        groupName,
        url,
        groupID
      })
      throw timeoutError
    }
    // Улучшенная обработка сетевых ошибок для диагностики
    const errorObj = error instanceof Error ? error : new Error(String(error))
    if (errorObj && 'cause' in errorObj && errorObj.cause instanceof Error) {
      const networkError = errorObj.cause as Error & { code?: string }
      if (networkError.code === 'ECONNRESET' || networkError.code === 'ECONNREFUSED' || networkError.code === 'ETIMEDOUT') {
        console.error(`Network error while fetching ${PROXY_URL}:`, {
          code: networkError.code,
          message: networkError.message,
          url
        })
        logErrorToFile(errorObj, {
          type: 'network_error',
          groupName,
          url,
          groupID,
          networkErrorCode: networkError.code,
          networkErrorMessage: networkError.message
        })
      } else if (networkError.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || networkError.message?.includes('self-signed certificate') || networkError.message?.includes('certificate')) {
        // Обработка ошибки SSL сертификата
        console.error(`SSL certificate error while fetching ${PROXY_URL}:`, {
          code: networkError.code,
          message: networkError.message,
          url
        })
        const sslError = new Error(`В колледже что-то сломалось (проблема с сертификатом безопасности). Здесь я бессилен, проблема не на моей стороне.`)
        logErrorToFile(sslError, {
          type: 'ssl_certificate_error',
          groupName,
          url,
          groupID,
          networkErrorCode: networkError.code,
          networkErrorMessage: networkError.message
        })
        throw sslError
      } else {
        // Логируем другие ошибки тоже
        logErrorToFile(errorObj, {
          type: 'unknown_error',
          groupName,
          url,
          groupID
        })
      }
    } else {
      // Проверка на ошибку SSL сертификата по сообщению
      if (errorObj.message?.includes('self-signed certificate') || errorObj.message?.includes('certificate')) {
        const sslError = new Error(`В колледже что-то сломалось (проблема с сертификатом безопасности). Здесь я бессилен, проблема не на моей стороне.`)
        logErrorToFile(sslError, {
          type: 'ssl_certificate_error',
          groupName,
          url,
          groupID,
          errorMessage: errorObj.message
        })
        throw sslError
      }
      // Логируем ошибки без cause
      logErrorToFile(errorObj, {
        type: 'unknown_error',
        groupName,
        url,
        groupID
      })
    }
    throw error
  }
}

export async function getTeacherSchedule(teacherID: number, teacherName: string, wk?: number, parseWeekNavigation: boolean = true): Promise<ScheduleResult> {
  // Валидация параметров
  if (!Number.isInteger(teacherID) || teacherID <= 0) {
    throw new Error('Invalid teacherID: must be a positive integer')
  }
  
  if (wk !== undefined && (!Number.isInteger(wk) || wk <= 0 || !isFinite(wk))) {
    throw new Error('Invalid wk parameter: must be a positive integer')
  }
  
  const url = `${PROXY_URL}/?mn=3&obj=${teacherID}${wk ? `&wk=${wk}` : ''}`
  logInfo('Teacher schedule fetch start', { teacherID, teacherName, wk: wk ?? 'current' })

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
        const result = parsePage(root, teacherName, url, parseWeekNavigation, true)
        const scheduleResult = {
          days: result.days,
          currentWk: result.currentWk || wk,
          availableWeeks: result.availableWeeks
        }
        logInfo('Teacher schedule fetch success', { teacherName, daysCount: result.days.length, currentWk: result.currentWk })
        // Явно очищаем JSDOM для освобождения памяти
        dom.window.close()
        dom = null
        return scheduleResult
      } catch(e) {
        // Очищаем JSDOM при ошибке
        if (dom) {
          dom.window.close()
        }
        console.error(`Error while parsing ${PROXY_URL}`)
        const error = e instanceof Error ? e : new Error(String(e))
        logErrorToFile(error, {
          type: 'parsing_error',
          teacherName,
          url,
          teacherID
        })
        reportParserError(new Date().toISOString(), 'Не удалось сделать парсинг для преподавателя', teacherName)
        throw e
      }
    } else {
      // Логируем только метаданные, без содержимого ответа
      console.error(`Failed to fetch schedule: status=${page.status}, contentType=${contentType}, contentLength=${content.length}`)
      const error = new Error(`Error while fetching ${PROXY_URL}: status ${page.status}`)
      logErrorToFile(error, {
        type: 'fetch_error',
        teacherName,
        url,
        teacherID,
        status: page.status,
        contentType
      })
      reportParserError(new Date().toISOString(), 'Не удалось получить страницу для преподавателя', teacherName)
      throw error
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new ScheduleTimeoutError(`Request timeout while fetching ${PROXY_URL}`)
      logErrorToFile(timeoutError, {
        type: 'timeout_error',
        teacherName,
        url,
        teacherID
      })
      throw timeoutError
    }
    // Улучшенная обработка сетевых ошибок для диагностики
    const errorObj = error instanceof Error ? error : new Error(String(error))
    if (errorObj && 'cause' in errorObj && errorObj.cause instanceof Error) {
      const networkError = errorObj.cause as Error & { code?: string }
      if (networkError.code === 'ECONNRESET' || networkError.code === 'ECONNREFUSED' || networkError.code === 'ETIMEDOUT') {
        console.error(`Network error while fetching ${PROXY_URL}:`, {
          code: networkError.code,
          message: networkError.message,
          url
        })
        logErrorToFile(errorObj, {
          type: 'network_error',
          teacherName,
          url,
          teacherID,
          networkErrorCode: networkError.code,
          networkErrorMessage: networkError.message
        })
      } else if (networkError.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || networkError.message?.includes('self-signed certificate') || networkError.message?.includes('certificate')) {
        // Обработка ошибки SSL сертификата
        console.error(`SSL certificate error while fetching ${PROXY_URL}:`, {
          code: networkError.code,
          message: networkError.message,
          url
        })
        const sslError = new Error(`В колледже что-то сломалось (проблема с сертификатом безопасности). Здесь я бессилен, проблема не на моей стороне.`)
        logErrorToFile(sslError, {
          type: 'ssl_certificate_error',
          teacherName,
          url,
          teacherID,
          networkErrorCode: networkError.code,
          networkErrorMessage: networkError.message
        })
        throw sslError
      } else {
        // Логируем другие ошибки тоже
        logErrorToFile(errorObj, {
          type: 'unknown_error',
          teacherName,
          url,
          teacherID
        })
      }
    } else {
      // Проверка на ошибку SSL сертификата по сообщению
      if (errorObj.message?.includes('self-signed certificate') || errorObj.message?.includes('certificate')) {
        const sslError = new Error(`В колледже что-то сломалось (проблема с сертификатом безопасности). Здесь я бессилен, проблема не на моей стороне.`)
        logErrorToFile(sslError, {
          type: 'ssl_certificate_error',
          teacherName,
          url,
          teacherID,
          errorMessage: errorObj.message
        })
        throw sslError
      }
      // Логируем ошибки без cause
      logErrorToFile(errorObj, {
        type: 'unknown_error',
        teacherName,
        url,
        teacherID
      })
    }
    throw error
  }
}