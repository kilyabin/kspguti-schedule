import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'
import path from 'path'

const token = process.env.PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_BOTAPI_TOKEN
const ownerID = process.env.PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_CHAT_ID

let bot: TelegramBot
if (!token || !ownerID) {
  console.warn('Telegram Token is not specified. This means you won\'t get any notifications about parsing failures.')
} else {
  bot = new TelegramBot(token, { polling: false })
}

// Путь к файлу логов (в корне проекта)
const getErrorLogPath = () => {
  // В production (standalone) используем текущую рабочую директорию
  // В development используем корень проекта (process.cwd())
  return path.join(process.cwd(), 'error.log')
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
  if (!token || !ownerID) return

  await bot.sendMessage(ownerID, text.join(' '))
}