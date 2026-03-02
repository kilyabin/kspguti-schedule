import { logDebug } from '@/app/logger'
import type { GroupsData } from '@/shared/data/groups-loader'

export class GroupListParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroupListParseError'
  }
}

function extractParseIdFromHref(href: string | null): number | null {
  if (!href) return null
  const match = href.match(/[?&]obj=(\d+)/)
  if (!match) return null
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

function detectCourseFromAnchor(anchor: HTMLAnchorElement): number {
  // На странице групп "колонки курсов" лежат во внешнем <tr>,
  // а сами ссылки групп — во вложенных таблицах внутри этих колонок.
  // Поэтому нужно подняться до такого <tr>, у которого:
  // - прямые дети: несколько <td>, среди них есть разделители width="1"
  // - если убрать разделители, останется ровно 5 колонок (1–5 курс)

  const isSeparatorTd = (td: HTMLTableCellElement) => td.getAttribute('width')?.trim() === '1'

  let current: Element | null = anchor
  while (current) {
    if (current.tagName === 'TR') {
      const directTds = Array.from(current.children).filter((el) => el.tagName === 'TD') as HTMLTableCellElement[]
      if (directTds.length >= 5) {
        const contentTds = directTds.filter((td) => !isSeparatorTd(td))
        if (contentTds.length === 5) {
          const idx = contentTds.findIndex((td) => td.contains(anchor))
          if (idx >= 0) {
            return idx + 1
          }
        }
      }
    }
    current = current.parentElement
  }

  logDebug('detectCourseFromAnchor: failed to detect course, falling back to 1', {
    anchorText: (anchor.textContent || '').trim(),
  })
  return 1
}

function buildGroupId(parseId: number, isDistance: boolean): string {
  // Генерируем стабильный ASCII‑id, совместимый с validateGroupId (a-z0-9_-).
  // Для заочного отделения добавляем префикс za_.
  const prefix = isDistance ? 'za_' : ''
  return `${prefix}g${parseId}`
}

export function parseGroupsList(document: Document, url?: string): GroupsData {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="?mn=2&obj="]'))

  if (anchors.length === 0) {
    throw new GroupListParseError('Не найдены ссылки на группы (?mn=2&obj=...)')
  }

  const groups: GroupsData = {}

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href')
    const parseId = extractParseIdFromHref(href)
    if (!parseId) {
      continue
    }

    const rawName = (anchor.textContent || '').trim()
    if (!rawName) {
      logDebug('parseGroupsList: anchor without text', { href })
      continue
    }

    const isDistance = /\(з\/о\)/i.test(rawName)
    const course = detectCourseFromAnchor(anchor)
    const id = buildGroupId(parseId, isDistance)

    if (groups[id]) {
      // Если вдруг id уже есть, логируем и пропускаем дубликат.
      logDebug('parseGroupsList: duplicate group id, skipping', {
        id,
        existingParseId: groups[id].parseId,
        newParseId: parseId,
      })
      continue
    }

    groups[id] = {
      parseId,
      name: rawName,
      course,
    }
  }

  if (Object.keys(groups).length === 0) {
    throw new GroupListParseError('Удалось найти ссылки на группы, но после парсинга список пуст')
  }

  logDebug('parseGroupsList: parsed groups summary', {
    groupsCount: Object.keys(groups).length,
    url: url || document.location?.href || '',
  })

  return groups
}

