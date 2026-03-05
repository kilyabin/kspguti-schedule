import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcrypt'
import type { GroupInfo, GroupsData } from './groups-loader'
import type { AppSettings } from './settings-loader'

// Определяем корень проекта для хранения базы данных
function getDatabaseDir(): string {
  // Если указан путь через переменную окружения, используем его
  if (process.env.DATABASE_DIR) {
    console.log(`[Database] Using DATABASE_DIR from env: ${process.env.DATABASE_DIR}`)
    return process.env.DATABASE_DIR
  }

  // В production режиме (standalone) используем стандартный путь
  const cwd = process.cwd()
  console.log(`[Database] process.cwd(): ${cwd}`)

  // Если мы в .next/standalone, поднимаемся на 2 уровня вверх к корню проекта
  if (cwd.includes('.next/standalone')) {
    // В standalone режиме process.cwd() = /opt/kspguti-schedule/.next/standalone
    // Нужно подняться до /opt/kspguti-schedule
    const standaloneMatch = cwd.match(/^(.+?)\/\.next\/standalone/)
    if (standaloneMatch && standaloneMatch[1]) {
      console.log(`[Database] Detected standalone mode, using: ${standaloneMatch[1]}`)
      return standaloneMatch[1]
    }
    // Альтернативный способ: подняться на 2 уровня вверх
    const parentDir = path.resolve(cwd, '..', '..')
    console.log(`[Database] Fallback to parent directory: ${parentDir}`)
    return parentDir
  }

  // Проверяем стандартный путь для production
  if (fs.existsSync('/opt/kspguti-schedule')) {
    console.log('[Database] Using /opt/kspguti-schedule')
    return '/opt/kspguti-schedule'
  }

  // В development используем текущую директорию
  console.log(`[Database] Using cwd: ${cwd}`)
  return cwd
}

// Путь к директории базы данных
const DATABASE_DIR = getDatabaseDir()
const DB_PATH = path.join(DATABASE_DIR, 'db', 'schedule-app.db')
const DEFAULT_PASSWORD = 'ksadmin'

// Путь к старой базе данных (для миграции)
const OLD_DB_PATH = path.join(DATABASE_DIR, 'data', 'schedule-app.db')

console.log(`[Database] DB_PATH: ${DB_PATH}`)

// Создаем директорию db, если её нет
const dbDir = path.dirname(DB_PATH)
console.log(`[Database] dbDir: ${dbDir}`)

if (!fs.existsSync(dbDir)) {
  console.log(`[Database] Creating directory: ${dbDir}`)
  try {
    fs.mkdirSync(dbDir, { recursive: true })
    console.log(`[Database] Directory created successfully`)
  } catch (error) {
    console.error(`[Database] Failed to create directory ${dbDir}:`, error)
    throw new Error(`Failed to create database directory: ${dbDir}`)
  }
}

// Проверяем, можем ли записывать в директорию
try {
  const testFile = path.join(dbDir, '.write-test')
  fs.writeFileSync(testFile, 'test')
  fs.unlinkSync(testFile)
  console.log('[Database] Directory is writable')
} catch (error) {
  console.error(`[Database] Directory ${dbDir} is not writable:`, error)
}

// Миграция базы данных из data/ в db/ (если старая база существует)
function migrateDatabaseLocation(): void {
  // Если новая база уже существует, миграция не нужна
  if (fs.existsSync(DB_PATH)) {
    return
  }
  
  // Если старая база существует, перемещаем её
  if (fs.existsSync(OLD_DB_PATH)) {
    try {
      console.log('Migrating database from data/ to db/...')
      fs.renameSync(OLD_DB_PATH, DB_PATH)
      
      // Также перемещаем вспомогательные файлы SQLite (WAL mode)
      const oldShmPath = OLD_DB_PATH + '-shm'
      const oldWalPath = OLD_DB_PATH + '-wal'
      const newShmPath = DB_PATH + '-shm'
      const newWalPath = DB_PATH + '-wal'
      
      if (fs.existsSync(oldShmPath)) {
        fs.renameSync(oldShmPath, newShmPath)
      }
      if (fs.existsSync(oldWalPath)) {
        fs.renameSync(oldWalPath, newWalPath)
      }
      
      console.log('Database successfully migrated to db/ directory')
    } catch (error) {
      console.error('Error migrating database:', error)
      // Не падаем, просто продолжаем работу
    }
  }
}

// Инициализация базы данных
let db: Database.Database | null = null

function getDatabase(): Database.Database {
  if (db) {
    return db
  }

  console.log('[Database] Initializing database connection...')
  console.log(`[Database] DB_PATH: ${DB_PATH}`)
  console.log(`[Database] DB_PATH exists: ${fs.existsSync(DB_PATH)}`)

  // Выполняем миграцию расположения базы данных перед открытием
  migrateDatabaseLocation()

  try {
    console.log('[Database] Opening database...')
    db = new Database(DB_PATH)
    console.log('[Database] Database opened successfully')

    // Проверяем, можем ли записывать
    try {
      db.exec('SELECT 1')
      console.log('[Database] Database is writable')
    } catch (error) {
      console.error('[Database] Database is not writable:', error)
      throw new Error('Database is not writable: ' + (error as Error).message)
    }

    // Применяем современные настройки SQLite
    db.pragma('journal_mode = WAL') // Write-Ahead Logging для лучшей производительности
    db.pragma('synchronous = NORMAL') // Баланс между производительностью и надежностью
    db.pragma('foreign_keys = ON') // Включение проверки внешних ключей
    db.pragma('busy_timeout = 5000') // Таймаут для ожидания блокировок (5 секунд)
    db.pragma('temp_store = MEMORY') // Хранение временных данных в памяти
    db.pragma('mmap_size = 268435456') // Memory-mapped I/O (256MB)
    db.pragma('cache_size = -64000') // Размер кеша в страницах (64MB)

    console.log('[Database] SQLite pragmas applied')

    // Создаем таблицы, если их нет
    initializeTables()

    // Выполняем миграцию данных из JSON, если БД пустая
    migrateFromJSON()

    console.log('[Database] Database initialization complete')
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error)
    throw error
  }

  return db
}

function initializeTables(): void {
  const database = getDatabase()

  // Таблица групп
  database.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      parseId INTEGER NOT NULL,
      name TEXT NOT NULL,
      course INTEGER NOT NULL CHECK(course >= 1 AND course <= 5)
    )
  `)

  // Таблица настроек
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Таблица админ пароля
  database.exec(`
    CREATE TABLE IF NOT EXISTS admin_password (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      password_hash TEXT NOT NULL
    )
  `)

  // Таблица преподавателей
  database.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      parseId INTEGER NOT NULL,
      name TEXT NOT NULL
    )
  `)
}

// ==================== Функции для работы с группами ====================

export function getAllGroups(): GroupsData {
  const database = getDatabase()
  const rows = database.prepare('SELECT id, parseId, name, course FROM groups').all() as Array<{
    id: string
    parseId: number
    name: string
    course: number
  }>

  const groups: GroupsData = {}
  for (const row of rows) {
    groups[row.id] = {
      parseId: row.parseId,
      name: row.name,
      course: row.course
    }
  }

  return groups
}

export function getGroup(id: string): GroupInfo | null {
  const database = getDatabase()
  const row = database.prepare('SELECT parseId, name, course FROM groups WHERE id = ?').get(id) as {
    parseId: number
    name: string
    course: number
  } | undefined

  if (!row) {
    return null
  }

  return {
    parseId: row.parseId,
    name: row.name,
    course: row.course
  }
}

export function createGroup(id: string, group: GroupInfo): void {
  const database = getDatabase()
  database
    .prepare('INSERT INTO groups (id, parseId, name, course) VALUES (?, ?, ?, ?)')
    .run(id, group.parseId, group.name, group.course)
}

export function updateGroup(id: string, group: Partial<GroupInfo>): void {
  const database = getDatabase()
  const existing = getGroup(id)
  if (!existing) {
    throw new Error(`Group with id ${id} not found`)
  }

  const updated: GroupInfo = {
    parseId: group.parseId !== undefined ? group.parseId : existing.parseId,
    name: group.name !== undefined ? group.name : existing.name,
    course: group.course !== undefined ? group.course : existing.course
  }

  database
    .prepare('UPDATE groups SET parseId = ?, name = ?, course = ? WHERE id = ?')
    .run(updated.parseId, updated.name, updated.course, id)
}

export function deleteGroup(id: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM groups WHERE id = ?').run(id)
}

// ==================== Функции для работы с преподавателями ====================

export type TeacherInfo = {
  parseId: number
  name: string
}

export type TeachersData = { [teacherId: string]: TeacherInfo }

export function getAllTeachers(): TeachersData {
  const database = getDatabase()
  const rows = database.prepare('SELECT id, parseId, name FROM teachers').all() as Array<{
    id: string
    parseId: number
    name: string
  }>

  const teachers: TeachersData = {}
  for (const row of rows) {
    teachers[row.id] = {
      parseId: row.parseId,
      name: row.name
    }
  }

  console.log(`[Database] getAllTeachers: found ${Object.keys(teachers).length} teachers`)
  return teachers
}

export function getTeacher(id: string): TeacherInfo | null {
  const database = getDatabase()
  const row = database.prepare('SELECT parseId, name FROM teachers WHERE id = ?').get(id) as {
    parseId: number
    name: string
  } | undefined

  if (!row) {
    return null
  }

  return {
    parseId: row.parseId,
    name: row.name
  }
}

export function getTeacherByParseId(parseId: number): { id: string; name: string } | null {
  const database = getDatabase()
  const row = database.prepare('SELECT id, name FROM teachers WHERE parseId = ?').get(parseId) as {
    id: string
    name: string
  } | undefined

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name
  }
}

export function createTeacher(id: string, teacher: TeacherInfo): void {
  const database = getDatabase()
  database
    .prepare('INSERT INTO teachers (id, parseId, name) VALUES (?, ?, ?)')
    .run(id, teacher.parseId, teacher.name)
}

export function updateTeacher(id: string, teacher: Partial<TeacherInfo>): void {
  const database = getDatabase()
  const existing = getTeacher(id)
  if (!existing) {
    throw new Error(`Teacher with id ${id} not found`)
  }

  const updated: TeacherInfo = {
    parseId: teacher.parseId !== undefined ? teacher.parseId : existing.parseId,
    name: teacher.name !== undefined ? teacher.name : existing.name
  }

  database
    .prepare('UPDATE teachers SET parseId = ?, name = ? WHERE id = ?')
    .run(updated.parseId, updated.name, id)
}

export function deleteTeacher(id: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM teachers WHERE id = ?').run(id)
}

/**
 * Получает timestamp последнего обновления списка преподавателей
 */
export function getTeachersLastUpdateTime(): number | null {
  const database = getDatabase()
  const row = database.prepare('SELECT value FROM settings WHERE key = ?').get('teachers_last_update') as {
    value: string
  } | undefined

  if (!row) {
    return null
  }

  try {
    return Number(row.value)
  } catch (error) {
    console.error('Error parsing teachers last update time:', error)
    return null
  }
}

/**
 * Сохраняет timestamp последнего обновления списка преподавателей
 */
export function setTeachersLastUpdateTime(timestamp: number): void {
  const database = getDatabase()
  database
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('teachers_last_update', String(timestamp))
}

// ==================== Функции для работы с настройками ====================

export function getSettings(): AppSettings {
  const database = getDatabase()
  const row = database.prepare('SELECT value FROM settings WHERE key = ?').get('app') as {
    value: string
  } | undefined

  if (!row) {
    // Возвращаем настройки по умолчанию
    const defaultSettings: AppSettings = {
      weekNavigationEnabled: false,
      showAddGroupButton: true,
      showTeachersButton: true,
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

  try {
    const settings = JSON.parse(row.value) as Partial<AppSettings>
    // Всегда добавляем дефолтные debug настройки (они не хранятся в БД)
    // И добавляем отсутствующие поля для обратной совместимости
    return {
      weekNavigationEnabled: settings.weekNavigationEnabled ?? false,
      showAddGroupButton: settings.showAddGroupButton ?? true,
      showTeachersButton: settings.showTeachersButton ?? true,
      vacationModeEnabled: settings.vacationModeEnabled ?? false,
      vacationModeContent: settings.vacationModeContent ?? '',
      ...settings,
      debug: {
        forceCache: false,
        forceEmpty: false,
        forceError: false,
        forceTimeout: false,
        showCacheInfo: false
      }
    }
  } catch (error) {
    console.error('Error parsing settings from database:', error)
    const defaultSettings: AppSettings = {
      weekNavigationEnabled: false,
      showAddGroupButton: true,
      showTeachersButton: true,
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

export function updateSettings(settings: AppSettings): void {
  const database = getDatabase()
  const defaultSettings: AppSettings = {
    weekNavigationEnabled: false,
    showAddGroupButton: true,
    showTeachersButton: true,
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

  // Исключаем debug из настроек перед сохранением в БД
  const { debug, ...settingsWithoutDebug } = settings
  const mergedSettings: AppSettings = {
    ...defaultSettings,
    ...settingsWithoutDebug
    // debug намеренно не сохраняется в БД
  }

  database
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('app', JSON.stringify(mergedSettings))
}

// ==================== Функции для работы с паролем ====================

export function getPasswordHash(): string | null {
  const database = getDatabase()
  const row = database.prepare('SELECT password_hash FROM admin_password WHERE id = 1').get() as {
    password_hash: string
  } | undefined

  return row?.password_hash || null
}

export function setPasswordHash(hash: string): void {
  const database = getDatabase()
  database.prepare('INSERT OR REPLACE INTO admin_password (id, password_hash) VALUES (1, ?)').run(hash)
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = getPasswordHash()
  if (!hash) {
    return false
  }

  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    console.error('Error verifying password:', error)
    return false
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  // Проверяем старый пароль
  const isValid = await verifyPassword(oldPassword)
  if (!isValid) {
    return false
  }

  // Хэшируем новый пароль
  const saltRounds = 10
  const newHash = await bcrypt.hash(newPassword, saltRounds)

  // Сохраняем новый хэш
  setPasswordHash(newHash)
  return true
}

export async function isDefaultPassword(): Promise<boolean> {
  const hash = getPasswordHash()
  if (!hash) {
    return true // Если пароля нет, считаем что используется дефолтный
  }

  // Проверяем, соответствует ли хэш дефолтному паролю
  return await bcrypt.compare(DEFAULT_PASSWORD, hash)
}

// ==================== Миграция данных из JSON ====================

function migrateFromJSON(): void {
  const database = getDatabase()

  // Проверяем, есть ли уже данные в БД
  const groupsCount = database.prepare('SELECT COUNT(*) as count FROM groups').get() as { count: number }
  const settingsCount = database.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number }
  const passwordExists = database.prepare('SELECT COUNT(*) as count FROM admin_password WHERE id = 1').get() as {
    count: number
  }

  // Мигрируем группы из JSON, если БД пустая
  if (groupsCount.count === 0) {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'src/shared/data/groups.json'),
        path.join(process.cwd(), '.next/standalone/src/shared/data/groups.json'),
        path.join(process.cwd(), 'groups.json')
      ]

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const fileContents = fs.readFileSync(filePath, 'utf8')
          const rawGroups = JSON.parse(fileContents) as GroupsData | { [key: string]: [number, string] | GroupInfo }

          // Мигрируем данные
          const insertStmt = database.prepare('INSERT INTO groups (id, parseId, name, course) VALUES (?, ?, ?, ?)')
          const transaction = database.transaction((groups: GroupsData) => {
            for (const [id, data] of Object.entries(groups)) {
              let group: GroupInfo
              if (Array.isArray(data) && data.length === 2 && typeof data[0] === 'number' && typeof data[1] === 'string') {
                // Старый формат [parseId, name]
                group = {
                  parseId: data[0],
                  name: data[1],
                  course: 1
                }
              } else if (typeof data === 'object' && 'parseId' in data && 'name' in data) {
                group = data as GroupInfo
              } else {
                continue
              }
              insertStmt.run(id, group.parseId, group.name, group.course)
            }
          })

          transaction(rawGroups as GroupsData)
          console.log('Groups migrated from JSON to database')
          break
        }
      }
    } catch (error) {
      console.error('Error migrating groups from JSON:', error)
    }
  }

  // Мигрируем настройки из JSON, если БД пустая
  if (settingsCount.count === 0) {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'src/shared/data/settings.json'),
        path.join(process.cwd(), '.next/standalone/src/shared/data/settings.json'),
        path.join(process.cwd(), 'settings.json')
      ]

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const fileContents = fs.readFileSync(filePath, 'utf8')
          const settings = JSON.parse(fileContents) as AppSettings
          updateSettings(settings)
          console.log('Settings migrated from JSON to database')
          break
        }
      }
    } catch (error) {
      console.error('Error migrating settings from JSON:', error)
    }
  }

  // Инициализируем дефолтный пароль, если его нет
  if (passwordExists.count === 0) {
    const saltRounds = 10
    try {
      // Используем синхронную версию для инициализации при старте
      const hash = bcrypt.hashSync(DEFAULT_PASSWORD, saltRounds)
      setPasswordHash(hash)
      console.log('Default password "ksadmin" initialized')
    } catch (err) {
      console.error('Error hashing default password:', err)
    }
  }

  // Мигрируем преподавателей из teachers.ts, если БД пустая
  const teachersCount = database.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number }
  if (teachersCount.count === 0) {
    try {
      // Пытаемся импортировать преподавателей из teachers.ts
      const possiblePaths = [
        path.join(process.cwd(), 'src/shared/data/teachers.ts'),
        path.join(process.cwd(), '.next/standalone/src/shared/data/teachers.ts'),
        path.join(process.cwd(), 'teachers.ts')
      ]

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log(`Migrating teachers from ${filePath}...`)
          // Читаем файл и извлекаем JSON массив
          const fileContents = fs.readFileSync(filePath, 'utf8')
          const jsonMatch = fileContents.match(/export const teachers = (\[[\s\S]*?\])/)
          if (jsonMatch && jsonMatch[1]) {
            const teachersArray = JSON.parse(jsonMatch[1]) as Array<{ name: string }>
            
            const insertStmt = database.prepare('INSERT INTO teachers (id, parseId, name) VALUES (?, ?, ?)')
            const transaction = database.transaction((teachers: Array<{ name: string }>) => {
              teachers.forEach((teacher, index) => {
                if (teacher.name) {
                  // Используем индекс как parseId, так как в teachers.ts нет parseId
                  const id = String(index + 1)
                  insertStmt.run(id, index + 1, teacher.name)
                }
              })
            })

            transaction(teachersArray)
            console.log(`Teachers migrated from teachers.ts: ${teachersArray.length} teachers`)
            break
          }
        }
      }
    } catch (error) {
      console.error('Error migrating teachers from teachers.ts:', error)
    }
  }
}

// Экспортируем функцию для закрытия соединения (полезно для тестов)
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

