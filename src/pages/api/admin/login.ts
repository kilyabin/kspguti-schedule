import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyPassword, setSessionCookie } from '@/shared/utils/auth'

type ResponseData = {
  success?: boolean
  error?: string
}

// Rate limiting: 5 попыток в 15 минут
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 минут

interface RateLimitEntry {
  attempts: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

function getClientIP(req: NextApiRequest): string {
  // Получаем IP адрес клиента
  const forwarded = req.headers['x-forwarded-for']
  const realIP = req.headers['x-real-ip']
  const remoteAddress = req.socket.remoteAddress
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  if (typeof realIP === 'string') {
    return realIP
  }
  if (remoteAddress) {
    return remoteAddress
  }
  return 'unknown'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  
  // Очищаем старые записи
  if (entry && now > entry.resetTime) {
    rateLimitMap.delete(ip)
  }
  
  const currentEntry = rateLimitMap.get(ip)
  
  if (!currentEntry) {
    // Первая попытка
    rateLimitMap.set(ip, {
      attempts: 1,
      resetTime: now + WINDOW_MS
    })
    return true
  }
  
  if (currentEntry.attempts >= MAX_ATTEMPTS) {
    return false
  }
  
  // Увеличиваем счетчик попыток
  currentEntry.attempts++
  return true
}

function recordFailedAttempt(ip: string): void {
  const entry = rateLimitMap.get(ip)
  if (entry) {
    // Попытка уже засчитана в checkRateLimit
    return
  }
  
  // Если записи нет, создаем новую
  const now = Date.now()
  rateLimitMap.set(ip, {
    attempts: 1,
    resetTime: now + WINDOW_MS
  })
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const clientIP = getClientIP(req)
  
  // Проверяем rate limit
  if (!checkRateLimit(clientIP)) {
    const entry = rateLimitMap.get(clientIP)
    const retryAfter = entry ? Math.ceil((entry.resetTime - Date.now()) / 1000) : WINDOW_MS / 1000
    res.status(429).json({ 
      error: 'Too many login attempts. Please try again later.',
      retryAfter 
    })
    return
  }

  const { password } = req.body

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' })
    return
  }

  if (verifyPassword(password)) {
    // Успешный вход - сбрасываем rate limit
    rateLimitMap.delete(clientIP)
    setSessionCookie(res)
    res.status(200).json({ success: true })
  } else {
    // Неудачная попытка - записываем
    recordFailedAttempt(clientIP)
    res.status(401).json({ error: 'Invalid password' })
  }
}





