import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ApiResponse } from '@/shared/utils/api-wrapper'
import { loadGroups, saveGroups, clearGroupsCache, GroupsData } from '@/shared/data/groups-loader'
import { validateCourse } from '@/shared/utils/validation'
import { SCHED_MODE } from '@/shared/constants/urls'

type ResponseData = ApiResponse<{
  groups?: GroupsData
}>

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Group ID is required' })
    return
  }

  if (SCHED_MODE === 'kspsuti') {
    res.status(403).json({ error: 'Groups are managed automatically from lk.ks.psuti.ru in this mode' })
    return
  }

  // Загружаем группы с проверкой кеша
  let groups = await loadGroups()

  if (req.method === 'PUT') {
    // Редактирование группы
    const { parseId, name, course } = req.body

    if (!groups[id]) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    if (parseId !== undefined && typeof parseId !== 'number') {
      res.status(400).json({ error: 'Parse ID must be a number' })
      return
    }

    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({ error: 'Group name must be a string' })
      return
    }

    if (course !== undefined && !validateCourse(course)) {
      res.status(400).json({ error: 'Course must be a number between 1 and 5' })
      return
    }

    // Обновляем группу
    const currentGroup = groups[id]
    groups[id] = {
      parseId: parseId !== undefined ? parseId : currentGroup.parseId,
      name: name !== undefined ? name : currentGroup.name,
      course: course !== undefined ? Number(course) : currentGroup.course
    }

    saveGroups(groups)
    // Сбрасываем кеш и загружаем свежие данные из БД
    clearGroupsCache()
    const updatedGroups = await loadGroups(true)
    res.status(200).json({ success: true, groups: updatedGroups })
    return
  }

  if (req.method === 'DELETE') {
    // Удаление группы
    if (!groups[id]) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    delete groups[id]

    saveGroups(groups)
    // Сбрасываем кеш и загружаем свежие данные из БД
    clearGroupsCache()
    const updatedGroups = await loadGroups(true)
    res.status(200).json({ success: true, groups: updatedGroups })
    return
  }
}

export default withAuth(handler, ['PUT', 'DELETE'])

