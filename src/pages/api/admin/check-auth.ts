import type { NextApiRequest, NextApiResponse } from 'next'
import { checkAuth } from '@/shared/utils/auth'

type ResponseData = {
  authenticated: boolean
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    res.status(405).json({ authenticated: false })
    return
  }

  const authenticated = checkAuth(req)
  res.status(200).json({ authenticated })
}

