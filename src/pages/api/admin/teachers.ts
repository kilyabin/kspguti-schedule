import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ApiResponse } from '@/shared/utils/api-wrapper'
import { loadTeachers, saveTeachers, clearTeachersCache, TeachersData } from '@/shared/data/teachers-loader'
import { parseTeachersList } from '@/app/parser/teachers-list'
import { JSDOM } from 'jsdom'
import { PROXY_URL } from '@/shared/constants/urls'
import contentTypeParser from 'content-type'

type ResponseData = ApiResponse<{
  teachers?: TeachersData
  parsed?: number
}>

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === 'GET') {
    // Получение списка преподавателей (всегда свежие данные для админ-панели)
    clearTeachersCache()
    const teachers = loadTeachers(true)
    res.status(200).json({ teachers })
    return
  }

  if (req.method === 'POST') {
    // Парсинг и обновление списка преподавателей
    try {
      const url = `${PROXY_URL}/?mn=3`
      console.log(`[Teachers API] Fetching teachers list from: ${url}`)
      console.log(`[Teachers API] PROXY_URL: ${PROXY_URL}`)

      // Добавляем таймаут 10 секунд для fetch запроса
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const page = await fetch(url, { 
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      clearTimeout(timeoutId)
      console.log(`[Teachers API] Response status: ${page.status}`)
      console.log(`[Teachers API] Response URL: ${page.url}`)
      console.log(`[Teachers API] Response redirected: ${page.redirected}`)

      const content = await page.text()
      const contentType = page.headers.get('content-type')
      console.log(`[Teachers API] Content length: ${content.length}, Content-Type: ${contentType}`)

      if (page.status !== 200 || !contentType || contentTypeParser.parse(contentType).type !== 'text/html') {
        console.error(`[Teachers API] Invalid response: status ${page.status}, contentType: ${contentType}`)
        res.status(500).json({ error: `Failed to fetch teachers list: status ${page.status}` })
        return
      }

      // Проверяем, не редирект ли на страницу авторизации
      if (content.includes('login') || content.includes('auth') || content.includes('Вход') || content.includes('Авторизация')) {
        console.error('[Teachers API] Response appears to be a login page, not teachers list')
      }

      const dom = new JSDOM(content, { url })
      const document = dom.window.document

      // Логируем заголовок страницы для отладки
      const pageTitle = document.title
      console.log(`[Teachers API] Page title: ${pageTitle}`)

      // Логируем немного HTML для отладки
      const htmlPreview = content.substring(0, 500).replace(/\n/g, ' ')
      console.log(`[Teachers API] HTML preview: ${htmlPreview}...`)

      const teachersList = parseTeachersList(document)
      console.log(`[Teachers API] Parsed ${teachersList.length} teachers`)

      // Закрываем JSDOM для освобождения памяти
      dom.window.close()

      if (teachersList.length === 0) {
        console.error('[Teachers API] No teachers found in HTML')
        // Логируем больше информации для отладки
        const hasMn3 = content.includes('mn=3')
        const hasObj = content.includes('obj=')
        const hasTeachersTable = content.includes('Преподаватель') || content.includes('преподавател')
        console.log(`[Teachers API] HTML contains 'mn=3': ${hasMn3}, contains 'obj=': ${hasObj}, contains 'преподавател': ${hasTeachersTable}`)
        
        // Проверяем, не ошибка ли это
        if (content.includes('Ошибка') || content.includes('Error') || content.includes('404') || content.includes('500')) {
          console.error('[Teachers API] Response contains error indicators')
        }
        
        res.status(500).json({ error: 'No teachers found on the page' })
        return
      }

      // Преобразуем список в формат TeachersData
      // Используем parseId как id (строковое представление)
      const teachersData: TeachersData = {}
      for (const teacher of teachersList) {
        const id = String(teacher.parseId)
        teachersData[id] = {
          parseId: teacher.parseId,
          name: teacher.name
        }
      }
      console.log(`[Teachers API] Created TeachersData with ${Object.keys(teachersData).length} entries`)

      // Сохраняем в БД
      saveTeachers(teachersData)
      console.log('[Teachers API] Saved teachers to database')

      // Сохраняем timestamp последнего обновления
      const { setTeachersLastUpdateTime } = await import('@/shared/data/database')
      setTeachersLastUpdateTime(Date.now())

      // Сбрасываем кеш и загружаем свежие данные из БД
      clearTeachersCache()
      const updatedTeachers = loadTeachers(true)
      console.log(`[Teachers API] Loaded ${Object.keys(updatedTeachers).length} teachers from database`)

      res.status(200).json({
        success: true,
        teachers: updatedTeachers,
        parsed: teachersList.length
      })
      return
    } catch (error) {
      console.error('Error parsing teachers list:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ error: `Failed to parse teachers list: ${errorMessage}` })
      return
    }
  }
}

export default withAuth(handler, ['GET', 'POST'])
