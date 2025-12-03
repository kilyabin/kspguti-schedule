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
  
  // Проверяем существование файла
  if (!fs.existsSync(logPath)) {
    res.status(200).json({ success: true, logs: 'Файл логов пуст или не существует.' })
    return
  }

  // Читаем файл
  const logs = fs.readFileSync(logPath, 'utf8')
  
  // Если файл пуст
  if (!logs || logs.trim().length === 0) {
    res.status(200).json({ success: true, logs: 'Файл логов пуст.' })
    return
  }

  res.status(200).json({ success: true, logs })
}

export default withAuth(handler, ['GET'])

