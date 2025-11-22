import React from 'react'
import { GetServerSideProps } from 'next'
import { loadGroups, GroupsData } from '@/shared/data/groups-loader'
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
import { GITHUB_REPO_URL, TELEGRAM_CONTACT_URL } from '@/shared/constants/urls'
import { MdAdd } from 'react-icons/md'
import { FaGithub } from 'react-icons/fa'
import { BsTelegram } from 'react-icons/bs'

type HomePageProps = {
  groups: GroupsData
  groupsByCourse: { [course: number]: Array<{ id: string; name: string }> }
}

export default function HomePage({ groups, groupsByCourse }: HomePageProps) {
  const [openCourses, setOpenCourses] = React.useState<Set<number>>(new Set([1]))
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
        <meta name="description" content="Расписание занятий для всех групп Колледжа Связи ПГУТИ. Выберите группу для просмотра расписания." />
      </Head>
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold">Расписание занятий</h1>
            <p className="text-muted-foreground">Выберите группу для просмотра расписания</p>
          </div>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(course => {
              const courseGroups = groupsByCourse[course] || []
              const isOpen = openCourses.has(course)

              if (courseGroups.length === 0) {
                return null
              }

              return (
                <Card key={course}>
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
                      <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {courseGroups.map(({ id, name }) => (
                          <Link key={id} href={`/${id}`}>
                            <Button
                              variant="outline"
                              className="w-full justify-center h-auto py-3 px-2 sm:px-4 text-sm sm:text-base whitespace-nowrap"
                            >
                              {name}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Button
              variant="secondary"
              onClick={() => setAddGroupDialogOpen(true)}
              className="gap-2"
            >
              <MdAdd className="h-4 w-4" />
              Добавить группу
            </Button>
            <div className="relative">
              <ThemeSwitcher />
              <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap sm:hidden">
                Тема
              </span>
            </div>
            <Link href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <FaGithub className="h-4 w-4" />
                GitHub
              </Button>
            </Link>
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
  const groups = loadGroups()

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
  for (const course in groupsByCourse) {
    groupsByCourse[Number(course)].sort((a, b) => a.name.localeCompare(b.name))
  }

  return {
    props: {
      groups,
      groupsByCourse
    }
  }
}
