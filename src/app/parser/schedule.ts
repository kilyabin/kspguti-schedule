import { Day } from '@/shared/model/day'
import { Lesson } from '@/shared/model/lesson'
import { logDebug } from '@/app/logger'

export type WeekInfo = {
  wk: number
  weekNumber: number
}

export type ParseResult = {
  days: Day[]
  currentWk?: number
  availableWeeks?: WeekInfo[]
}

const dayTitleParser = (text: string) => {
  const trimmed = text.trim()
  // Поддерживаем оба формата: с пробелом " / " и без пробела "/"
  const parts = trimmed.split(/\s*\/\s*/)
  
  if (parts.length < 2) {
    throw new Error(`Invalid day title format: ${trimmed}`)
  }
  
  const [dateString, week] = parts
  if (!dateString || !week) {
    throw new Error(`Invalid day title format: ${trimmed}`)
  }
  
  const weekMatch = week.trim().match(/^(\d+)\s+неделя$/)
  if (!weekMatch) {
    throw new Error(`Invalid week format: ${week}`)
  }
  
  const weekNumber = Number(weekMatch[1])
  
  const dateMatch = dateString.trim().match(/^[а-яА-Я]+ (\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateString}`)
  }
  
  const [, day, month, year] = dateMatch
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12)
  return { date, weekNumber }
}

/**
 * Парсит ссылки навигации по неделям из HTML страницы
 * Ищет ссылки вида ?mn=2&obj=XXX&wk=YYY и извлекает wk и weekNumber
 */
function parseWeekNavigation(document: Document, currentWeekNumber: number, currentWk?: number): WeekInfo[] {
  const weeks: WeekInfo[] = []
  
  // Ищем все ссылки, которые содержат параметр wk
  const links = Array.from(document.querySelectorAll('a[href*="wk="]'))
  const linksWithOnclick = Array.from(document.querySelectorAll('a[onclick*="wk="], a[onclick*="wk"]'))
  const elementsWithDataHref = Array.from(document.querySelectorAll('[data-href*="wk="]'))
  
  const allLinkElementsSet = new Set<Element>()
  links.forEach(el => allLinkElementsSet.add(el))
  linksWithOnclick.forEach(el => allLinkElementsSet.add(el))
  elementsWithDataHref.forEach(el => allLinkElementsSet.add(el))
  const allLinkElements = Array.from(allLinkElementsSet)
  
  for (const link of allLinkElements) {
    const href = link.getAttribute('href')
    const onclick = link.getAttribute('onclick')
    const dataHref = link.getAttribute('data-href')
    
    const urlString = href || onclick || dataHref || ''
    if (!urlString) continue
    
    const wkMatch = urlString.match(/[?&]wk=(\d+)/)
    if (wkMatch) {
      const wk = Number(wkMatch[1])
      const linkText = link.textContent?.trim() || ''
      const parentText = link.parentElement?.textContent?.trim() || ''
      const combinedText = `${linkText} ${parentText}`
      
      const weekNumberMatch = combinedText.match(/(\d+)\s*недел/i)
      const weekNumber = weekNumberMatch ? Number(weekNumberMatch[1]) : undefined
      
      if (weekNumber !== undefined) {
        if (!weeks.some(w => w.wk === wk)) {
          weeks.push({ wk, weekNumber })
        }
      }
    }
  }
  
  return weeks.sort((a, b) => a.weekNumber - b.weekNumber)
}

function parseLesson(row: Element, isTeacherSchedule: boolean): Lesson | null {
  try {
    const cells = Array.from(row.querySelectorAll(':scope > td'))
    if (cells.length < 4) return null

    const timeText = cells[1].textContent?.trim() || ''
    const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*–\s*(\d{1,2}:\d{2})/)
    if (!timeMatch) return null

    const lessonType = cells[2].textContent?.trim() || ''
    const contentCell = cells[3]
    
    let subject = ''
    let teacher = ''
    let location = ''
    let roomText = ''

    if (isTeacherSchedule) {
      subject = contentCell.childNodes[0]?.textContent?.trim() || ''
      const groupMatch = contentCell.textContent?.match(/Группа:\s*(.+)/)
      if (groupMatch) {
        teacher = groupMatch[1].trim()
      }
    } else {
      const lines = Array.from(contentCell.childNodes)
        .map(node => node.textContent?.trim())
        .filter(text => text)

      subject = lines[0] || ''
      teacher = lines[1] || ''
      
      const fontElement = contentCell.querySelector('font')
      if (fontElement) {
        const fontText = fontElement.textContent?.trim() || ''
        const parts = fontText.split(',')
        location = parts[0]?.trim() || ''
        roomText = parts[1]?.trim() || ''
      }
    }

    const lesson: Lesson = {
      time: {
        start: timeMatch[1],
        end: timeMatch[2],
      },
      type: lessonType,
      topic: cells[4]?.textContent?.trim() || '',
      resources: [],
      homework: cells[6]?.textContent?.trim() || '',
      subject: subject || '',
      teacher: teacher || '',
    }

    if (location || roomText) {
      (lesson as any).place = {
        address: location || '',
        classroom: roomText || '',
      }
    }

    // Ресурсы
    if (cells[5]) {
      Array.from(cells[5].querySelectorAll('a')).forEach(a => {
        const title = a.textContent?.trim()
        const url = a.getAttribute('href')
        if (title && url) {
          lesson.resources.push({ type: 'link', title, url })
        }
      })
    }

    return lesson
  } catch (e) {
    console.error('Error parsing lesson', e)
    return null
  }
}

function parseGroupSchedule(
  document: Document,
  groupName: string,
  url?: string,
  shouldParseWeekNavigation: boolean = true
): ParseResult {
  const tables = Array.from(document.querySelectorAll('table'))
  const table = tables.find((t) => {
    const text = t.textContent || ''
    return text.includes(groupName) && text.includes('Дисциплина, преподаватель')
  })

  if (!table) throw new Error(`Table not found for group ${groupName}`)

  const allRows = Array.from(table.querySelectorAll('tr'))
  const days: Day[] = []
  let dayInfo: Partial<Day> = {}
  let dayLessons: Lesson[] = []
  let currentWeekNumber: number | undefined

  for (const row of allRows) {
    const rowText = row.textContent?.trim() || ''
    if (!rowText) continue

    const h3Element = row.querySelector('h3')
    const rawTitle = h3Element?.textContent?.trim() || ''
    const isDayTitleRow = /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s+неделя/i.test(rawTitle)

    if (isDayTitleRow) {
      if (dayInfo.date && dayLessons.length > 0) {
        days.push({ ...dayInfo as Day, lessons: dayLessons })
        dayLessons = []
        dayInfo = {}
      }

      try {
        const { date, weekNumber } = dayTitleParser(rawTitle)
        dayInfo.date = date
        dayInfo.weekNumber = weekNumber
        if (!currentWeekNumber) currentWeekNumber = weekNumber
      } catch (e) {
        logDebug('parseGroupSchedule: error', { rawTitle, e })
      }
      continue
    }

    const cells = Array.from(row.querySelectorAll(':scope > td'))
    if (cells.length > 0 && /^\d+$/.test(cells[0].textContent?.trim() || '')) {
      if (dayInfo.date) {
        const lesson = parseLesson(row, false)
        if (lesson) dayLessons.push(lesson)
      }
    }
  }

  if (dayInfo.date && dayLessons.length > 0) {
    days.push({ ...dayInfo as Day, lessons: dayLessons })
  }

  const currentUrl = url || (typeof document !== 'undefined' ? document.location?.href : '') || ''
  const wkMatch = currentUrl.match(/[?&]wk=(\d+)/)
  let currentWk = wkMatch ? Number(wkMatch[1]) : undefined
  let availableWeeks: WeekInfo[] | undefined

  if (shouldParseWeekNavigation && currentWeekNumber) {
    availableWeeks = parseWeekNavigation(document, currentWeekNumber, currentWk)
    if (availableWeeks.length === 0 && currentWk) {
      availableWeeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
    }
    if (!currentWk && availableWeeks.length > 0) {
      const found = availableWeeks.find(w => w.weekNumber === currentWeekNumber)
      currentWk = found ? found.wk : availableWeeks[0].wk
    }
  }

  return { days, currentWk, availableWeeks }
}

function parseTeacherSchedule(
  document: Document,
  url?: string,
  shouldParseWeekNavigation: boolean = true
): ParseResult {
  const tables = Array.from(document.querySelectorAll('table'))
  const table = tables.find(t => {
    const text = t.textContent || ''
    return /Понедельник|Вторник|Среда|Четверг|Пятница|Суббота/.test(text) && text.includes('Дисциплина, преподаватель')
  })

  if (!table) throw new Error('Teacher schedule table not found')

  const allRows = Array.from(table.querySelectorAll('tr'))
  const days: Day[] = []
  let dayInfo: Partial<Day> = {}
  let dayLessons: Lesson[] = []
  let currentWeekNumber: number | undefined

  for (const row of allRows) {
    const h3Element = row.querySelector('h3')
    const rawTitle = h3Element?.textContent?.trim() || ''
    const isDayTitleRow = /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s+неделя/i.test(rawTitle)

    if (isDayTitleRow) {
      if (dayInfo.date && dayLessons.length > 0) {
        days.push({ ...dayInfo as Day, lessons: dayLessons })
        dayLessons = []
        dayInfo = {}
      }
      try {
        const { date, weekNumber } = dayTitleParser(rawTitle)
        dayInfo.date = date
        dayInfo.weekNumber = weekNumber
        if (!currentWeekNumber) currentWeekNumber = weekNumber
      } catch (e) {}
      continue
    }

    const cells = Array.from(row.querySelectorAll(':scope > td'))
    if (cells.length > 0 && /^\d+$/.test(cells[0].textContent?.trim() || '')) {
      if (dayInfo.date) {
        const lesson = parseLesson(row, true)
        if (lesson) dayLessons.push(lesson)
      }
    }
  }

  if (dayInfo.date && dayLessons.length > 0) {
    days.push({ ...dayInfo as Day, lessons: dayLessons })
  }

  const currentUrl = url || (typeof document !== 'undefined' ? document.location?.href : '') || ''
  const wkMatch = currentUrl.match(/[?&]wk=(\d+)/)
  let currentWk = wkMatch ? Number(wkMatch[1]) : undefined
  let availableWeeks: WeekInfo[] | undefined

  if (shouldParseWeekNavigation && currentWeekNumber) {
    availableWeeks = parseWeekNavigation(document, currentWeekNumber, currentWk)
    if (!currentWk && availableWeeks.length > 0) {
      const found = availableWeeks.find(w => w.weekNumber === currentWeekNumber)
      currentWk = found ? found.wk : availableWeeks[0].wk
    }
  }

  return { days, currentWk, availableWeeks }
}

export function parsePage(
  document: Document,
  groupName: string,
  url?: string,
  shouldParseWeekNavigation: boolean = true,
  isTeacherSchedule: boolean = false
): ParseResult {
  if (isTeacherSchedule) {
    return parseTeacherSchedule(document, url, shouldParseWeekNavigation)
  }
  return parseGroupSchedule(document, groupName, url, shouldParseWeekNavigation)
}
