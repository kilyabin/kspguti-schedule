import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from './auth'

export type ApiHandler<T = any> = (
  req: NextApiRequest,
  res: NextApiResponse<T>
) => void | Promise<void>

export type ApiResponse<T = Record<string, never>> = {
  success?: boolean
  error?: string
} & (T extends Record<string, never> ? {} : Partial<T>)

/**
 * Общий wrapper для защищенных API роутов
 * Автоматически проверяет авторизацию и обрабатывает ошибки
 */
export function withAuth<T = any>(
  handler: ApiHandler<ApiResponse<T>>,
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE']
) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    // Проверка метода
    if (!allowedMethods.includes(req.method || '')) {
      res.status(405).json({ error: 'Method not allowed' } as ApiResponse<T>)
      return
    }

    // Проверка авторизации
    return requireAuth(req, res, async (req, res) => {
      try {
        await handler(req, res)
      } catch (error) {
        console.error('API Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error'
        res.status(500).json({ error: errorMessage } as ApiResponse<T>)
      }
    })
  }
}

/**
 * Общий wrapper для незащищенных API роутов
 */
export function withMethods<T = any>(
  handler: ApiHandler<ApiResponse<T>>,
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE']
) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    // Проверка метода
    if (!allowedMethods.includes(req.method || '')) {
      res.status(405).json({ error: 'Method not allowed' } as ApiResponse<T>)
      return
    }

    try {
      await handler(req, res)
    } catch (error) {
      console.error('API Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Internal server error'
      res.status(500).json({ error: errorMessage } as ApiResponse<T>)
    }
  }
}

