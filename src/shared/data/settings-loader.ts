import fs from 'fs'
import path from 'path'

export type AppSettings = {
  weekNavigationEnabled: boolean
}

let cachedSettings: AppSettings | null = null

const defaultSettings: AppSettings = {
  weekNavigationEnabled: true
}

/**
 * Загружает настройки из JSON файла
 * Использует кеш для оптимизации в production
 */
export function loadSettings(): AppSettings {
  if (cachedSettings) {
    return cachedSettings
  }

  // В production Next.js может использовать другую структуру директорий
  // Пробуем несколько путей
  const possiblePaths = [
    path.join(process.cwd(), 'src/shared/data/settings.json'),
    path.join(process.cwd(), '.next/standalone/src/shared/data/settings.json'),
    path.join(process.cwd(), 'settings.json'),
  ]
  
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const settings = JSON.parse(fileContents) as AppSettings
        
        // Убеждаемся, что все обязательные поля присутствуют
        const mergedSettings: AppSettings = {
          ...defaultSettings,
          ...settings
        }
        
        cachedSettings = mergedSettings
        return mergedSettings
      }
    } catch (error) {
      // Пробуем следующий путь
      continue
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
    cachedSettings = defaultSettings
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
  // Всегда сохраняем в основной путь
  const filePath = path.join(process.cwd(), 'src/shared/data/settings.json')
  
  try {
    // Создаем директорию, если её нет
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // Объединяем с настройками по умолчанию для сохранения всех полей
    const mergedSettings: AppSettings = {
      ...defaultSettings,
      ...settings
    }
    
    fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2), 'utf8')
    // Сбрасываем кеш
    cachedSettings = null
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
}

