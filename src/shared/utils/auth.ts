import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-me-in-production'
const SESSION_DURATION = 1000 * 60 * 60 * 24 // 24 часа

/**
 * Проверяет пароль администратора
 */
export function verifyPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD is not set')
    return false
  }
  return password === adminPassword
}

/**
 * Создает сессионный токен
 */
function createSessionToken(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const timestamp = Date.now().toString()
  const data = `${randomBytes}:${timestamp}`
  const hash = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
  return `${data}:${hash}`
}

/**
 * Проверяет валидность сессионного токена
 */
function verifySessionToken(token: string): boolean {
  try {
    const parts = token.split(':')
    if (parts.length !== 3) return false
    
    const [randomBytes, timestamp, hash] = parts
    const data = `${randomBytes}:${timestamp}`
    const expectedHash = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
    
    if (hash !== expectedHash) return false
    
    // Проверяем срок действия сессии
    const sessionTime = parseInt(timestamp, 10)
    const now = Date.now()
    if (now - sessionTime > SESSION_DURATION) return false
    
    return true
  } catch {
    return false
  }
}

/**
 * Устанавливает сессионную куку
 */
export function setSessionCookie(res: NextApiResponse): void {
  const token = createSessionToken()
  const isProduction = process.env.NODE_ENV === 'production'
  const secureFlag = isProduction ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION / 1000}`)
}

/**
 * Проверяет авторизацию по сессионной куке
 */
export function checkAuth(req: NextApiRequest): boolean {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return false
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  
  const sessionToken = cookies[SESSION_COOKIE_NAME]
  if (!sessionToken) return false
  
  return verifySessionToken(sessionToken)
}

/**
 * Удаляет сессионную куку (логаут)
 */
export function clearSessionCookie(res: NextApiResponse): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const secureFlag = isProduction ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=0`)
}

/**
 * Middleware для защиты API endpoints
 */
export function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>
): void | Promise<void> {
  if (!checkAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  return handler(req, res)
}

