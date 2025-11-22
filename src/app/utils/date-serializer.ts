/* eslint-disable no-constant-condition */
/* eslint-disable @typescript-eslint/ban-ts-comment */
const isDate = (value: any): boolean => Object.prototype.toString.call(value) === '[object Date]'

export function nextSerialized<T>(obj: T): NextSerialized<T>
export function nextSerialized<T>(obj: T[]): NextSerialized<T[]>
export function nextSerialized<T>(obj: T): NextSerialized<T> | NextSerialized<T[]> {
  if (Array.isArray(obj)) {
    return obj.map(nextSerialized) as NextSerialized<T[]>
  }

  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = isDate(value as Date) ? (value as Date).toISOString() : nextSerialized(value)
    }
    return newObj
  }

  return obj as NextSerialized<T>
}

const looksLikeISODate = (value: string): boolean => /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z?$/.test(value)

export function nextDeserialized<T>(obj: any): T
export function nextDeserialized<T>(obj: any): T[]
export function nextDeserialized<T>(obj: any): T | T[] {
  if (Array.isArray(obj)) {
    return obj.map(nextDeserialized) as T[]
  }

  // Защита от копирования удалена - вызывала бесконечный цикл на мобильных устройствах

  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = typeof value === 'string' && looksLikeISODate(value) ? new Date(value) : nextDeserialized(value)
    }
    return newObj
  }

  return obj as T
}


export type NextSerialized<T> = {
  [K in keyof T]:
  T[K] extends Date ? string :
  T[K] extends Array<infer U> ? NextSerialized<U>[] :
  T[K] extends object ? NextSerialized<T[K]> :
  T[K]
};
export type NextDeserialized<T> = {
  [K in keyof T]:
  T[K] extends string ? Date :
  T[K] extends Array<infer U> ? NextDeserialized<U>[] :
  T[K] extends object ? NextDeserialized<T[K]> :
  T[K]
};