import { JSDOM } from 'jsdom'

export type TeacherListItem = {
  parseId: number
  name: string
}

/**
 * Парсит страницу со списком преподавателей (?mn=3)
 * Извлекает список преподавателей из таблицы/ссылок
 * @param document - DOM документ страницы
 * @returns Массив преподавателей с parseId и именем
 */
export function parseTeachersList(document: Document): TeacherListItem[] {
  const teachers: TeacherListItem[] = []

  // Способ 1: Ищем все ссылки, которые содержат ?mn=3&obj= или mn=3&obj=
  const links = Array.from(document.querySelectorAll('a[href*="?mn=3&obj="], a[href*="mn=3&obj="]'))

  for (const link of links) {
    const href = link.getAttribute('href')
    if (!href) continue

    // Парсим URL вида ?mn=3&obj=XXX или /?mn=3&obj=XXX
    const objMatch = href.match(/[?&]obj=(\d+)/)
    if (!objMatch) continue

    const parseId = Number(objMatch[1])
    if (isNaN(parseId) || parseId <= 0) continue

    // Извлекаем имя преподавателя из текста ссылки
    const name = link.textContent?.trim()
    if (!name || name.length === 0) continue

    // Проверяем, что это не дубликат
    if (!teachers.find(t => t.parseId === parseId)) {
      teachers.push({ parseId, name })
    }
  }

  // Способ 2: Если не нашли ссылки, пытаемся найти в таблице
  if (teachers.length === 0) {
    const tables = Array.from(document.querySelectorAll('table'))
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'))
      for (const row of rows) {
        const link = row.querySelector('a[href*="obj="]')
        if (!link) continue

        const href = link.getAttribute('href')
        if (!href || !href.includes('mn=3')) continue

        const objMatch = href.match(/[?&]obj=(\d+)/)
        if (!objMatch) continue

        const parseId = Number(objMatch[1])
        if (isNaN(parseId) || parseId <= 0) continue

        const name = link.textContent?.trim() || row.textContent?.trim()
        if (!name || name.length === 0) continue

        if (!teachers.find(t => t.parseId === parseId)) {
          teachers.push({ parseId, name })
        }
      }
    }
  }

  // Способ 3: Ищем все ссылки с obj= в URL (более общий поиск)
  if (teachers.length === 0) {
    const allLinks = Array.from(document.querySelectorAll('a[href*="obj="]'))
    for (const link of allLinks) {
      const href = link.getAttribute('href')
      if (!href) continue

      // Проверяем, что это mn=3 (преподаватели)
      if (!href.includes('mn=3')) continue

      const objMatch = href.match(/[?&]obj=(\d+)/)
      if (!objMatch) continue

      const parseId = Number(objMatch[1])
      if (isNaN(parseId) || parseId <= 0) continue

      const name = link.textContent?.trim()
      if (!name || name.length === 0) continue

      if (!teachers.find(t => t.parseId === parseId)) {
        teachers.push({ parseId, name })
      }
    }
  }

  // Способ 4: Ищем в формах и input элементах
  if (teachers.length === 0) {
    const forms = Array.from(document.querySelectorAll('form[action*="mn=3"]'))
    for (const form of forms) {
      const action = form.getAttribute('action') || ''
      const objMatch = action.match(/[?&]obj=(\d+)/)
      if (objMatch) {
        const parseId = Number(objMatch[1])
        if (!isNaN(parseId) && parseId > 0) {
          const name = form.textContent?.trim() || `Преподаватель ${parseId}`
          if (!teachers.find(t => t.parseId === parseId)) {
            teachers.push({ parseId, name })
          }
        }
      }
    }
  }

  // Сортируем по имени
  teachers.sort((a, b) => a.name.localeCompare(b.name))

  return teachers
}
