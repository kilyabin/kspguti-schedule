import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ApiResponse } from '@/shared/utils/api-wrapper'
import { loadSettings, saveSettings, clearSettingsCache, AppSettings } from '@/shared/data/settings-loader'

type ResponseData = ApiResponse<{
  settings?: AppSettings
}>

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === 'GET') {
    // Получение настроек (всегда свежие данные для админ-панели)
    clearSettingsCache()
    const settings = loadSettings(true)
    res.status(200).json({ settings })
    return
  }

  if (req.method === 'PUT') {
    // Обновление настроек
    const { weekNavigationEnabled, showAddGroupButton, debug } = req.body

    if (typeof weekNavigationEnabled !== 'boolean') {
      res.status(400).json({ error: 'weekNavigationEnabled must be a boolean' })
      return
    }

    if (showAddGroupButton !== undefined && typeof showAddGroupButton !== 'boolean') {
      res.status(400).json({ error: 'showAddGroupButton must be a boolean' })
      return
    }

    // Валидация debug опций (только в dev режиме)
    if (debug !== undefined) {
      if (typeof debug !== 'object' || debug === null) {
        res.status(400).json({ error: 'debug must be an object' })
        return
      }
      
      if (process.env.NODE_ENV !== 'development') {
        res.status(403).json({ error: 'Debug options are only available in development mode' })
        return
      }

      const debugKeys = ['forceCache', 'forceEmpty', 'forceError', 'forceTimeout', 'showCacheInfo']
      for (const key of debugKeys) {
        if (key in debug && typeof debug[key] !== 'boolean' && debug[key] !== undefined) {
          res.status(400).json({ error: `debug.${key} must be a boolean` })
          return
        }
      }
    }

    const settings: AppSettings = {
      weekNavigationEnabled,
      showAddGroupButton: showAddGroupButton !== undefined ? showAddGroupButton : true,
      ...(debug !== undefined && { debug })
    }

    saveSettings(settings)
    // Сбрасываем кеш и загружаем свежие настройки для подтверждения
    clearSettingsCache()
    const savedSettings = loadSettings(true)
    res.status(200).json({ success: true, settings: savedSettings })
    return
  }
}

export default withAuth(handler, ['GET', 'PUT'])



