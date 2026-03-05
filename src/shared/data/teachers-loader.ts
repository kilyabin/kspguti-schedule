import { getAllTeachers as getAllTeachersFromDB, createTeacher, updateTeacher, deleteTeacher, getTeacher, type TeacherInfo, type TeachersData } from './database'

let cachedTeachers: TeachersData | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 1000 * 60 // 1 минута

/**
 * Загружает преподавателей из базы данных
 * Использует кеш с TTL для оптимизации, но всегда загружает свежие данные при необходимости
 */
export function loadTeachers(forceRefresh: boolean = false): TeachersData {
  const now = Date.now()
  const isCacheValid = cachedTeachers !== null && !forceRefresh && (now - cacheTimestamp) < CACHE_TTL_MS

  if (isCacheValid && cachedTeachers !== null) {
    return cachedTeachers
  }

  try {
    cachedTeachers = getAllTeachersFromDB()
    cacheTimestamp = now
    console.log(`[TeachersLoader] Loaded ${Object.keys(cachedTeachers).length} teachers from database`)
    return cachedTeachers
  } catch (error) {
    console.error('Error loading teachers from database:', error)
    // Fallback к пустому объекту
    return {}
  }
}

/**
 * Сохраняет преподавателей в базу данных
 */
export function saveTeachers(teachers: TeachersData): void {
  try {
    const existingTeachers = getAllTeachersFromDB()
    
    // Определяем, каких преподавателей нужно добавить, обновить или удалить
    const existingIds = new Set(Object.keys(existingTeachers))
    const newIds = new Set(Object.keys(teachers))

    // Добавляем или обновляем преподавателей
    for (const [id, teacher] of Object.entries(teachers)) {
      if (existingIds.has(id)) {
        updateTeacher(id, teacher)
      } else {
        createTeacher(id, teacher)
      }
    }

    // Удаляем преподавателей, которых больше нет
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        deleteTeacher(id)
      }
    }

    // Сбрасываем кеш и timestamp
    cachedTeachers = null
    cacheTimestamp = 0
  } catch (error) {
    console.error('Error saving teachers to database:', error)
    throw new Error('Failed to save teachers')
  }
}

/**
 * Сбрасывает кеш преподавателей (полезно после обновления)
 */
export function clearTeachersCache(): void {
  cachedTeachers = null
  cacheTimestamp = 0
}

export type { TeacherInfo, TeachersData }
