import { getSettings as getSettingsFromDB, updateSettings as updateSettingsInDB } from './database'

export type AppSettings = {
  weekNavigationEnabled: boolean
  showAddGroupButton: boolean
  vacationModeEnabled?: boolean
  vacationModeContent?: string
  debug?: {
    forceCache?: boolean
    forceEmpty?: boolean
    forceError?: boolean
    forceTimeout?: boolean
    showCacheInfo?: boolean
  }
}

let cachedSettings: AppSettings | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 1000 * 60 // 1 минута

/**
 * Загружает настройки из базы данных
 * Использует кеш с TTL для оптимизации, но всегда загружает свежие данные при необходимости
 */
export function loadSettings(forceRefresh: boolean = false): AppSettings {
  const now = Date.now()
  const isCacheValid = cachedSettings !== null && !forceRefresh && (now - cacheTimestamp) < CACHE_TTL_MS
  
  if (isCacheValid && cachedSettings !== null) {
    return cachedSettings
  }

  try {
    cachedSettings = getSettingsFromDB()
    cacheTimestamp = now
    return cachedSettings
  } catch (error) {
    console.error('Error loading settings from database:', error)
    // Возвращаем настройки по умолчанию
    const defaultSettings: AppSettings = {
      weekNavigationEnabled: false,
      showAddGroupButton: true,
      vacationModeEnabled: false,
      vacationModeContent: '',
      debug: {
        forceCache: false,
        forceEmpty: false,
        forceError: false,
        forceTimeout: false,
        showCacheInfo: false
      }
    }
    return defaultSettings
  }
}

/**
 * Сохраняет настройки в базу данных
 */
export function saveSettings(settings: AppSettings): void {
  try {
    updateSettingsInDB(settings)
    // Сбрасываем кеш и timestamp
    cachedSettings = null
    cacheTimestamp = 0
  } catch (error) {
    console.error('Error saving settings to database:', error)
    throw new Error('Failed to save settings')
  }
}

/**
 * Сбрасывает кеш настроек (полезно после обновления)
 */
export function clearSettingsCache(): void {
  cachedSettings = null
  cacheTimestamp = 0
}



