/**
 * Валидация курса (1-5)
 */
export function validateCourse(course: unknown): course is number {
  if (course === undefined) return false
  const courseNum = Number(course)
  return Number.isInteger(courseNum) && courseNum >= 1 && courseNum <= 5
}

/**
 * Валидация ID группы (только латинские буквы, цифры, дефисы и подчеркивания)
 */
export function validateGroupId(id: unknown): id is string {
  if (!id || typeof id !== 'string') return false
  return /^[a-z0-9_-]+$/.test(id)
}

/**
 * Валидация пароля (минимум 8 символов)
 */
export function validatePassword(password: unknown): password is string {
  if (!password || typeof password !== 'string') return false
  return password.length >= 8
}

