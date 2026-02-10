import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ApiResponse } from '@/shared/utils/api-wrapper'
import fs from 'fs'
import path from 'path'

type ResponseData = ApiResponse<{
  logs?: string
}>

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Путь к файлу логов (в корне проекта)
  const logPath = path.join(process.cwd(), 'error.log')
  
  // Проверяем существование файла (если нет — возвращаем пустую строку, UI покажет «Логи пусты»)
  if (!fs.existsSync(logPath)) {
    res.status(200).json({ success: true, logs: '' })
    return
  }

  // Читаем файл
  const logs = fs.readFileSync(logPath, 'utf8')

  // Если файл пуст — возвращаем пустую строку
  if (!logs || logs.trim().length === 0) {
    res.status(200).json({ success: true, logs: '' })
    return
  }

  res.status(200).json({ success: true, logs })
}

export default withAuth(handler, ['GET'])

