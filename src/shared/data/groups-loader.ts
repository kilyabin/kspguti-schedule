import fs from 'fs'
import path from 'path'

export type GroupInfo = {
  parseId: number
  name: string
  course: number
}

export type GroupsData = { [group: string]: GroupInfo }

// Старый формат для миграции
type OldGroupsData = { [group: string]: [number, string] | GroupInfo }

let cachedGroups: GroupsData | null = null

/**
 * Мигрирует старый формат данных в новый
 */
function migrateGroups(oldGroups: OldGroupsData): GroupsData {
  const migrated: GroupsData = {}
  
  for (const [id, data] of Object.entries(oldGroups)) {
    // Проверяем, является ли это старым форматом [parseId, name]
    if (Array.isArray(data) && data.length === 2 && typeof data[0] === 'number' && typeof data[1] === 'string') {
      // Старый формат - мигрируем
      migrated[id] = {
        parseId: data[0],
        name: data[1],
        course: 1 // По умолчанию курс 1
      }
    } else if (typeof data === 'object' && 'parseId' in data && 'name' in data) {
      // Уже новый формат
      migrated[id] = data as GroupInfo
    }
  }
  
  return migrated
}

/**
 * Загружает группы из JSON файла
 * Использует кеш для оптимизации в production
 * Автоматически мигрирует старый формат в новый
 */
export function loadGroups(): GroupsData {
  if (cachedGroups) {
    return cachedGroups
  }

  // В production Next.js может использовать другую структуру директорий
  // Пробуем несколько путей
  const possiblePaths = [
    path.join(process.cwd(), 'src/shared/data/groups.json'),
    path.join(process.cwd(), '.next/standalone/src/shared/data/groups.json'),
    path.join(process.cwd(), 'groups.json'),
  ]
  
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const rawGroups = JSON.parse(fileContents) as OldGroupsData
        
        // Проверяем, нужна ли миграция
        const needsMigration = Object.values(rawGroups).some(
          data => Array.isArray(data) && data.length === 2
        )
        
        let groups: GroupsData
        if (needsMigration) {
          // Мигрируем старый формат
          groups = migrateGroups(rawGroups)
          // Сохраняем мигрированные данные
          const mainPath = path.join(process.cwd(), 'src/shared/data/groups.json')
          if (filePath === mainPath) {
            // Сохраняем только если это основной файл
            fs.writeFileSync(mainPath, JSON.stringify(groups, null, 2), 'utf8')
            console.log('Groups data migrated to new format')
          }
        } else {
          groups = rawGroups as GroupsData
        }
        
        cachedGroups = groups
        return groups
      }
    } catch (error) {
      // Пробуем следующий путь
      continue
    }
  }
  
  console.error('Error loading groups.json: file not found in any of the expected locations')
  // Fallback к пустому объекту
  return {}
}

/**
 * Сохраняет группы в JSON файл
 */
export function saveGroups(groups: GroupsData): void {
  // Всегда сохраняем в основной путь
  const filePath = path.join(process.cwd(), 'src/shared/data/groups.json')
  
  try {
    // Создаем директорию, если её нет
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    fs.writeFileSync(filePath, JSON.stringify(groups, null, 2), 'utf8')
    // Сбрасываем кеш
    cachedGroups = null
  } catch (error) {
    console.error('Error saving groups.json:', error)
    throw new Error('Failed to save groups')
  }
}

/**
 * Сбрасывает кеш групп (полезно после обновления файла)
 */
export function clearGroupsCache(): void {
  cachedGroups = null
}

