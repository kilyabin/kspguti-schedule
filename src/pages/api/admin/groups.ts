import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ApiResponse } from '@/shared/utils/api-wrapper'
import { loadGroups, saveGroups, GroupsData } from '@/shared/data/groups-loader'
import { validateGroupId, validateCourse } from '@/shared/utils/validation'
import { SCHED_MODE } from '@/shared/constants/urls'

type ResponseData = ApiResponse<{
  groups?: GroupsData
}>

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (SCHED_MODE === 'kspsuti' && req.method !== 'GET') {
    res.status(403).json({ error: 'Groups are managed automatically from lk.ks.psuti.ru in this mode' })
    return
  }

  if (req.method === 'GET') {
    // Получение списка групп (всегда свежие данные для админ-панели)
    const groups = await loadGroups(true)
    res.status(200).json({ groups })
    return
  }

  if (req.method === 'POST') {
    // Добавление новой группы
    const { id, parseId, name, course } = req.body

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Group ID is required' })
      return
    }

    if (!validateGroupId(id)) {
      res.status(400).json({ error: 'Group ID must contain only lowercase letters, numbers, dashes and underscores' })
      return
    }

    if (!parseId || typeof parseId !== 'number') {
      res.status(400).json({ error: 'Parse ID must be a number' })
      return
    }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Group name is required' })
      return
    }

    // Валидация курса (1-5)
    const groupCourse = course !== undefined ? Number(course) : 1
    if (!validateCourse(groupCourse)) {
      res.status(400).json({ error: 'Course must be a number between 1 and 5' })
      return
    }

    const groups = await loadGroups()

    // Проверка на дубликат
    if (groups[id]) {
      res.status(400).json({ error: 'Group with this ID already exists' })
      return
    }

    // Добавляем группу
    groups[id] = {
      parseId,
      name,
      course: groupCourse
    }

    saveGroups(groups)
    // Загружаем свежие данные из БД (кеш уже сброшен в saveGroups)
    const updatedGroups = await loadGroups(true)
    res.status(200).json({ success: true, groups: updatedGroups })
    return
  }
}

export default withAuth(handler, ['GET', 'POST'])

