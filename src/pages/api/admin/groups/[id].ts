import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/shared/utils/auth'
import { loadGroups, saveGroups, GroupsData } from '@/shared/data/groups-loader'

type ResponseData = {
  success?: boolean
  groups?: GroupsData
  error?: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Group ID is required' })
    return
  }

  const groups = loadGroups()

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

    if (course !== undefined) {
      const groupCourse = Number(course)
      if (!Number.isInteger(groupCourse) || groupCourse < 1 || groupCourse > 5) {
        res.status(400).json({ error: 'Course must be a number between 1 and 5' })
        return
      }
    }

    // Обновляем группу
    const currentGroup = groups[id]
    groups[id] = {
      parseId: parseId !== undefined ? parseId : currentGroup.parseId,
      name: name !== undefined ? name : currentGroup.name,
      course: course !== undefined ? Number(course) : currentGroup.course
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

  if (req.method === 'DELETE') {
    // Удаление группы
    if (!groups[id]) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    delete groups[id]

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

