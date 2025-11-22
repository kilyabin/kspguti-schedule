import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/shared/utils/auth'
import { loadGroups, saveGroups, GroupsData } from '@/shared/data/groups-loader'

type ResponseData = {
  groups?: GroupsData
  success?: boolean
  error?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === 'GET') {
    // Получение списка групп
    const groups = loadGroups()
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
    if (!Number.isInteger(groupCourse) || groupCourse < 1 || groupCourse > 5) {
      res.status(400).json({ error: 'Course must be a number between 1 and 5' })
      return
    }

    // Валидация ID (только латинские буквы, цифры, дефисы и подчеркивания)
    if (!/^[a-z0-9_-]+$/.test(id)) {
      res.status(400).json({ error: 'Group ID must contain only lowercase letters, numbers, dashes and underscores' })
      return
    }

    const groups = loadGroups()

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

    try {
      saveGroups(groups)
      res.status(200).json({ success: true, groups })
    } catch (error) {
      console.error('Error saving groups:', error)
      res.status(500).json({ error: 'Failed to save groups' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

export default function protectedHandler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  return requireAuth(req, res, handler)
}

