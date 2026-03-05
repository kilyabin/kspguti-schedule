import { getAllGroups as getAllGroupsFromDB, createGroup, updateGroup, deleteGroup, getGroup, getDatabase } from './database'
import { SCHED_MODE } from '@/shared/constants/urls'
import { syncGroupsFromKspsutiIfNeeded } from '@/app/agregator/groups'
import type { Database } from 'better-sqlite3'

export type GroupInfo = {
  parseId: number
  name: string
  course: number
}

export type GroupsData = { [group: string]: GroupInfo }

let cachedGroups: GroupsData | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 1000 * 60 // 1 минута
const KSPSUTI_SYNC_TTL_MS = 1000 * 60 * 60 // 1 час

/**
 * Загружает группы из базы данных.
 * В режиме SCHED_MODE=kspsuti перед загрузкой пытается синхронизировать список групп с сайтом колледжа.
 * Использует кеш с TTL для оптимизации, но всегда загружает свежие данные при необходимости.
 */
export async function loadGroups(forceRefresh: boolean = false): Promise<GroupsData> {
  const now = Date.now()
  const isCacheValid = cachedGroups !== null && !forceRefresh && (now - cacheTimestamp) < CACHE_TTL_MS

  // В режиме kspsuti всегда проверяем синхронизацию, даже если кэш валиден
  if (SCHED_MODE === 'kspsuti') {
    const synced = await syncGroupsFromKspsutiIfNeeded(KSPSUTI_SYNC_TTL_MS)
    if (synced) {
      saveGroups(synced)
      // После saveGroups кеш уже сброшен, продолжаем загрузку из БД
    } else if (isCacheValid && cachedGroups !== null) {
      // Синхронизация не проводилась (TTL не истёк), используем кэш
      return cachedGroups
    }
  } else if (isCacheValid && cachedGroups !== null) {
    // В других режимах используем обычную логику кэширования
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

    // Получаем ссылки на подготовленные выражения для транзакции
    const database = getDatabase() as Database
    const insertStmt = database.prepare('INSERT INTO groups (id, parseId, name, course) VALUES (?, ?, ?, ?)')
    const updateStmt = database.prepare('UPDATE groups SET parseId = ?, name = ?, course = ? WHERE id = ?')
    const deleteStmt = database.prepare('DELETE FROM groups WHERE id = ?')

    // Выполняем все операции в транзакции для атомарности
    const saveTransaction = database.transaction((groupsData: GroupsData) => {
      // Добавляем или обновляем группы
      for (const [id, group] of Object.entries(groupsData)) {
        if (existingIds.has(id)) {
          updateStmt.run(group.parseId, group.name, group.course, id)
        } else {
          insertStmt.run(id, group.parseId, group.name, group.course)
        }
      }

      // Удаляем группы, которых больше нет
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          deleteStmt.run(id)
        }
      }
    })

    saveTransaction(groups)

    // Сбрасываем кеш и timestamp после успешной транзакции
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

