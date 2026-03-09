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
    // Сначала загружаем текущие настройки из базы данных
    clearSettingsCache()
    const currentSettings = loadSettings(true)

    // Обновление настроек
    const { weekNavigationEnabled, showAddGroupButton, showTeachersButton, vacationModeEnabled, vacationModeContent, debug } = req.body

    console.log('[Settings API] Received settings update:', {
      weekNavigationEnabled,
      showAddGroupButton,
      showTeachersButton,
      vacationModeEnabled,
      vacationModeContent,
      hasDebug: debug !== undefined
    })

    if (typeof weekNavigationEnabled !== 'boolean') {
      res.status(400).json({ error: 'weekNavigationEnabled must be a boolean' })
      return
    }

    if (showAddGroupButton !== undefined && typeof showAddGroupButton !== 'boolean') {
      res.status(400).json({ error: 'showAddGroupButton must be a boolean' })
      return
    }

    if (showTeachersButton !== undefined && typeof showTeachersButton !== 'boolean') {
      res.status(400).json({ error: 'showTeachersButton must be a boolean' })
      return
    }

    if (vacationModeEnabled !== undefined && typeof vacationModeEnabled !== 'boolean') {
      res.status(400).json({ error: 'vacationModeEnabled must be a boolean' })
      return
    }

    if (vacationModeContent !== undefined && typeof vacationModeContent !== 'string') {
      res.status(400).json({ error: 'vacationModeContent must be a string' })
      return
    }

    // Валидация debug опций (только в dev режиме)
    // В production режиме debug опции просто игнорируются
    let validatedDebug = undefined
    if (debug !== undefined) {
      if (typeof debug !== 'object' || debug === null) {
        res.status(400).json({ error: 'debug must be an object' })
        return
      }
      
      if (process.env.NODE_ENV === 'development') {
        // В development режиме разрешаем debug опции
        const debugKeys = ['forceCache', 'forceEmpty', 'forceError', 'forceTimeout', 'showCacheInfo']
        
        // Валидация типов debug опций
        for (const key of debugKeys) {
          if (key in debug && typeof debug[key] !== 'boolean' && debug[key] !== undefined) {
            res.status(400).json({ error: `debug.${key} must be a boolean` })
            return
          }
        }
        
        validatedDebug = debug
      }
      // В production режиме debug опции просто игнорируются (не сохраняются)
    }

    // Объединяем текущие настройки с новыми (новые значения перезаписывают старые)
    const settings: AppSettings = {
      ...currentSettings,
      weekNavigationEnabled,
      showAddGroupButton: showAddGroupButton !== undefined ? showAddGroupButton : (currentSettings.showAddGroupButton ?? true),
      showTeachersButton: showTeachersButton !== undefined ? showTeachersButton : (currentSettings.showTeachersButton ?? true),
      vacationModeEnabled: vacationModeEnabled !== undefined ? vacationModeEnabled : (currentSettings.vacationModeEnabled ?? false),
      vacationModeContent: vacationModeContent !== undefined ? vacationModeContent : (currentSettings.vacationModeContent || ''),
      ...(validatedDebug !== undefined && { debug: validatedDebug })
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



