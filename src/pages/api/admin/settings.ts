import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/shared/utils/auth'
import { loadSettings, saveSettings, AppSettings } from '@/shared/data/settings-loader'

type ResponseData = {
  settings?: AppSettings
  success?: boolean
  error?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === 'GET') {
    // Получение настроек
    const settings = loadSettings()
    res.status(200).json({ settings })
    return
  }

  if (req.method === 'PUT') {
    // Обновление настроек
    const { weekNavigationEnabled } = req.body

    if (typeof weekNavigationEnabled !== 'boolean') {
      res.status(400).json({ error: 'weekNavigationEnabled must be a boolean' })
      return
    }

    const settings: AppSettings = {
      weekNavigationEnabled
    }

    try {
      saveSettings(settings)
      res.status(200).json({ success: true, settings })
    } catch (error) {
      console.error('Error saving settings:', error)
      res.status(500).json({ error: 'Failed to save settings' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

export default function protectedHandler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  return requireAuth(req, res, handler)
}

