import { Day } from '@/shared/model/day'
import { Lesson } from '@/shared/model/lesson'

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
  const [dateString, week] = text.trim().split(' / ')
  const weekNumber = Number(week.trim().match(/^(\d+) неделя$/)![1])
  const [, day, month, year] = dateString.trim().match(/^[а-яА-Я]+ (\d{1,2})\.(\d{1,2})\.(\d{4})$/)!
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

const parseLesson = (row: Element): Lesson | null => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const lesson: LessonObject = {}

  try {
    const cells = Array.from(row.querySelectorAll(':scope > td'))
    
    lesson.isChange = cells.every(td => td.getAttribute('bgcolor') === 'ffffbb')
    
    // Пропускаем урок только если это НЕ замена И в ячейке "Свободное время"
    if (!cells[3] || (!lesson.isChange && cells[3].textContent?.trim() === 'Свободное время')) return null

    if (!cells[1] || !cells[1].childNodes[0]) {
      return null
    }
    const timeCell = cells[1].childNodes
    const timeText = timeCell[0].textContent?.trim()
    if (!timeText) {
      return null
    }
    const [startTime, endTime] = timeText.split(' – ')
    lesson.time = {
      start: startTime ?? '',
      end: endTime ?? ''
    }
    if (timeCell[2]) {
      lesson.time.hint = timeCell[2].textContent?.trim()
    }

    try {
      const disciplineCell = cells[3]
      if (!disciplineCell) {
        throw new Error('Discipline cell not found')
      }

      const cellText = disciplineCell.textContent || ''
      const cellHTML = disciplineCell.innerHTML || ''
      
      // Проверяем, является ли это заменой "Свободное время" на пару
      const isFreeTimeReplacement = lesson.isChange && 
        (cellText.includes('Свободное время') && cellText.includes('Замена') && cellText.includes('на:'))
      
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
            const cleanContent = fontContent.replace(/<[^>]+>/g, '|').split('|').filter(p => p.trim())
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
        if (!disciplineCell.childNodes[0]) {
          throw new Error('Subject node not found')
        }
        lesson.subject = disciplineCell.childNodes[0].textContent!.trim()

        const teacherCell = disciplineCell.childNodes[2]
        if (teacherCell) {
          lesson.teacher = teacherCell.textContent!.trim()
        }

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
        }
      }
    } catch(e) {
      console.error('Error while parsing discipline', e, cells[3]?.textContent?.trim())
      lesson.fallbackDiscipline = cells[3]?.textContent?.trim()
    }

    if (cells[4]) {
      lesson.topic = cells[4].textContent?.trim() || ''
    }

    lesson.resources = []
    if (cells[5]) {
      Array.from(cells[5].querySelectorAll('a'))
        .forEach(a => {
          const title = a.textContent?.trim()
          const url = a.getAttribute('href')
          if (title && url) {
            lesson.resources.push({
              type: 'link',
              title,
              url
            })
          }
        })
    }

    return lesson
  } catch(e) {
    console.error('Error while parsing lesson in table', e, row.textContent?.trim())
    return null
  }
}

export function parsePage(document: Document, groupName: string, url?: string, shouldParseWeekNavigation: boolean = true): ParseResult {
  const tables = Array.from(document.querySelectorAll('body > table'))
  const table = tables.find(table => table.querySelector(':scope > tbody > tr:first-child')?.textContent?.trim() === groupName)
  const rows = Array.from(table!.children[0].children).filter(el => el.tagName === 'TR').slice(2)

  const days = []
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  let dayInfo: Day = {}
  let dayLessons: Lesson[] = []
  let previousRowIsDayTitle = false
  let currentWeekNumber: number | undefined
  
  // Пытаемся извлечь текущий wk из URL
  const currentUrl = url || document.location?.href || ''
  const wkMatch = currentUrl.match(/[?&]wk=(\d+)/)
  const currentWk = wkMatch ? Number(wkMatch[1]) : undefined
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    const isDivider = row.textContent?.trim() === ''
    const isDayTitle = dayLessons.length === 0 && !('date' in dayInfo)
    const isTableHeader = previousRowIsDayTitle

    if (isDivider) {
      days.push({ ...dayInfo, lessons: dayLessons })
      dayLessons = []
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      dayInfo = {}
      previousRowIsDayTitle = false
    } else if (isTableHeader) {
      previousRowIsDayTitle = false
      continue
    } else if (isDayTitle) {
      const { date, weekNumber } = dayTitleParser(row.querySelector('h3')!.textContent!)
      dayInfo.date = date
      dayInfo.weekNumber = weekNumber
      if (!currentWeekNumber) {
        currentWeekNumber = weekNumber
      }
      previousRowIsDayTitle = true
    } else {
      const lesson = parseLesson(row)
      if(lesson !== null)
        dayLessons.push(lesson)
    }
  }

  // Парсим навигацию по неделям только если включена навигация
  let availableWeeks: WeekInfo[] | undefined
  let finalCurrentWk = currentWk
  
  if (shouldParseWeekNavigation && currentWeekNumber) {
    availableWeeks = parseWeekNavigation(document, currentWeekNumber, currentWk)
    
    // Если не нашли ссылки, но есть текущий wk, добавляем текущую неделю
    if (availableWeeks.length === 0 && currentWk) {
      availableWeeks.push({ wk: currentWk, weekNumber: currentWeekNumber })
    }
    
    // Если currentWk не определен, но нашли недели, пытаемся определить текущую
    if (!currentWk && availableWeeks.length > 0) {
      // Ищем неделю с weekNumber равным currentWeekNumber
      const currentWeekInList = availableWeeks.find(w => w.weekNumber === currentWeekNumber)
      if (currentWeekInList) {
        finalCurrentWk = currentWeekInList.wk
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