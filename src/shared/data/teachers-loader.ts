import { getAllTeachers as getAllTeachersFromDB, createTeacher, updateTeacher, deleteTeacher, getTeacher, getDatabase, type TeacherInfo, type TeachersData } from './database'
import type { Database } from 'better-sqlite3'

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

    // Получаем ссылки на подготовленные выражения для транзакции
    const database = getDatabase() as Database
    const insertStmt = database.prepare('INSERT INTO teachers (id, parseId, name) VALUES (?, ?, ?)')
    const updateStmt = database.prepare('UPDATE teachers SET parseId = ?, name = ? WHERE id = ?')
    const deleteStmt = database.prepare('DELETE FROM teachers WHERE id = ?')

    // Выполняем все операции в транзакции для атомарности
    const saveTransaction = database.transaction((teachersData: TeachersData) => {
      // Добавляем или обновляем преподавателей
      for (const [id, teacher] of Object.entries(teachersData)) {
        if (existingIds.has(id)) {
          updateStmt.run(teacher.parseId, teacher.name, id)
        } else {
          insertStmt.run(id, teacher.parseId, teacher.name)
        }
      }

      // Удаляем преподавателей, которых больше нет
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          deleteStmt.run(id)
        }
      }
    })

    saveTransaction(teachers)

    // Сбрасываем кеш и timestamp после успешной транзакции
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
