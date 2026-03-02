import contentTypeParser from 'content-type'
import { JSDOM } from 'jsdom'
import { PROXY_URL } from '@/shared/constants/urls'
import { logErrorToFile, logInfo } from '@/app/logger'
import { parseGroupsList, GroupListParseError } from '@/app/parser/groups'
import type { GroupsData } from '@/shared/data/groups-loader'

export class GroupsTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroupsTimeoutError'
  }
}

let lastSyncAt: number | null = null
let lastResult: GroupsData | null = null

async function fetchGroupsPage(): Promise<Document> {
  const url = `${PROXY_URL}/?mn=2`
  logInfo('Groups fetch start', { url })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const page = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    const content = await page.text()
    const contentType = page.headers.get('content-type')

    if (page.status === 200 && contentType && contentTypeParser.parse(contentType).type === 'text/html') {
      const dom = new JSDOM(content, { url })
      return dom.window.document
    }

    const error = new Error(`Failed to fetch groups page: status ${page.status}`)
    logErrorToFile(error, {
      type: 'groups_fetch_error',
      url,
      status: page.status,
      contentType,
    })
    throw error
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new GroupsTimeoutError(`Request timeout while fetching groups page ${url}`)
      logErrorToFile(timeoutError, {
        type: 'groups_timeout_error',
        url,
      })
      throw timeoutError
    }

    const errorObj = error instanceof Error ? error : new Error(String(error))
    logErrorToFile(errorObj, {
      type: 'groups_unknown_error',
      url,
    })
    throw errorObj
  }
}

export async function loadGroupsFromKspsuti(): Promise<GroupsData> {
  const document = await fetchGroupsPage()

  try {
    const groups = parseGroupsList(document, document.location?.href)
    logInfo('Groups parsed successfully', { groupsCount: Object.keys(groups).length })
    return groups
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    logErrorToFile(errorObj, {
      type: errorObj instanceof GroupListParseError ? 'groups_parse_error' : 'groups_unknown_parse_error',
      url: document.location?.href,
    })
    throw errorObj
  }
}

export async function syncGroupsFromKspsuti(): Promise<GroupsData> {
  const groups = await loadGroupsFromKspsuti()
  lastSyncAt = Date.now()
  lastResult = groups
  return groups
}

export async function syncGroupsFromKspsutiIfNeeded(ttlMs: number): Promise<GroupsData | null> {
  const now = Date.now()

  if (lastSyncAt && lastResult && now - lastSyncAt < ttlMs) {
    return lastResult
  }

  try {
    return await syncGroupsFromKspsuti()
  } catch {
    // В случае ошибки не ломаем основной поток — просто возвращаем null.
    return null
  }
}

