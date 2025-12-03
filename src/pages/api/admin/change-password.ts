import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, ApiResponse } from '@/shared/utils/api-wrapper'
import { changePassword } from '@/shared/data/database'
import { validatePassword } from '@/shared/utils/validation'

type ResponseData = ApiResponse

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const { oldPassword, newPassword } = req.body

  if (!oldPassword || typeof oldPassword !== 'string') {
    res.status(400).json({ error: 'Old password is required' })
    return
  }

  if (!newPassword || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'New password is required' })
    return
  }

  // Валидация нового пароля (минимум 8 символов)
  if (!validatePassword(newPassword)) {
    res.status(400).json({ error: 'New password must be at least 8 characters long' })
    return
  }

  const success = await changePassword(oldPassword, newPassword)
  if (success) {
    res.status(200).json({ success: true })
  } else {
    res.status(401).json({ error: 'Invalid old password' })
  }
}

export default withAuth(handler, ['POST'])

