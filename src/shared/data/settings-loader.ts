import fs from 'fs'
import path from 'path'

export type AppSettings = {
  weekNavigationEnabled: boolean
  debug?: {
    forceCache?: boolean
    forceEmpty?: boolean
    forceError?: boolean
    forceTimeout?: boolean
    showCacheInfo?: boolean
  }
}

let cachedSettings: AppSettings | null = null
let cachedSettingsPath: string | null = null
let cachedSettingsMtime: number | null = null

const defaultSettings: AppSettings = {
  weekNavigationEnabled: true,
  debug: {
    forceCache: false,
    forceEmpty: false,
    forceError: false,
    forceTimeout: false,
    showCacheInfo: false
  }
}

/**
 * Загружает настройки из JSON файла
 * Проверяет время модификации файла для инвалидации кеша
 */
export function loadSettings(): AppSettings {
  // В production Next.js может использовать другую структуру директорий
  // Пробуем несколько путей
  const possiblePaths = [
    path.join(process.cwd(), 'src/shared/data/settings.json'),
    path.join(process.cwd(), '.next/standalone/src/shared/data/settings.json'),
    path.join(process.cwd(), 'settings.json'),
  ]
  
  // Ищем существующий файл
  let foundPath: string | null = null
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      foundPath = filePath
      break
    }
  }
  
  // Если файл найден, проверяем, изменился ли он
  if (foundPath) {
    try {
      const stats = fs.statSync(foundPath)
      const mtime = stats.mtimeMs
      
      // Если файл изменился или путь изменился, сбрасываем кеш
      if (cachedSettings && (cachedSettingsPath !== foundPath || cachedSettingsMtime !== mtime)) {
        cachedSettings = null
        cachedSettingsPath = null
        cachedSettingsMtime = null
      }
      
      // Если кеш валиден, возвращаем его
      if (cachedSettings && cachedSettingsPath === foundPath && cachedSettingsMtime === mtime) {
        return cachedSettings
      }
      
      // Загружаем файл заново
      const fileContents = fs.readFileSync(foundPath, 'utf8')
      const settings = JSON.parse(fileContents) as AppSettings
      
      // Убеждаемся, что все обязательные поля присутствуют
      const mergedSettings: AppSettings = {
        ...defaultSettings,
        ...settings,
        debug: {
          ...defaultSettings.debug,
          ...settings.debug
        }
      }
      
      cachedSettings = mergedSettings
      cachedSettingsPath = foundPath
      cachedSettingsMtime = mtime
      
      return mergedSettings
    } catch (error) {
      console.error('Error reading settings.json:', error)
      // Продолжаем дальше, чтобы создать файл с настройками по умолчанию
    }
  }
  
  // Если файл не найден, создаем его с настройками по умолчанию
  const mainPath = path.join(process.cwd(), 'src/shared/data/settings.json')
  try {
    // Создаем директорию, если её нет
    const dir = path.dirname(mainPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    fs.writeFileSync(mainPath, JSON.stringify(defaultSettings, null, 2), 'utf8')
    
    const stats = fs.statSync(mainPath)
    cachedSettings = defaultSettings
    cachedSettingsPath = mainPath
    cachedSettingsMtime = stats.mtimeMs
    
    return defaultSettings
  } catch (error) {
    console.error('Error creating settings.json:', error)
    // Возвращаем настройки по умолчанию
    return defaultSettings
  }
}

/**
 * Сохраняет настройки в JSON файл
 */
export function saveSettings(settings: AppSettings): void {
  // Сначала пытаемся найти существующий файл
  const possiblePaths = [
    path.join(process.cwd(), 'src/shared/data/settings.json'),
    path.join(process.cwd(), '.next/standalone/src/shared/data/settings.json'),
    path.join(process.cwd(), 'settings.json'),
  ]
  
  // Объединяем с настройками по умолчанию для сохранения всех полей
  const mergedSettings: AppSettings = {
    ...defaultSettings,
    ...settings,
    debug: {
      ...defaultSettings.debug,
      ...settings.debug
    }
  }
  
  // Ищем существующий файл
  let targetPath: string | null = null
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      targetPath = filePath
      break
    }
  }
  
  // Если файл не найден, используем основной путь
  if (!targetPath) {
    targetPath = path.join(process.cwd(), 'src/shared/data/settings.json')
  }
  
  try {
    // Создаем директорию, если её нет
    const dir = path.dirname(targetPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // Сохраняем файл
    fs.writeFileSync(targetPath, JSON.stringify(mergedSettings, null, 2), 'utf8')
    
    // Обновляем кеш с новыми метаданными
    try {
      const stats = fs.statSync(targetPath)
      cachedSettings = mergedSettings
      cachedSettingsPath = targetPath
      cachedSettingsMtime = stats.mtimeMs
    } catch (error) {
      // Если не удалось получить stats, просто обновляем кеш
      cachedSettings = mergedSettings
      cachedSettingsPath = targetPath
      cachedSettingsMtime = null
    }
    
    // Также сохраняем в другие возможные пути для совместимости (если они существуют)
    for (const filePath of possiblePaths) {
      if (filePath !== targetPath && fs.existsSync(path.dirname(filePath))) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2), 'utf8')
        } catch (error) {
          // Игнорируем ошибки при сохранении в дополнительные пути
        }
      }
    }
  } catch (error) {
    console.error('Error saving settings.json:', error)
    throw new Error('Failed to save settings')
  }
}

/**
 * Сбрасывает кеш настроек (полезно после обновления файла)
 */
export function clearSettingsCache(): void {
  cachedSettings = null
  cachedSettingsPath = null
  cachedSettingsMtime = null
}



