import fs from 'fs'
import path from 'path'

const token = process.env.PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_BOTAPI_TOKEN
const ownerID = process.env.PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_CHAT_ID

if (!token || !ownerID) {
  console.warn('Telegram Token is not specified. This means you won\'t get any notifications about parsing failures.')
}

async function sendTelegramMessage(text: string): Promise<void> {
  if (!token || !ownerID) return
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ownerID, text }),
  })
  if (!res.ok) {
    console.error('Telegram sendMessage failed:', res.status, await res.text())
  }
}

// Уровни логов: debug < info < warn < error
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

const currentLevel = ((): number => {
  const env = process.env.LOG_LEVEL?.toLowerCase()
  if (env && env in LOG_LEVELS) return LOG_LEVELS[env as LogLevel]
  return process.env.NODE_ENV === 'development' ? LOG_LEVELS.debug : LOG_LEVELS.info
})()

const isDev = process.env.NODE_ENV === 'development'

// Путь к файлам логов (в корне проекта)
const getErrorLogPath = () => path.join(process.cwd(), 'error.log')
const getAppLogPath = () => path.join(process.cwd(), 'app.log')

function writeAppLog(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < currentLevel) return
  try {
    const logPath = getAppLogPath()
    const timestamp = new Date().toISOString()
    let line = `[${timestamp}] ${level.toUpperCase()}: ${message}`
    if (data != null && Object.keys(data).length > 0) {
      line += ' ' + JSON.stringify(data)
    }
    line += '\n'
    fs.appendFileSync(logPath, line, 'utf8')
  } catch {
    // не падаем из-за логгера
  }
  if (isDev && (level === 'debug' || level === 'info')) {
    const out = level === 'debug' ? console.debug : console.info
    out(`[${level}]`, message, data ?? '')
  }
}

/** Логирование отладочных сообщений (пишется при LOG_LEVEL=debug или в development) */
export function logDebug(message: string, data?: Record<string, unknown>): void {
  writeAppLog('debug', message, data)
}

/** Информационное логирование (пишется при LOG_LEVEL=info и выше, по умолчанию в production) */
export function logInfo(message: string, data?: Record<string, unknown>): void {
  writeAppLog('info', message, data)
}

/** Предупреждения (всегда пишется в app.log при уровне warn и выше) */
export function logWarn(message: string, data?: Record<string, unknown>): void {
  writeAppLog('warn', message, data)
}

/**
 * Логирует ошибку в файл error.log
 * @param error - Объект ошибки или строка с описанием ошибки
 * @param context - Дополнительный контекст (опционально)
 */
export function logErrorToFile(error: Error | string, context?: Record<string, unknown>): void {
  try {
    const logPath = getErrorLogPath()
    const timestamp = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'Error'

    let logEntry = `[${timestamp}] ${errorName}: ${errorMessage}\n`

    if (errorStack) {
      logEntry += `Stack: ${errorStack}\n`
    }

    if (context && Object.keys(context).length > 0) {
      logEntry += `Context: ${JSON.stringify(context, null, 2)}\n`
    }

    logEntry += '---\n'

    // Используем appendFileSync для надежности (не блокирует надолго)
    fs.appendFileSync(logPath, logEntry, 'utf8')
  } catch (logError) {
    // Если не удалось записать в файл, выводим в консоль
    console.error('Failed to write to error.log:', logError)
  }
}

export async function reportParserError(...text: string[]) {
  await sendTelegramMessage(text.join(' '))
}
