import { getAllGroups as getAllGroupsFromDB, createGroup, updateGroup, deleteGroup, getGroup } from './database'

export type GroupInfo = {
  parseId: number
  name: string
  course: number
}

export type GroupsData = { [group: string]: GroupInfo }

let cachedGroups: GroupsData | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 1000 * 60 // 1 минута

/**
 * Загружает группы из базы данных
 * Использует кеш с TTL для оптимизации, но всегда загружает свежие данные при необходимости
 */
export function loadGroups(forceRefresh: boolean = false): GroupsData {
  const now = Date.now()
  const isCacheValid = cachedGroups !== null && !forceRefresh && (now - cacheTimestamp) < CACHE_TTL_MS
  
  if (isCacheValid && cachedGroups !== null) {
    return cachedGroups
  }

  try {
    cachedGroups = getAllGroupsFromDB()
    cacheTimestamp = now
    return cachedGroups
  } catch (error) {
    console.error('Error loading groups from database:', error)
    // Fallback к пустому объекту
    return {}
  }
}

/**
 * Сохраняет группы в базу данных
 */
export function saveGroups(groups: GroupsData): void {
  try {
    const existingGroups = getAllGroupsFromDB()
    
    // Определяем, какие группы нужно добавить, обновить или удалить
    const existingIds = new Set(Object.keys(existingGroups))
    const newIds = new Set(Object.keys(groups))

    // Добавляем или обновляем группы
    for (const [id, group] of Object.entries(groups)) {
      if (existingIds.has(id)) {
        updateGroup(id, group)
      } else {
        createGroup(id, group)
      }
    }

    // Удаляем группы, которых больше нет
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        deleteGroup(id)
      }
    }

    // Сбрасываем кеш и timestamp
    cachedGroups = null
    cacheTimestamp = 0
  } catch (error) {
    console.error('Error saving groups to database:', error)
    throw new Error('Failed to save groups')
  }
}

/**
 * Сбрасывает кеш групп (полезно после обновления)
 */
export function clearGroupsCache(): void {
  cachedGroups = null
  cacheTimestamp = 0
}

