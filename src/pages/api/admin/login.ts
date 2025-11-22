import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyPassword, setSessionCookie } from '@/shared/utils/auth'

type ResponseData = {
  success?: boolean
  error?: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { password } = req.body

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' })
    return
  }

  if (verifyPassword(password)) {
    setSessionCookie(res)
    res.status(200).json({ success: true })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
}

