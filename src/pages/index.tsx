import React from 'react'
import { GetServerSideProps } from 'next'
import { loadGroups, GroupsData } from '@/shared/data/groups-loader'
import { loadSettings, clearSettingsCache, AppSettings } from '@/shared/data/settings-loader'
import { Card, CardContent, CardHeader, CardTitle } from '@/shadcn/ui/card'
import { Button } from '@/shadcn/ui/button'
import { ThemeSwitcher } from '@/features/theme-switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shadcn/ui/dialog'
import Link from 'next/link'
import Head from 'next/head'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils'
import { GITHUB_REPO_URL, TELEGRAM_CONTACT_URL, SCHED_MODE } from '@/shared/constants/urls'
import { MdAdd } from 'react-icons/md'
import { FaGithub } from 'react-icons/fa'
import { BsTelegram } from 'react-icons/bs'

type VacationModeProps = {
  vacationModeEnabled: true
  vacationModeContent: string
}

type NormalModeProps = {
  vacationModeEnabled: false
  groups: GroupsData
  groupsByCourse: { [course: number]: Array<{ id: string; name: string }> }
  showAddGroupButton: boolean
  showTeachersButton: boolean
}

type HomePageProps = VacationModeProps | NormalModeProps

// Компонент режима каникул с динамической загрузкой ReactMarkdown
function VacationMode({ vacationModeContent }: { vacationModeContent: string }) {
  const [MarkdownComponent, setMarkdownComponent] = React.useState<React.ComponentType<any> | null>(null)

  React.useEffect(() => {
    // Загружаем ReactMarkdown только на клиенте
    import('react-markdown').then((module) => {
      setMarkdownComponent(() => module.default)
    })
  }, [])

  const hasContent = vacationModeContent && vacationModeContent.trim().length > 0

  return (
    <>
      <Head>
        <title>Каникулы — Колледж Связи ПГУТИ</title>
        <meta name="description" content="По расписанию у тебя отдых! Наслаждайся свободным временем" />
      </Head>
      <div className={`min-h-screen p-4 md:p-8 ${!hasContent ? 'flex items-center justify-center' : ''}`}>
        <div className={`max-w-4xl mx-auto ${hasContent ? 'space-y-6' : ''}`}>
          <Card className="text-center py-8">
            <CardContent className="space-y-4 pt-6">
              <div className="text-8xl mb-4">🎉</div>
              <h2 className="text-2xl md:text-3xl font-bold">По расписанию у тебя отдых! Наслаждайся свободным временем 😋</h2>
            </CardContent>
          </Card>
          
          {hasContent && (
            <div className="markdown-content space-y-4">
              {MarkdownComponent ? (
                <MarkdownComponent
                  components={{
                    h1: ({ children }: any) => <h1 className="text-3xl font-bold mt-6 mb-4">{children}</h1>,
                    h2: ({ children }: any) => <h2 className="text-2xl font-bold mt-5 mb-3">{children}</h2>,
                    h3: ({ children }: any) => <h3 className="text-xl font-bold mt-4 mb-2">{children}</h3>,
                    p: ({ children }: any) => <p className="mb-4 leading-7">{children}</p>,
                    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }: any) => <em className="italic">{children}</em>,
                    ul: ({ children }: any) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                    li: ({ children }: any) => <li className="ml-2">{children}</li>,
                    a: ({ href, children }: any) => (
                      <a href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    code: ({ children }: any) => (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                    ),
                    blockquote: ({ children }: any) => (
                      <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-4">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {vacationModeContent}
                </MarkdownComponent>
              ) : (
                <div className="text-muted-foreground">Загрузка...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function HomePage(props: HomePageProps) {
  // Режим каникул - полностью заменяет главную страницу
  if (props.vacationModeEnabled) {
    return <VacationMode vacationModeContent={props.vacationModeContent} />
  }

  // Обычный режим - список групп
  const { groups, groupsByCourse, showAddGroupButton, showTeachersButton } = props
  const [openCourses, setOpenCourses] = React.useState<Set<number>>(new Set())
  const [addGroupDialogOpen, setAddGroupDialogOpen] = React.useState(false)

  const toggleCourse = (course: number) => {
    setOpenCourses(prev => {
      const next = new Set(prev)
      if (next.has(course)) {
        next.delete(course)
      } else {
        next.add(course)
      }
      return next
    })
  }

  return (
    <>
      <Head>
        <title>Расписание занятий — Колледж Связи ПГУТИ</title>
        <meta name="description" content="Расписание занятий для всех групп Колледжа Связи ПГУТИ" />
      </Head>
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center space-y-2 mb-8 stagger-card" style={{ animationDelay: '0.05s' } as React.CSSProperties}>
            <h1 className="text-3xl md:text-4xl font-bold">Расписание занятий</h1>
            <p className="text-muted-foreground">Выберите группу для просмотра расписания</p>
          </div>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((course, courseIndex) => {
              const courseGroups = groupsByCourse[course] || []
              const isOpen = openCourses.has(course)

              if (courseGroups.length === 0) {
                return null
              }

              return (
                <div
                  key={course}
                  className="stagger-card"
                  style={{
                    animationDelay: `${0.1 + courseIndex * 0.05}s`,
                  } as React.CSSProperties}
                >
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleCourse(course)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">
                          {course} курс
                        </CardTitle>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 transition-transform duration-200",
                            isOpen && "transform rotate-180"
                          )}
                        />
                      </div>
                    </CardHeader>
                    {isOpen && (
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {courseGroups.map(({ id, name }, groupIndex) => {
                            return (
                              <div
                                key={id}
                                className="stagger-card"
                              >
                                <Link href={`/${id}`} className="block">
                                  <Button
                                    variant="outline"
                                    className="w-full justify-center h-auto py-3 px-2 sm:px-4 text-sm sm:text-base h-auto min-h-[48px] whitespace-normal"
                                    title={name}
                                  >
                                    {name}
                                  </Button>
                                </Link>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
              )
            })}
          </div>

          {Object.keys(groups).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Группы не найдены
              </CardContent>
            </Card>
          )}

          {/* Кнопка перехода к расписанию преподавателей */}
          {showTeachersButton && (
            <div
              className="stagger-card mt-6"
            >
              <Link href="/teachers" className="block">
                <Button variant="default" className="w-full h-auto py-4 text-base font-semibold">
                  Расписание преподавателей
                </Button>
              </Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            {showAddGroupButton && (
              <div
                className="stagger-card"
              >
                <Button
                  variant="secondary"
                  onClick={() => setAddGroupDialogOpen(true)}
                  className="gap-2"
                >
                  <MdAdd className="h-4 w-4" />
                  Добавить группу
                </Button>
              </div>
            )}
            <div
              className="stagger-card"
            >
              <ThemeSwitcher />
            </div>
            <div
              className="stagger-card"
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

      {/* Диалог добавления группы */}
      <Dialog open={addGroupDialogOpen} onOpenChange={setAddGroupDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Добавить группу</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Если вы хотите добавить свою группу на сайт, скиньтесь всей группой и задонатьте мне 500 ₽
          </DialogDescription>
          <DialogDescription>
            Для меня это будет очень хорошая поддержка🥺🥺🥺
          </DialogDescription>
          <DialogFooter className="!justify-start !flex-row mt-3 gap-3">
            <Link href={TELEGRAM_CONTACT_URL}>
              <Button tabIndex={-1} className="gap-3">
                <BsTelegram /> Мой Telegram
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<HomePageProps> = async () => {
  // Сначала загружаем только настройки для проверки режима каникул
  // Всегда загружаем свежие настройки без кеша для актуальности
  clearSettingsCache()
  const settings = loadSettings(true)
  const vacationModeEnabled = settings.vacationModeEnabled ?? false

  // Если режим каникул включен, возвращаем только необходимые данные
  if (vacationModeEnabled) {
    return {
      props: {
        vacationModeEnabled: true,
        vacationModeContent: settings.vacationModeContent || ''
      } as VacationModeProps
    }
  }

  // Если режим каникул выключен, загружаем группы и обрабатываем их
  const groups = await loadGroups()

  // Группируем группы по курсам
  const groupsByCourse: { [course: number]: Array<{ id: string; name: string }> } = {}

  for (const [id, group] of Object.entries(groups)) {
    const course = group.course
    if (!groupsByCourse[course]) {
      groupsByCourse[course] = []
    }
    groupsByCourse[course].push({ id, name: group.name })
  }

  // Сортируем группы внутри каждого курса по имени
  // Группы начинающиеся с "(" (заочка) перемещаем в конец
  for (const course in groupsByCourse) {
    groupsByCourse[Number(course)].sort((a, b) => {
      const aIsZaoch = a.name.startsWith('(')
      const bIsZaoch = b.name.startsWith('(')
      
      // Если одна из групп заочка, а другая нет - заочку вниз
      if (aIsZaoch && !bIsZaoch) return 1
      if (!aIsZaoch && bIsZaoch) return -1
      
      // Иначе сортируем по имени
      return a.name.localeCompare(b.name)
    })
  }

  return {
    props: {
      vacationModeEnabled: false,
      groups,
      groupsByCourse,
      showAddGroupButton: SCHED_MODE === 'kspsuti' ? false : (settings.showAddGroupButton ?? true),
      showTeachersButton: settings.showTeachersButton ?? true
    } as NormalModeProps
  }
}
