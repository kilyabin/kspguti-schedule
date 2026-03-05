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
    const teachers = loadTeachers(true)
    res.status(200).json({ teachers })
    return
  }

  if (req.method === 'POST') {
    // Парсинг и обновление списка преподавателей
    try {
      const url = `${PROXY_URL}/?mn=3`
      
      // Добавляем таймаут 10 секунд для fetch запроса
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const page = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      
      const content = await page.text()
      const contentType = page.headers.get('content-type')
      
      if (page.status !== 200 || !contentType || contentTypeParser.parse(contentType).type !== 'text/html') {
        res.status(500).json({ error: `Failed to fetch teachers list: status ${page.status}` })
        return
      }

      const dom = new JSDOM(content, { url })
      const document = dom.window.document
      
      const teachersList = parseTeachersList(document)
      
      // Закрываем JSDOM для освобождения памяти
      dom.window.close()
      
      if (teachersList.length === 0) {
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

      // Сохраняем в БД
      saveTeachers(teachersData)

      // Сохраняем timestamp последнего обновления
      const { setTeachersLastUpdateTime } = await import('@/shared/data/database')
      setTeachersLastUpdateTime(Date.now())

      // Загружаем свежие данные из БД (кеш уже сброшен в saveTeachers)
      const updatedTeachers = loadTeachers(true)

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
