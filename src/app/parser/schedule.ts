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
  const wkToWeekNumber = new Map<number, number>()
  
  // Ищем все ссылки, которые содержат параметр wk
  // Используем более специфичные селекторы вместо перебора всех элементов
  const links = Array.from(document.querySelectorAll('a[href*="wk="]'))
  
  // Также ищем ссылки в onclick (только для ссылок, не всех элементов)
  const linksWithOnclick = Array.from(document.querySelectorAll('a[onclick*="wk="], a[onclick*="wk"]'))
  
  // Ищем в формах
  const forms = Array.from(document.querySelectorAll('form[action*="wk="], form input[name="wk"]'))
  
  // Ищем в элементах с data-атрибутами (только те, которые могут содержать ссылки)
  const elementsWithDataHref = Array.from(document.querySelectorAll('[data-href*="wk="]'))
  
  // Объединяем все найденные элементы (убираем дубликаты)
  const allLinkElementsSet = new Set<Element>()
  links.forEach(el => allLinkElementsSet.add(el))
  linksWithOnclick.forEach(el => allLinkElementsSet.add(el))
  elementsWithDataHref.forEach(el => allLinkElementsSet.add(el))
  const allLinkElements = Array.from(allLinkElementsSet)
  
  for (const link of allLinkElements) {
    // Пробуем извлечь wk из разных атрибутов
    const href = link.getAttribute('href')
    const onclick = link.getAttribute('onclick')
    const action = link.getAttribute('action')
    const dataHref = link.getAttribute('data-href')
    
    const urlString = href || onclick || action || dataHref || ''
    if (!urlString) continue
    
    // Парсим URL вида ?mn=2&obj=145&wk=308 или /?mn=2&obj=145&wk=308
    const wkMatch = urlString.match(/[?&]wk=(\d+)/)
    if (wkMatch) {
      const wk = Number(wkMatch[1])
      
      // Пытаемся найти номер недели из текста ссылки
      const linkText = link.textContent?.trim() || ''
      const parentText = link.parentElement?.textContent?.trim() || ''
      const combinedText = `${linkText} ${parentText}`
      
      // Ищем номер недели в тексте
      const weekNumberMatch = combinedText.match(/(\d+)\s*недел/i)
      let weekNumber = weekNumberMatch ? Number(weekNumberMatch[1]) : undefined
      
      // Если не нашли в тексте, пытаемся определить по контексту
      if (!weekNumber) {
        // Проверяем, есть ли указание на "следующую" или "предыдущую" неделю
        const isNext = /следующ/i.test(combinedText) || /вперёд/i.test(combinedText) || /next/i.test(combinedText) || /→/i.test(combinedText)
        const isPrev = /предыдущ/i.test(combinedText) || /назад/i.test(combinedText) || /prev/i.test(combinedText) || /←/i.test(combinedText)
        
        if (isNext && currentWeekNumber) {
          weekNumber = currentWeekNumber + 1
        } else if (isPrev && currentWeekNumber) {
          weekNumber = currentWeekNumber - 1
        } else {
          // Если не можем определить, используем текущий номер недели как fallback
          weekNumber = currentWeekNumber
        }
      }
      
      // Сохраняем связь wk -> weekNumber
      if (!wkToWeekNumber.has(wk)) {
        wkToWeekNumber.set(wk, weekNumber)
        weeks.push({ wk, weekNumber })
      }
    }
  }
  
  // Обрабатываем формы
  for (const form of forms) {
    if (form instanceof HTMLFormElement) {
      const action = form.getAttribute('action') || ''
      const wkMatch = action.match(/[?&]wk=(\d+)/)
      if (wkMatch) {
        const wk = Number(wkMatch[1])
        if (!wkToWeekNumber.has(wk)) {
          // Пытаемся найти номер недели в форме
          const formText = form.textContent?.trim() || ''
          const weekNumberMatch = formText.match(/(\d+)\s*недел/i)
          const weekNumber = weekNumberMatch ? Number(weekNumberMatch[1]) : currentWeekNumber
          wkToWeekNumber.set(wk, weekNumber)
          weeks.push({ wk, weekNumber })
        }
      }
    } else if (form instanceof HTMLInputElement) {
      const value = form.value
      if (value) {
        const wk = Number(value)
        if (!isNaN(wk) && !wkToWeekNumber.has(wk)) {
          const weekNumber = currentWeekNumber
          wkToWeekNumber.set(wk, weekNumber)
          weeks.push({ wk, weekNumber })
        }
      }
    }
  }
  
  // Если currentWk не определен, но нашли недели, пытаемся определить текущую
  if (!currentWk && weeks.length > 0) {
    // Ищем неделю с weekNumber равным currentWeekNumber
    const currentWeekInList = weeks.find(w => w.weekNumber === currentWeekNumber)
    if (currentWeekInList) {
      // Используем найденную неделю как текущую
      currentWk = currentWeekInList.wk
    } else {
      // Если не нашли точное совпадение, но есть недели с соседними номерами,
      // пытаемся определить текущую на основе позиции
      const sortedByWeekNumber = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber)
      const currentIndex = sortedByWeekNumber.findIndex(w => w.weekNumber === currentWeekNumber)
      
      if (currentIndex < 0 && sortedByWeekNumber.length > 0) {
        // Если текущая неделя не найдена, но есть соседние, вычисляем
        const firstWeek = sortedByWeekNumber[0]
        if (firstWeek.weekNumber === currentWeekNumber + 1) {
          // Первая найденная - следующая, значит текущая должна быть на 1 меньше по wk
          // Но мы не знаем разницу, поэтому используем первую найденную как следующую
        } else if (firstWeek.weekNumber === currentWeekNumber - 1) {
          // Первая найденная - предыдущая, значит текущая должна быть на 1 больше по wk
          // Вычисляем текущую неделю
          const wkDiff = sortedByWeekNumber.length > 1 
            ? sortedByWeekNumber[1].wk - firstWeek.wk 
            : 1 // Предполагаем разницу в 1
          currentWk = firstWeek.wk + wkDiff
          weeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
        }
      }
    }
  }
  
  // Всегда добавляем текущую неделю, если она еще не добавлена
  if (currentWk && !weeks.find(w => w.wk === currentWk)) {
    weeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
  }
  
  // Если нашли только одну соседнюю неделю, пытаемся вычислить другую
  if (weeks.length === 1 && currentWk && currentWeekNumber) {
    const foundWeek = weeks[0]
    
    // Если найденная неделя - следующая, пытаемся вычислить предыдущую
    if (foundWeek.weekNumber === currentWeekNumber + 1) {
      if (!weeks.find(w => w.wk === currentWk)) {
        weeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
      }
      // Вычисляем wk для предыдущей недели на основе разницы
      const wkDiff = foundWeek.wk - currentWk
      if (wkDiff !== 0) {
        const estimatedPrevWk = currentWk - wkDiff
        if (estimatedPrevWk > 0 && !weeks.find(w => w.wk === estimatedPrevWk)) {
          weeks.push({ wk: estimatedPrevWk, weekNumber: currentWeekNumber - 1 })
        }
      }
    }
    // Если найденная неделя - предыдущая, пытаемся вычислить следующую
    else if (foundWeek.weekNumber === currentWeekNumber - 1) {
      if (!weeks.find(w => w.wk === currentWk)) {
        weeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
      }
      // Вычисляем wk для следующей недели на основе разницы
      const wkDiff = currentWk - foundWeek.wk
      if (wkDiff !== 0) {
        const estimatedNextWk = currentWk + wkDiff
        if (estimatedNextWk > 0 && !weeks.find(w => w.wk === estimatedNextWk)) {
          weeks.push({ wk: estimatedNextWk, weekNumber: currentWeekNumber + 1 })
        }
      }
    }
    // Если это текущая неделя, пытаемся найти соседние
    else if (foundWeek.wk === currentWk) {
      // Уже есть текущая неделя, ничего не делаем
    }
  }
  
  // Если нашли несколько недель, но нет текущей, добавляем её
  if (weeks.length > 0 && currentWk && !weeks.find(w => w.wk === currentWk)) {
    weeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
  }
  
  // Если нашли недели, но не можем определить их weekNumber точно,
  // пытаемся вычислить на основе разницы в wk
  if (weeks.length > 1 && currentWk && currentWeekNumber) {
    const currentWeekInList = weeks.find(w => w.wk === currentWk)
    if (currentWeekInList) {
      // Сортируем по wk и пытаемся определить weekNumber для недель без него
      const sortedByWk = [...weeks].sort((a, b) => a.wk - b.wk)
      const currentIndex = sortedByWk.findIndex(w => w.wk === currentWk)
      
      if (currentIndex >= 0) {
        for (let i = 0; i < sortedByWk.length; i++) {
          const week = sortedByWk[i]
          const weekInResult = weeks.find(w => w.wk === week.wk)
          if (weekInResult && weekInResult.weekNumber === currentWeekNumber) {
            // Если weekNumber совпадает с текущим, но это не текущая неделя,
            // пересчитываем на основе позиции
            const diff = i - currentIndex
            weekInResult.weekNumber = currentWeekNumber + diff
          }
        }
      }
    }
  }
  
  return weeks.sort((a, b) => a.weekNumber - b.weekNumber)
}

// Парсер расписания групп (mn=2).
// Идет по строкам основной таблицы расписания и ищет заголовки дней (<h3>Понедельник 02.03.2026 / 8 неделя</h3>),
// а затем парсит строки с парами, опираясь на уже существующий parseLesson.
function parseGroupSchedule(
  document: Document,
  groupName: string,
  url?: string,
  shouldParseWeekNavigation: boolean = true
): ParseResult {
  const tables = Array.from(document.querySelectorAll('table'))

  // Находим таблицу, в которой есть название группы и заголовок "Дисциплина, преподаватель"
  const table = tables.find((t) => {
    const text = t.textContent || ''
    return text.includes(groupName) && text.includes('Дисциплина, преподаватель')
  })

  if (!table) {
    logDebug('parseGroupSchedule: table not found', { groupName, tablesCount: tables.length })
    throw new Error(`Table not found for group ${groupName}`)
  }

  const allRows = Array.from(table.querySelectorAll('tr'))

  const days: Day[] = []
  let dayInfo: Partial<Day> = {}
  let dayLessons: Lesson[] = []
  let currentWeekNumber: number | undefined

  for (const row of allRows) {
    const rowText = row.textContent?.trim() || ''
    if (!rowText) {
      continue
    }

    const looksLikeTableHeader = /№ пары|Время занятий|Дисциплина, преподаватель/i.test(rowText)
    const h3Element = row.querySelector('h3')
    const rawTitle = h3Element?.textContent?.trim() || ''
    const isDayTitleRow =
      /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s+неделя/i.test(
        rawTitle
      )

    // Заголовок дня
    if (isDayTitleRow) {
      // Сохраняем предыдущий день только если в нем есть пары,
      // иначе получаются дубликаты заголовков без занятий.
      if ('date' in dayInfo && dayLessons.length > 0) {
        days.push({ ...dayInfo, lessons: dayLessons } as Day)
        dayLessons = []
        dayInfo = {}
      }

      try {
        const { date, weekNumber } = dayTitleParser(rawTitle)
        dayInfo.date = date
        dayInfo.weekNumber = weekNumber
        if (!currentWeekNumber) {
          currentWeekNumber = weekNumber
        }
      } catch (e) {
        logDebug('parseGroupSchedule: failed to parse day title', { rawTitle, error: String(e) })
      }

      continue
    }

    // Пропускаем строку заголовков таблицы
    if (looksLikeTableHeader) {
      continue
    }

    const cells = Array.from(row.querySelectorAll(':scope > td'))
    if (cells.length === 0) continue

    const firstCellText = cells[0].textContent?.trim() || ''

    // Строка пары: первая ячейка — номер (цифра)
    if (/^\d+$/.test(firstCellText)) {
      const hasDayContext = 'date' in dayInfo
      if (!hasDayContext) {
        // На всякий случай логируем, но не падаем
        logDebug('parseGroupSchedule: lesson row without day context', {
          rowPreview: rowText.substring(0, 100),
        })
        continue
      }

      const lesson = parseLesson(row, false)
      if (lesson) {
        dayLessons.push(lesson)
      } else {
        logDebug('parseGroupSchedule: failed to parse lesson', {
          rowPreview: rowText.substring(0, 120),
        })
      }
    }
  }

  // Добавляем последний день
  if ('date' in dayInfo && dayLessons.length > 0) {
    days.push({ ...dayInfo, lessons: dayLessons } as Day)
  }

  // Извлекаем wk из URL
  const currentUrl = url || document.location?.href || ''
  const wkMatch = currentUrl.match(/[?&]wk=(\d+)/)
  let currentWk = wkMatch ? Number(wkMatch[1]) : undefined

  let availableWeeks: WeekInfo[] | undefined

  if (shouldParseWeekNavigation && currentWeekNumber) {
    availableWeeks = parseWeekNavigation(document, currentWeekNumber, currentWk)

    if (availableWeeks.length === 0 && currentWk) {
      availableWeeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
    }

    if (!currentWk && availableWeeks.length > 0) {
      const currentWeekInList = availableWeeks.find((w) => w.weekNumber === currentWeekNumber)
      if (currentWeekInList) {
        currentWk = currentWeekInList.wk
      } else {
        currentWk = availableWeeks[0].wk
      }
    }
  }

  return {
    days,
    currentWk,
    availableWeeks,
  }
}

// Специальный парсер для страницы расписания преподавателя (mn=3),
// максимально повторяющий логику python‑парсера из `py-teacher/app.py`.
function parseTeacherSchedule(
  document: Document,
  url?: string,
  shouldParseWeekNavigation: boolean = true
): ParseResult {
  const dayAnchors = Array.from(document.querySelectorAll('a.t_wth'))

  const days: Day[] = []
  let currentWeekNumber: number | undefined

  for (const anchor of dayAnchors) {
    const dayText = anchor.textContent?.trim() || ''
    // Пример: "Понедельник 02.03.2026/8 неделя"
    const m = dayText.match(/^(\S+)\s*(\d{2}\.\d{2}\.\d{4})\/(\d+)\s+неделя/i)
    if (!m) {
      continue
    }

    const [, , dateStr, weekNumStr] = m

    const [day, month, year] = dateStr.split('.').map(Number)
    const date = new Date(year, month - 1, day, 12)
    const weekNumber = Number(weekNumStr)

    if (!currentWeekNumber) {
      currentWeekNumber = weekNumber
    }

    // Ищем родительскую таблицу с парами (cellpadding="1")
    let parent: Element | null = anchor as Element
    for (let i = 0; i < 10 && parent; i++) {
      parent = parent.parentElement
      if (parent && parent.tagName === 'TABLE' && parent.getAttribute('cellpadding') === '1') {
        break
      }
    }

    const lessons: Lesson[] = []

    if (parent && parent.tagName === 'TABLE') {
      const rows = Array.from(parent.querySelectorAll(':scope > tbody > tr, :scope > tr'))
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll(':scope > td'))
        if (cells.length !== 4) continue

        const numText = cells[0].textContent?.trim() || ''
        if (!/^\d+$/.test(numText)) continue

        const timeText = cells[1].textContent?.trim() || ''
        if (!timeText) continue
        const [startTimeRaw, endTimeRaw] = timeText.split('–')
        const startTime = (startTimeRaw || '').trim()
        const endTime = (endTimeRaw || '').trim()

        const subjCell = cells[2]
        const roomText = cells[3].textContent?.trim() || ''

        // Извлекаем предмет, аудиторию и тип занятия по логике python‑парсера
        let subject = ''
        let group = ''
        let groupShort = ''
        let lessonType = ''
        let location = ''

        const bold = subjCell.querySelector('b')
        if (bold) {
          subject = bold.textContent?.trim() || ''
        }

        const fontGreen = subjCell.querySelector('font.t_green_10')
        if (fontGreen) {
          location = fontGreen.textContent?.trim() || ''
        }

        // Всё, что идёт после <b> до <font>, это строка с группой и типом занятия
        let raw = ''
        if (bold) {
          let node: ChildNode | null = bold.nextSibling
          while (node) {
            const nodeType = (node as any).nodeType
            // 1 — Element, 3 — Text в DOM API
            if (nodeType === 1) {
              const el = node as Element
              if (el.tagName === 'FONT') {
                break
              }
              if (el.tagName === 'BR') {
                node = el.nextSibling
                continue
              }
              raw += el.textContent?.trim() || ''
            } else if (nodeType === 3) {
              raw += (node.textContent || '').trim()
            }
            node = node.nextSibling
          }
        }

        raw = raw.trim()

        if (raw) {
          group = raw
          const mGrp = raw.match(/\(([^)]+)\)/)
          if (mGrp) {
            groupShort = mGrp[1]
          }

          const idx = raw.indexOf(')')
          const after = idx >= 0 ? raw.slice(idx + 1).trim() : ''
          if (after) {
            const unwrapped = after.replace(/^\((.+)\)$/, '$1').trim()
            const inner = unwrapped.match(/\(([^()]+)\)\s*$/)
            lessonType = inner ? inner[1] : unwrapped
          }
        }

        const lesson: Lesson = {
          time: {
            start: startTime || '',
            end: endTime || '',
          },
          type: lessonType,
          topic: '',
          resources: [],
          homework: '',
          subject: subject || groupShort || group || roomText,
        }

        // Если нет предмета и группы, это пустая пара
        if (!subject && !groupShort && !group) continue

        if (location || roomText) {
          lesson.place = {
            address: location || '',
            classroom: roomText || '',
          }
        }

        lessons.push(lesson)
      }
    }

    days.push({
      date,
      weekNumber,
      lessons,
    })
  }

  // Фильтруем пустые дни для преподавателей
  const filteredDays = days.filter(day => day.lessons.length > 0)

  // Извлекаем wk из URL
  const currentUrl = url || document.location?.href || ''
  const wkMatch = currentUrl.match(/[?&]wk=(\d+)/)
  let currentWk = wkMatch ? Number(wkMatch[1]) : undefined

  let availableWeeks: WeekInfo[] | undefined

  if (shouldParseWeekNavigation && currentWeekNumber) {
    availableWeeks = parseWeekNavigation(document, currentWeekNumber, currentWk)

    if (availableWeeks.length === 0 && currentWk) {
      availableWeeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
    }

    if (!currentWk && availableWeeks.length > 0) {
      const currentWeekInList = availableWeeks.find(w => w.weekNumber === currentWeekNumber)
      if (currentWeekInList) {
        currentWk = currentWeekInList.wk
      } else {
        currentWk = availableWeeks[0].wk
      }
    }
  }

  return {
    days: filteredDays,
    currentWk,
    availableWeeks,
  }
}

const parseLesson = (row: Element, isTeacherSchedule: boolean = false): Lesson | null => {
  const lesson: Partial<Lesson> & { fallbackDiscipline?: string, teacher?: string, place?: { address: string, classroom: string }, subject?: string } = {
    resources: [],
    homework: '',
    type: '',
    time: { start: '', end: '' }
  }

  try {
    const cells = Array.from(row.querySelectorAll(':scope > td'))
    
    lesson.isChange = cells.every(td => td.getAttribute('bgcolor') === 'ffffbb')
    
    // Проверяем наличие необходимых ячеек
    if (cells.length < 4) {
      // Для преподавателей может быть другая структура - проверяем минимум ячеек
      if (cells.length < 2) {
        return null
      }
    }
    
    // Для преподавателей ячейка с предметом может быть в другом индексе
    const disciplineCellIndex = cells.length >= 4 ? 3 : (cells.length >= 3 ? 2 : 1)
    const disciplineCell = cells[disciplineCellIndex]
    
    // Пропускаем урок только если это НЕ замена И в ячейке "Свободное время"
    if (disciplineCell && !lesson.isChange && disciplineCell.textContent?.trim() === 'Свободное время') {
      return null
    }

    // Проверяем наличие ячейки времени
    if (!cells[1]) {
      return null
    }
    
    // Для времени может быть разная структура
    let timeText = ''
    if (cells[1].childNodes[0]) {
      timeText = cells[1].childNodes[0].textContent?.trim() || ''
    } else {
      // Если нет childNodes, берем весь текст ячейки
      timeText = cells[1].textContent?.trim() || ''
    }
    
    if (!timeText) {
      return null
    }
    // Парсим время (уже извлечено выше)
    const [startTime, endTime] = timeText.split(' – ')
    lesson.time = {
      start: startTime ?? '',
      end: endTime ?? ''
    }
    
    // Пытаемся найти hint для времени
    const timeCell = cells[1].childNodes
    if (timeCell[2]) {
      lesson.time.hint = timeCell[2].textContent?.trim()
    }

    try {
      if (!disciplineCell) {
        throw new Error('Discipline cell not found')
      }

      let cellText = disciplineCell.textContent || ''
      let cellHTML = disciplineCell.innerHTML || ''
      
      // Для преподавателей данные могут быть в другой ячейке или в объединенной ячейке
      // Если ячейка пустая, проверяем другие ячейки
      if (!cellText && !cellHTML && cells.length > disciplineCellIndex) {
        // Пробуем следующую ячейку
        for (let i = disciplineCellIndex + 1; i < cells.length; i++) {
          const altCell = cells[i]
          const altText = altCell.textContent?.trim() || ''
          const altHTML = altCell.innerHTML?.trim() || ''
          if (altText || altHTML) {
            cellText = altText
            cellHTML = altHTML
            break
          }
        }
      }
      
      // Если все еще пусто, пробуем объединенную ячейку (может быть в первой ячейке)
      if (!cellText && !cellHTML && cells.length > 0) {
        const firstCell = cells[0]
        const firstText = firstCell.textContent?.trim() || ''
        // Проверяем, содержит ли первая ячейка данные об уроке (длинный текст)
        if (firstText.length > 20 && /[А-ЯЁа-яё]/.test(firstText)) {
          cellText = firstText
          cellHTML = firstCell.innerHTML?.trim() || ''
        }
      }
      
      // Для преподавателей может быть другая структура — проверяем наличие данных
      if (!cellText && !cellHTML) {
        // Используем fallback для получения текста
        const allText = row.textContent?.trim() || ''
        if (allText && allText.length > 10) {
          cellText = allText
        } else {
          throw new Error('Discipline cell is empty')
        }
      }
      
      // Проверяем, является ли это заменой "Свободное время" на пару
      const isFreeTimeReplacement = lesson.isChange && 
        (cellText.includes('Свободное время') && cellText.includes('Замена') && cellText.includes('на:'))
      
      // Проверяем, является ли это заменой предмета на предмет
      const isSubjectReplacement = lesson.isChange && 
        !isFreeTimeReplacement && 
        cellText.includes('Замена') && 
        cellText.includes('на:')
      
      if (isFreeTimeReplacement) {
        // Для замены "свободное время" на пару нужно парсить данные после "на:"
        // Структура: "Замена Свободное время на:</a><br> название <br> преподаватель <font> адрес <br> кабинет </font>
        
        // Используем HTML парсинг для извлечения данных после "на:"
        const afterOnIndex = cellHTML.indexOf('на:')
        if (afterOnIndex !== -1) {
          const afterOn = cellHTML.substring(afterOnIndex + 3) // +3 для "на:"
          
          // Пропускаем первый <br> (он идет сразу после "на:")
          const firstBrIndex = afterOn.indexOf('<br')
          if (firstBrIndex !== -1) {
            // Находим конец первого <br> тега
            const firstBrEnd = afterOn.indexOf('>', firstBrIndex) + 1
            const afterFirstBr = afterOn.substring(firstBrEnd)
            
            // Извлекаем название предмета (текст до следующего <br>)
            const secondBrIndex = afterFirstBr.indexOf('<br')
            if (secondBrIndex !== -1) {
              const subjectHTML = afterFirstBr.substring(0, secondBrIndex)
              lesson.subject = subjectHTML.replace(/<[^>]+>/g, '').trim()
              
              // Извлекаем преподавателя (текст между вторым <br> и <font> или следующим <br>)
              const secondBrEnd = afterFirstBr.indexOf('>', secondBrIndex) + 1
              const afterSecondBr = afterFirstBr.substring(secondBrEnd)
              
              if (!isTeacherSchedule) {
                const fontIndex = afterSecondBr.indexOf('<font')
                if (fontIndex !== -1) {
                  const teacherHTML = afterSecondBr.substring(0, fontIndex)
                  lesson.teacher = teacherHTML.replace(/<[^>]+>/g, '').trim()
                } else {
                  // Если нет <font>, преподаватель может быть до следующего <br> или до конца
                  const thirdBrIndex = afterSecondBr.indexOf('<br')
                  if (thirdBrIndex !== -1) {
                    const teacherHTML = afterSecondBr.substring(0, thirdBrIndex)
                    lesson.teacher = teacherHTML.replace(/<[^>]+>/g, '').trim()
                  } else {
                    lesson.teacher = afterSecondBr.replace(/<[^>]+>/g, '').trim()
                  }
                }
              }
            } else {
              // Если нет второго <br>, название предмета может быть до <font> или до конца
              const fontIndex = afterFirstBr.indexOf('<font')
              if (fontIndex !== -1) {
                const subjectHTML = afterFirstBr.substring(0, fontIndex)
                lesson.subject = subjectHTML.replace(/<[^>]+>/g, '').trim()
              } else {
                lesson.subject = afterFirstBr.replace(/<[^>]+>/g, '').trim()
              }
            }
          }
          
          // Ищем адрес и кабинет внутри <font>
          const fontMatch = afterOn.match(/<font[^>]*>([\s\S]*?)<\/font>/i)
          if (fontMatch) {
            const fontContent = fontMatch[1]
            // Ищем паттерн: <br> адрес <br> Кабинет: номер
            // Сначала убираем все теги и разбиваем по <br>
            const cleanContent = fontContent.replace(/<[^>]+>/g, '|').split('|').filter((p: string) => p.trim())
            // Ищем адрес (первая непустая часть) и кабинет (часть с "Кабинет:")
            for (let i = 0; i < cleanContent.length; i++) {
              const part = cleanContent[i].trim()
              if (part && !part.includes('Кабинет:')) {
                const nextPart = cleanContent[i + 1]?.trim() || ''
                const classroomMatch = nextPart.match(/Кабинет:\s*([^\s]+)/i)
                if (classroomMatch) {
                  lesson.place = {
                    address: part,
                    classroom: classroomMatch[1]
                  }
                  break
                }
              }
            }
          } else {
            // Если нет <font>, ищем адрес и кабинет напрямую в тексте после "на:"
            const addressMatch = afterOn.match(/([^<]+?)(?:<br[^>]*>|\s+)Кабинет:\s*([^<\s]+)/i)
            if (addressMatch) {
              lesson.place = {
                address: addressMatch[1].replace(/<[^>]+>/g, '').trim(),
                classroom: addressMatch[2].trim()
              }
            }
          }
        }
      } else if (isSubjectReplacement) {
        // Для замены предмета на предмет нужно парсить данные после "на:"
        // Структура: "Замена [старый предмет] на:</a><br> [новый предмет] <br> [преподаватель] <font> [адрес] <br> Кабинет: [номер] </font>
        
        // Используем HTML парсинг для извлечения данных после "на:"
        const afterOnIndex = cellHTML.indexOf('на:')
        if (afterOnIndex !== -1) {
          const afterOn = cellHTML.substring(afterOnIndex + 3) // +3 для "на:"
          
          // Пропускаем первый <br> (он идет сразу после "на:")
          const firstBrIndex = afterOn.indexOf('<br')
          if (firstBrIndex !== -1) {
            // Находим конец первого <br> тега
            const firstBrEnd = afterOn.indexOf('>', firstBrIndex) + 1
            const afterFirstBr = afterOn.substring(firstBrEnd)
            
            // Извлекаем название предмета (текст до следующего <br>)
            const secondBrIndex = afterFirstBr.indexOf('<br')
            if (secondBrIndex !== -1) {
              const subjectHTML = afterFirstBr.substring(0, secondBrIndex)
              lesson.subject = subjectHTML.replace(/<[^>]+>/g, '').trim()
              
              // Извлекаем преподавателя (текст между вторым <br> и <font> или следующим <br>)
              const secondBrEnd = afterFirstBr.indexOf('>', secondBrIndex) + 1
              const afterSecondBr = afterFirstBr.substring(secondBrEnd)
              
              if (!isTeacherSchedule) {
                const fontIndex = afterSecondBr.indexOf('<font')
                if (fontIndex !== -1) {
                  const teacherHTML = afterSecondBr.substring(0, fontIndex)
                  lesson.teacher = teacherHTML.replace(/<[^>]+>/g, '').trim()
                } else {
                  // Если нет <font>, преподаватель может быть до следующего <br> или до конца
                  const thirdBrIndex = afterSecondBr.indexOf('<br')
                  if (thirdBrIndex !== -1) {
                    const teacherHTML = afterSecondBr.substring(0, thirdBrIndex)
                    lesson.teacher = teacherHTML.replace(/<[^>]+>/g, '').trim()
                  } else {
                    lesson.teacher = afterSecondBr.replace(/<[^>]+>/g, '').trim()
                  }
                }
              }
            } else {
              // Если нет второго <br>, название предмета может быть до <font> или до конца
              const fontIndex = afterFirstBr.indexOf('<font')
              if (fontIndex !== -1) {
                const subjectHTML = afterFirstBr.substring(0, fontIndex)
                lesson.subject = subjectHTML.replace(/<[^>]+>/g, '').trim()
              } else {
                lesson.subject = afterFirstBr.replace(/<[^>]+>/g, '').trim()
              }
            }
          }
          
          // Ищем адрес и кабинет внутри <font>
          const fontMatch = afterOn.match(/<font[^>]*>([\s\S]*?)<\/font>/i)
          if (fontMatch) {
            const fontContent = fontMatch[1]
            // Ищем паттерн: <br> адрес <br> Кабинет: номер
            // Сначала убираем все теги и разбиваем по <br>
            const cleanContent = fontContent.replace(/<[^>]+>/g, '|').split('|').filter((p: string) => p.trim())
            // Ищем адрес (первая непустая часть) и кабинет (часть с "Кабинет:")
            for (let i = 0; i < cleanContent.length; i++) {
              const part = cleanContent[i].trim()
              if (part && !part.includes('Кабинет:')) {
                const nextPart = cleanContent[i + 1]?.trim() || ''
                const classroomMatch = nextPart.match(/Кабинет:\s*([^\s]+)/i)
                if (classroomMatch) {
                  lesson.place = {
                    address: part,
                    classroom: classroomMatch[1]
                  }
                  break
                }
              }
            }
          } else {
            // Если нет <font>, ищем адрес и кабинет напрямую в тексте после "на:"
            const addressMatch = afterOn.match(/([^<]+?)(?:<br[^>]*>|\s+)Кабинет:\s*([^<\s]+)/i)
            if (addressMatch) {
              lesson.place = {
                address: addressMatch[1].replace(/<[^>]+>/g, '').trim(),
                classroom: addressMatch[2].trim()
              }
            }
          }
        }
      } else {
        // Обычный парсинг для нормальных пар
        // Для преподавателей структура может отличаться - пробуем разные варианты
        let subjectText = ''
        
        // Вариант 1: первый childNode (как для групп)
        if (disciplineCell.childNodes[0]) {
          subjectText = disciplineCell.childNodes[0].textContent?.trim() || ''
        }
        
        // Вариант 2: если первый childNode пустой, берем весь текст ячейки и извлекаем предмет
        if (!subjectText || subjectText.length === 0) {
          const fullText = cellText || disciplineCell.innerHTML?.trim() || ''
          // Для преподавателей формат может быть: "ПредметГруппа(Аудитория)Адрес"
          // Пример: "Теория вероятностей и математическая статистикаАндрющенко А.В.(ИСПВ-9)Моско"
          // Извлекаем: "Теория вероятностей и математическая статистика"
          if (fullText) {
            // Паттерн 1: "Предмет[ФИО](Группа)Адрес"
            // Ищем группу в скобках и извлекаем текст до неё
            const groupMatch = fullText.match(/^([А-ЯЁа-яё\s]+?)(?:[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.)?(\([^)]+\))/)
            if (groupMatch) {
              subjectText = groupMatch[1].trim()
            } else {
              // Паттерн 2: "Предмет(Группа)Адрес" - без ФИО
              const groupPatternMatch = fullText.match(/^([А-ЯЁа-яё\s]+?)(\([А-ЯЁ]+-\d+[к]?\))/)
              if (groupPatternMatch) {
                subjectText = groupPatternMatch[1].trim()
              } else {
                // Паттерн 3: просто название предмета, но убираем возможные имена преподавателей и группы в конце
                // Убираем ФИО в формате "Фамилия И.О." и группу в скобках
                const cleanedText = fullText.replace(/\s*[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.\s*\([^)]+\)[А-ЯЁа-яё]*$/, '').trim()
                // Если после очистки остался длинный текст (больше 10 символов), это предмет
                if (cleanedText.length > 10) {
                  subjectText = cleanedText
                } else {
                  subjectText = fullText
                }
              }
            }
          }
        }
        
        if (!subjectText || subjectText.length === 0) {
          // Используем fallback - берем весь текст ячейки
          const fallbackText = disciplineCell.textContent?.trim() || ''
          if (fallbackText) {
            lesson.fallbackDiscipline = fallbackText
          } else {
            throw new Error('Subject node not found')
          }
        } else {
          lesson.subject = subjectText
        }

        if (!isTeacherSchedule) {
          const teacherCell = disciplineCell.childNodes[2]
          if (teacherCell) {
            lesson.teacher = teacherCell.textContent!.trim()
          }
        }

        // Парсим место проведения
        const placeCell = disciplineCell.childNodes[3]

        if (placeCell && placeCell.childNodes.length > 0) {
          const addressNode = placeCell.childNodes[1]
          const classroomNode = placeCell.childNodes[3]
          
          if (addressNode && classroomNode) {
            const address = addressNode.textContent?.trim()
            const classroomText = classroomNode.textContent?.trim()
            const classroomMatch = classroomText?.match(/^Кабинет: ([^ ]+)(-2)?$/)
            
            if (address && classroomMatch) {
              lesson.place = {
                address,
                classroom: classroomMatch[1]
              }
            }
          }
        } else if (isTeacherSchedule) {
          // Для преподавателей место может быть в другом формате в тексте ячейки
          // Формат: "ПредметГруппа(Аудитория)Адрес" или в отдельной ячейке
          // Сначала проверяем наличие отдельной ячейки с местом (как для групп)
          const placeCellIndex = cells.length >= 6 ? 5 : (cells.length >= 5 ? 4 : -1)
          if (placeCellIndex >= 0 && cells[placeCellIndex]) {
            const placeCell = cells[placeCellIndex]
            const placeText = placeCell.textContent?.trim() || ''
            // Ищем адрес и кабинет в формате "адрес\nКабинет: номер"
            const placeMatch = placeText.match(/([^\n]+)\n.*?Кабинет:\s*([^\s\n]+)/i)
            if (placeMatch) {
              lesson.place = {
                address: placeMatch[1].trim(),
                classroom: placeMatch[2].trim()
              }
            }
          }
          
          // Если не нашли в отдельной ячейке, ищем в тексте ячейки с предметом
          if (!lesson.place) {
            const fullText = disciplineCell.textContent?.trim() || ''
            if (fullText) {
              // Ищем паттерн: группа в скобках и адрес после
              // Например: "(ИКС-8)Московское шоссе, 120" или "(ССА-15к)Моск"
              const placeMatch = fullText.match(/\(([^)]+)\)([^(]+?)(?:\d+|$)/)
              if (placeMatch) {
                const classroom = placeMatch[1].trim()
                const address = placeMatch[2].trim()
                if (classroom && address && address.length > 3) {
                  lesson.place = {
                    address,
                    classroom
                  }
                }
              }
            }
          }
        }
      }
    } catch(e) {
      console.error('Error while parsing discipline', e, cells[3]?.textContent?.trim())
      lesson.fallbackDiscipline = cells[3]?.textContent?.trim()
    }

    if (cells[4]) {
      lesson.topic = cells[4].textContent?.trim() || ''
    }

    // Колонка "Ресурс"
    if (cells[5]) {
      Array.from(cells[5].querySelectorAll('a')).forEach(a => {
        const title = a.textContent?.trim()
        const url = a.getAttribute('href')
        if (title && url) {
          lesson.resources!.push({
            type: 'link',
            title,
            url,
          })
        }
      })
    }

    // Колонка "Задание для выполнения"
    if (cells[6]) {
      const hwCell = cells[6]
      const rawText = hwCell.textContent?.replace(/\s+/g, ' ').trim() || ''
      if (rawText) {
        lesson.homework = rawText
      }

      // Добавляем ссылки из задания тоже в список материалов
      Array.from(hwCell.querySelectorAll('a')).forEach(a => {
        const title = a.textContent?.trim()
        const url = a.getAttribute('href')
        if (title && url) {
          lesson.resources!.push({
            type: 'link',
            title,
            url,
          })
        }
      })
    }

    return lesson as Lesson
  } catch(e) {
    console.error('Error while parsing lesson in table', e, row.textContent?.trim())
    return null
  }
}

export function parsePage(
  document: Document,
  groupName: string,
  url?: string,
  shouldParseWeekNavigation: boolean = true,
  isTeacherSchedule: boolean = false
): ParseResult {
  // Для расписания преподавателей используем отдельный, более надежный парсер,
  // основанный на уже отлаженной python‑версии.
  if (isTeacherSchedule) {
    return parseTeacherSchedule(document, url, shouldParseWeekNavigation)
  }

  // Для расписания групп используем отдельный парсер, который опирается на структуру
  // таблицы с заголовками дней (<h3>Понедельник 02.03.2026 / 8 неделя</h3>)
  // и строки с номерами пар.
  return parseGroupSchedule(document, groupName, url, shouldParseWeekNavigation)

  // Ищем все таблицы на странице, а не только прямых потомков body.
  // На сайте колледжа разметка может меняться (таблицу расписания могут оборачивать в <div>, <center> и т.п.),
  // поэтому ограничение 'body > table' ломало парсинг, когда структура слегка поменялась.
  const tables = Array.from(document.querySelectorAll('table'))
  
  // Пытаемся найти таблицу разными способами
  let table: Element | undefined
  
  // Для расписания преподавателей приоритет - таблица с признаками расписания, а не список имен
  if (isTeacherSchedule) {
    // Способ 1: Ищем таблицу с признаками расписания (дни недели с датами, время пар)
    table = tables.find(table => {
      const tableText = table.textContent || ''
      // Проверяем наличие заголовков дней с датами и номерами недель
      const hasDayTitles = /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s+неделя/i.test(tableText)
      // Проверяем наличие времени пар
      const hasTimeSlots = /\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/.test(tableText)
      // НЕ должно быть списка имен преподавателей (много строк с ФИО подряд)
      const hasManyNames = (tableText.match(/[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/g) || []).length > 20
      return (hasDayTitles || hasTimeSlots) && !hasManyNames
    })
    
    // Способ 2: Если не нашли, ищем таблицу по имени в первой строке (может быть заголовок)
    if (!table) {
      table = tables.find(table => {
        const firstRow = table.querySelector(':scope > tbody > tr:first-child') || table.querySelector(':scope > tr:first-child')
        const firstRowText = firstRow?.textContent?.trim() || ''
        // Проверяем точное совпадение
        return firstRowText === groupName
      })
    }
    
    // Способ 2.5: Ищем таблицу, которая содержит имя где-то в первых строках (только если имя длинное)
    if (!table && groupName.length > 10) {
      table = tables.find(table => {
        const rows = Array.from(table.querySelectorAll('tr')).slice(0, 3)
        return rows.some(row => {
          const rowText = row.textContent?.trim() || ''
          return rowText.includes(groupName)
        })
      })
    }
  } else {
    // Для групп: ищем по имени в первой строке
    table = tables.find(table => {
      const firstRow = table.querySelector(':scope > tbody > tr:first-child')
      return firstRow?.textContent?.trim() === groupName
    })
  }
  
  // Способ 3: Если не нашли, ищем таблицу, которая содержит имя где-то внутри
  if (!table) {
    table = tables.find(table => {
      const tableText = table.textContent || ''
      // Проверяем, содержит ли таблица имя (может быть в заголовке или в первой строке)
      return tableText.includes(groupName)
    })
  }
  
  // Способ 4: Если все еще не нашли, берем первую таблицу с расписанием (содержит заголовки дней)
  if (!table && tables.length > 0) {
    table = tables.find(table => {
      const tableText = table.textContent || ''
      // Проверяем наличие признаков расписания (дни недели, время пар)
      return /Понедельник|Вторник|Среда|Четверг|Пятница|Суббота/.test(tableText) ||
             /\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/.test(tableText)
    })
  }
  
  // Способ 5: Если ничего не помогло, берем самую большую таблицу (обычно это расписание)
  if (!table && tables.length > 0) {
    table = tables.reduce((largest, current) => {
      const largestRows = largest.querySelectorAll('tr').length
      const currentRows = current.querySelectorAll('tr').length
      return currentRows > largestRows ? current : largest
    })
  }
  
  if (!table) {
    logDebug('parsePage: tables analyzing', { groupName, tablesCount: tables.length })
    tables.forEach((t, i) => {
      const text = t.textContent?.substring(0, 200) || ''
      const hasDayTitles = /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}/i.test(text)
      const hasTimeSlots = /\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/.test(text)
      const nameCount = (text.match(/[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/g) || []).length
      logDebug('parsePage: table analysis', { tableIndex: i, rows: t.querySelectorAll('tr').length, hasDayTitles, hasTimeSlots, nameCount, preview: text.substring(0, 80) })
    })
    throw new Error(`Table not found for ${groupName}. Found ${tables.length} tables on the page.`)
  }

  const selectedTable = table!

  logDebug('parsePage: selected table', { groupName, rows: selectedTable.querySelectorAll('tr').length })

  // Пытаемся найти tbody или использовать прямые children таблицы
  let tbody: HTMLTableSectionElement | null = null
  const tbodyElement = selectedTable.querySelector('tbody')
  if (tbodyElement) {
    tbody = tbodyElement as HTMLTableSectionElement
  } else if (selectedTable.children.length > 0 && selectedTable.children[0].tagName === 'TBODY') {
    tbody = selectedTable.children[0] as HTMLTableSectionElement
  }

  if (!tbody && selectedTable.children.length === 0) {
    throw new Error(`Table structure is invalid for ${groupName}`)
  }

  // Структура таблицы расписания с lk.ks.psuti.ru (mn=2&obj=ID группы):
  // allRows[0] — название группы в одной ячейке (colspan=7);
  // allRows[1] — пустая строка-разделитель (одна td colspan=7);
  // далее повторяются блоки: [заголовок дня] [заголовок колонок] [пары...] [пустая строка].
  // Заголовок дня: одна <tr> с одной <td colspan=7>, внутри вложенная таблица с <h3>Понедельник DD.MM.YYYY / N неделя</h3>.
  // Заголовок колонок: <tr> с 7 <td> — «№ пары», «Время занятий», «Способ», «Дисциплина, преподаватель», «Тема занятия», «Ресурс», «Задание для выполнения».
  // Строка пары: 7 <td> — номер, время (08:00 – 09:30), способ, ячейка с предметом/преподавателем/местом (subject + <br> + teacher + <font> адрес, Кабинет), тема, ресурсы, задание.
  const allRows = tbody
    ? Array.from(tbody!.querySelectorAll('tr'))
    : Array.from(selectedTable.querySelectorAll('tr'))
  
  const rows = allRows.slice(2)
  logDebug('parsePage: rows to parse', { groupName, rowsCount: rows.length, firstRows: rows.slice(0, 5).map(r => r.textContent?.trim().substring(0, 50)) })

  const days: Day[] = []
  let dayInfo: Partial<Day> = {}
  let dayLessons: Lesson[] = []
  let previousRowIsDayTitle = false
  let currentWeekNumber: number | undefined
  
  // Пытаемся извлечь текущий wk из URL
  const currentUrl = url || document.location?.href || ''
  const wkMatchResult = currentUrl.match(/[?&]wk=(\d+)/)
  const wkMatchValue = wkMatchResult?.[1]
  const currentWk = wkMatchValue ? Number(wkMatchValue) : undefined
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowText = row.textContent?.trim() || ''

    const isDivider = rowText === ''
    // Строка заголовка таблицы (идёт сразу после заголовка дня) — не считать новым днём
    const looksLikeTableHeader = /№ пары|Время занятий|Дисциплина, преподаватель/i.test(rowText)
    // Проверяем, является ли строка заголовком дня: должна содержать паттерн "день недели дата / номер неделя"
    const looksLikeDayTitle = /(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s+неделя/i.test(rowText)
    const isDayTitle = looksLikeDayTitle && !looksLikeTableHeader
    // Если уже есть день с датой и встречаем новый заголовок дня, сохраняем предыдущий день
    const isNewDayTitle = isDayTitle && ('date' in dayInfo)
    const isTableHeader = previousRowIsDayTitle

    // Если встречаем новый день, сохраняем предыдущий
    if (isNewDayTitle && 'date' in dayInfo) {
      days.push({ ...dayInfo, lessons: dayLessons } as Day)
      dayLessons = []
      dayInfo = {}
      previousRowIsDayTitle = false
    }

    if (isDivider) {
      // Сохраняем день при разделителе только если есть уроки — иначе пустая строка
      // между заголовком дня и строкой «№ пары / Время» сбрасывала контекст и все пары пропускались
      if ('date' in dayInfo && dayLessons.length > 0) {
        days.push({ ...dayInfo, lessons: dayLessons } as Day)
        dayLessons = []
        dayInfo = {}
      }
      previousRowIsDayTitle = false
    } else if (isTableHeader) {
      // После заголовка дня идет строка заголовков таблицы - пропускаем её
      // НО dayInfo должен сохраниться для следующих строк!
      previousRowIsDayTitle = false
      continue
    } else if (isDayTitle) {
      // Пытаемся найти заголовок дня в разных форматах
      const h3Element = row.querySelector('h3')
      let dayTitleText = h3Element?.textContent?.trim() || row.textContent?.trim() || ''
      
      // Извлекаем только часть до переноса строки или до начала следующего контента
      // Заголовок дня может быть в начале строки, а дальше идет другой контент
      const dayTitleMatchResult = dayTitleText.match(/((Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)\s+\d{1,2}\.\d{1,2}\.\d{4}\s*\/\s*\d+\s+неделя)/i)
      const dayTitleMatchValue = dayTitleMatchResult?.[1]!
      if (dayTitleMatchValue) {
        dayTitleText = dayTitleMatchValue
      }
      
      if (!dayTitleText) {
        // Пропускаем строку, если не можем найти заголовок
        continue
      }
      
      try {
        const { date, weekNumber } = dayTitleParser(dayTitleText)
        logDebug('parsePage: parsed day title', { dayTitleText, date, weekNumber })
        dayInfo.date = date
        dayInfo.weekNumber = weekNumber
        if (!currentWeekNumber) {
          currentWeekNumber = weekNumber
        }
        previousRowIsDayTitle = true
        // Важно: после парсинга заголовка дня, следующий цикл должен обрабатывать уроки
        // Поэтому НЕ делаем continue, а просто устанавливаем флаг
        // Проверяем, что dayInfo действительно установлен
        logDebug('parsePage: day info set', { date: dayInfo.date, weekNumber: dayInfo.weekNumber })
      } catch (error) {
        // Если не удалось распарсить заголовок, пропускаем строку
        logDebug('parsePage: failed to parse day title', { dayTitleText, error: String(error) })
        continue
      }
    } else {
      // Пытаемся распарсить как урок, только если уже есть день
      const hasDayContext = 'date' in dayInfo
      if (hasDayContext) {
        // Сразу пропускаем строку заголовка таблицы (№ пары, Время занятий, …)
        if (looksLikeTableHeader) {
          previousRowIsDayTitle = false
          continue
        }
        // Пропускаем строки, которые являются только номерами пар или временем (заголовки столбцов)
        const cells = Array.from(row.querySelectorAll(':scope > td'))
        const cellTexts = cells.map(cell => cell.textContent?.trim() || '').filter(t => t)
        
        // Для преподавателей данные могут быть в одной ячейке в формате "номер\nвремя\n\nпредмет..."
        // Проверяем, есть ли в строке данные об уроке
        const hasLessonData = cellTexts.some(text => {
          // Проверяем наличие предмета (длинный текст с русскими буквами)
          return text.length > 20 && /[А-ЯЁа-яё]/.test(text) && !/^\d+$/.test(text) && !/^\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}$/.test(text)
        })
        
        // Если строка содержит только номер пары и время (например, "1\n08:00 – 09:30"), пропускаем её
        // Но если есть данные об уроке, не пропускаем
        if (cells.length <= 2 && cellTexts.length <= 2 && !hasLessonData) {
          const isTimeSlotRow = cellTexts.some(text => /^\d+$/.test(text) || /\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/.test(text))
          if (isTimeSlotRow) {
            continue
          }
        }
        
        const lesson = parseLesson(row, isTeacherSchedule)
        if (lesson) {
          let lessonName = 'unknown'
          const lessonAny = lesson as any
          if ('subject' in lessonAny && lessonAny.subject) {
            lessonName = lessonAny.subject
          } else if ('fallbackDiscipline' in lessonAny && lessonAny.fallbackDiscipline) {
            lessonName = lessonAny.fallbackDiscipline
          }
          logDebug('parsePage: parsed lesson', { lessonName })
          dayLessons.push(lesson as Lesson)
        } else {
          // Логируем строки, которые не распарсились как уроки
          logDebug('parsePage: failed to parse lesson from row', { rowPreview: rowText.substring(0, 100) })
        }
      } else {
        // Логируем строки, которые не распознаются как дни и не парсятся как уроки
        // Но только если это не пустая строка и не заголовок дня
        if (rowText && !looksLikeDayTitle) {
          const cells = Array.from(row.querySelectorAll(':scope > td'))
          if (cells.length > 0) {
            logDebug('parsePage: skipping row (no day context)', { rowPreview: rowText.substring(0, 100) })
          }
        }
      }
    }
  }
  
  // Добавляем последний день, если он не был добавлен
  if ('date' in dayInfo) {
    logDebug('parsePage: adding final day', { lessonsCount: dayLessons.length })
    days.push({ ...dayInfo, lessons: dayLessons } as Day)
  }
  
  logDebug('parsePage: total days parsed', { daysCount: days.length })

  // Парсим навигацию по неделям только если включена навигация
  let availableWeeks: WeekInfo[] = []
  let finalCurrentWk = currentWk

  if (shouldParseWeekNavigation && currentWeekNumber != null) {
    availableWeeks = parseWeekNavigation(document, currentWeekNumber!, currentWk)

    // Если не нашли ссылки, но есть текущий wk, добавляем текущую неделю
    if (availableWeeks.length === 0 && currentWk != null) {
      availableWeeks.push({ wk: currentWk!, weekNumber: currentWeekNumber! })
    }

    // Если currentWk не определен, но нашли недели, пытаемся определить текущую
    if (currentWk == null && availableWeeks.length > 0) {
      // Ищем неделю с weekNumber равным currentWeekNumber
      const currentWeekInList = availableWeeks.find(w => w.weekNumber === currentWeekNumber!)
      if (currentWeekInList) {
        finalCurrentWk = currentWeekInList!.wk
      } else {
        // Если не нашли точное совпадение, берем первую неделю как текущую
        finalCurrentWk = availableWeeks[0].wk
      }
    }
  }

  return {
    days,
    currentWk: finalCurrentWk,
    availableWeeks
  }
}