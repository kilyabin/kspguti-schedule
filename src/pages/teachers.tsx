import React from 'react'
import { GetServerSideProps } from 'next'
import { loadTeachers, TeachersData } from '@/shared/data/teachers-loader'
import { Card, CardContent, CardHeader, CardTitle } from '@/shadcn/ui/card'
import { Button } from '@/shadcn/ui/button'
import { ThemeSwitcher } from '@/features/theme-switch'
import Link from 'next/link'
import Head from 'next/head'
import { GITHUB_REPO_URL } from '@/shared/constants/urls'
import { FaGithub } from 'react-icons/fa'
import { ArrowLeft } from 'lucide-react'

type TeachersPageProps = {
  teachers: TeachersData
}

export default function TeachersPage({ teachers }: TeachersPageProps) {
  // Преобразуем объект преподавателей в массив и сортируем по имени
  const teachersList = Object.entries(teachers)
    .map(([id, teacher]) => ({ id, parseId: teacher.parseId, name: teacher.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <Head>
        <title>Преподаватели — Расписание занятий</title>
        <meta name="description" content="Список преподавателей Колледжа Связи ПГУТИ" />
      </Head>
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center space-y-2 mb-8 stagger-card" style={{ animationDelay: '0.05s' } as React.CSSProperties}>
            <h1 className="text-3xl md:text-4xl font-bold">Преподаватели</h1>
            <p className="text-muted-foreground">Выберите преподавателя для просмотра расписания</p>
          </div>

          {teachersList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Преподаватели не найдены
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {teachersList.map((teacher, index) => {
                const delay = 0.1 + index * 0.02
                return (
                  <div
                    key={teacher.id}
                    className="stagger-card"
                    style={{
                      animationDelay: `${delay}s`,
                    } as React.CSSProperties}
                  >
                    <Link href={`/teacher/${teacher.parseId}`}>
                      <Button
                        variant="outline"
                        className="w-full justify-center h-auto py-3 px-4 text-sm sm:text-base"
                      >
                        {teacher.name}
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <div
              className="stagger-card"
              style={{ animationDelay: `${0.1 + teachersList.length * 0.02 + 0.05}s` } as React.CSSProperties}
            >
              <Link href="/">
                <Button variant="secondary" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  На главную
                </Button>
              </Link>
            </div>
            <div
              className="stagger-card"
              style={{ animationDelay: `${0.1 + teachersList.length * 0.02 + 0.08}s` } as React.CSSProperties}
            >
              <ThemeSwitcher />
            </div>
            <div
              className="stagger-card"
              style={{ animationDelay: `${0.1 + teachersList.length * 0.02 + 0.11}s` } as React.CSSProperties}
            >
              <Link href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <FaGithub className="h-4 w-4" />
                  GitHub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

async function parseAndSaveTeachers(): Promise<boolean> {
  try {
    const { parseTeachersList } = await import('@/app/parser/teachers-list')
    const { JSDOM } = await import('jsdom')
    const { PROXY_URL } = await import('@/shared/constants/urls')
    const contentTypeParser = await import('content-type')
    
    const teachersUrl = `${PROXY_URL}/?mn=3`
    const page = await fetch(teachersUrl)
    const content = await page.text()
    const contentType = page.headers.get('content-type')
    
    if (page.status === 200 && contentType && contentTypeParser.default.parse(contentType).type === 'text/html') {
      const dom = new JSDOM(content, { url: teachersUrl })
      const document = dom.window.document
      const teachersList = parseTeachersList(document)
      dom.window.close()
      
      if (teachersList.length > 0) {
        // Преобразуем в формат TeachersData
        const teachersData: TeachersData = {}
        for (const teacher of teachersList) {
          const id = String(teacher.parseId)
          teachersData[id] = {
            parseId: teacher.parseId,
            name: teacher.name
          }
        }
        
        // Сохраняем в БД
        const { saveTeachers } = await import('@/shared/data/teachers-loader')
        saveTeachers(teachersData)
        
        // Сохраняем timestamp последнего обновления
        const { setTeachersLastUpdateTime } = await import('@/shared/data/database')
        setTeachersLastUpdateTime(Date.now())
        
        return true
      }
    }
    return false
  } catch (error) {
    console.error('Error parsing teachers:', error)
    return false
  }
}

export const getServerSideProps: GetServerSideProps<TeachersPageProps> = async () => {
  let teachers = loadTeachers()
  
  // Проверяем, нужно ли обновить список преподавателей
  const { getTeachersLastUpdateTime } = await import('@/shared/data/database')
  const lastUpdate = getTeachersLastUpdateTime()
  const now = Date.now()
  const ONE_DAY_MS = 1000 * 60 * 60 * 24 // 24 часа в миллисекундах
  
  const shouldUpdate = !lastUpdate || (now - lastUpdate) >= ONE_DAY_MS
  const isEmpty = Object.keys(teachers).length === 0

  // Если список пуст или прошло 24 часа с последнего обновления, обновляем
  if (isEmpty || shouldUpdate) {
    // Парсим и сохраняем преподавателей напрямую (без вызова API)
    const success = await parseAndSaveTeachers()
    
    if (success) {
      // Перезагружаем данные из БД
      teachers = loadTeachers(true)
    } else if (isEmpty) {
      // Если не удалось загрузить и список был пуст, логируем ошибку
      console.error('Failed to load teachers list')
    }
  }

  return {
    props: {
      teachers
    }
  }
}
