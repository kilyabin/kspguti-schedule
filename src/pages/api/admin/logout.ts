import type { NextApiRequest, NextApiResponse } from 'next'
import { clearSessionCookie } from '@/shared/utils/auth'

type ResponseData = {
  success?: boolean
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.status(405).json({})
    return
  }

  clearSessionCookie(res)
  res.status(200).json({ success: true })
}

