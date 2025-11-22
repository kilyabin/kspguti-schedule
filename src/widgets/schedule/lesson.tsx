import { Button } from '@/shadcn/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shadcn/ui/card'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shadcn/ui/avatar'
import { Badge } from '@/shadcn/ui/badge'
import { teachers } from '@/shared/data/teachers'
import { Lesson as LessonType } from '@/shared/model/lesson'
import React from 'react'
import { MdSchool } from 'react-icons/md'
import { AiOutlineFolderView } from 'react-icons/ai'
import { BsFillGeoAltFill } from 'react-icons/bs'
import { RiGroup2Fill } from 'react-icons/ri'
import { ResourcesDialog } from '@/widgets/schedule/resources-dialog'

export function Lesson({ lesson, width = 350 }: {
  lesson: LessonType
  width: number
}) {
  const [resourcesDialogOpened, setResourcesDialogOpened] = React.useState(false)

  const hasTeacher = 'teacher' in lesson && lesson.teacher
  const teacherObj = hasTeacher ? teachers.find(t => t.name === lesson.teacher) : null
  
  const hasPlace = 'place' in lesson && lesson.place

  const isFallbackDiscipline = 'fallbackDiscipline' in lesson && lesson.fallbackDiscipline
  const hasSubject = 'subject' in lesson && lesson.subject
  const hasContent = hasSubject || (isFallbackDiscipline && lesson.fallbackDiscipline) || (lesson.topic && lesson.topic.trim())
  const isCancelled = lesson.isChange && !hasContent

  const getTeacherPhoto = (url?: string) => {
    if(url) {
      try {
        const filename = decodeURIComponent(new URL(url).pathname.split('/').pop()!)
        return `/teachers/${filename}`
      } catch(e) {
        console.error(e)
        return null
      }
    } else {
      return null
    }
  }

  const fallbackTeacherName = () => {
    if (!hasTeacher || !lesson.teacher) return ''
    const [, firstName, middleName] = lesson.teacher.split(' ')
    return firstName.at(0)! + middleName.at(0)!
  }

  const handleOpenResources = () => {
    setResourcesDialogOpened(true)
  }

  return (
    <Card className={`w-full ${width === 450 ? 'md:w-[450px] md:min-w-[450px] md:max-w-[450px]' : 'md:w-[350px] md:min-w-[350px] md:max-w-[350px]'} flex flex-col relative overflow-hidden snap-start scroll-ml-16 shrink-0`}> 
      {lesson.isChange && <div className='absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#ffc60026] to-[#95620026] pointer-events-none'></div>}
      <CardHeader>
        <div className='flex gap-2 md:gap-4'>
          {hasTeacher ? (
            <Avatar className="flex-shrink-0">
              <AvatarImage 
                src={getTeacherPhoto(teacherObj?.picture)!} 
                alt={lesson.teacher} 
                title={lesson.teacher} 
              />
              <AvatarFallback title={lesson.teacher}>
                {fallbackTeacherName()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="flex-shrink-0">
              <AvatarFallback><MdSchool /></AvatarFallback>
            </Avatar>
          )}
          <div className='flex flex-col gap-1 min-w-0 flex-1'>
            {isCancelled ? (
              <CardTitle className='hyphens-auto break-words text-base md:text-lg'>Пары нет</CardTitle>
            ) : (
              hasSubject && <CardTitle className='hyphens-auto break-words text-base md:text-lg'>{lesson.subject}</CardTitle>
            )}
            <CardDescription className="text-xs md:text-sm">
              {lesson.time.start} - {lesson.time.end}{
              }{lesson.time.hint && <span className='font-bold'>&nbsp;({lesson.time.hint})</span>}
            </CardDescription>
            {!isCancelled && hasTeacher && lesson.teacher && (
              <CardDescription className='text-xs md:text-sm font-medium break-words'>
                {lesson.teacher}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm md:text-base">
        {isCancelled ? (
          <span className='text-muted-foreground italic'>Пара отменена</span>
        ) : (
          <>
            {lesson.type && <><Badge className="text-xs md:text-sm">{lesson.type}</Badge>{' '}&nbsp;</>}
            {isFallbackDiscipline && (
              <span className='leading-relaxed hyphens-auto block break-words text-muted-foreground'>{lesson.fallbackDiscipline}</span>
            )}
            {lesson.topic ? (
              <span className='leading-relaxed hyphens-auto break-words text-muted-foreground'>{lesson.topic}</span>
            ) : (
              !isFallbackDiscipline && hasSubject && <span className='text-border font-semibold'>Нет описания пары</span>
            )}
          </>
        )}
        {!isCancelled && ('place' in lesson && lesson.place) && (
          <div className='flex flex-col text-muted-foreground text-xs break-words mt-3 md:hidden'>
            <span className='flex items-center gap-2'><BsFillGeoAltFill /> <span className="break-words">{lesson.place.address}</span></span>
            <span className='font-bold flex items-center gap-2'><RiGroup2Fill /> {lesson.place.classroom}</span>
          </div>
        )}
      </CardContent>
      {!isCancelled && (Boolean(lesson.resources.length) || ('place' in lesson && lesson.place)) && (
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 mt-auto">
          {('place' in lesson && lesson.place) ? (
            <div className='hidden md:flex flex-col text-muted-foreground text-xs break-words'>
              <span className='flex items-center gap-2'><BsFillGeoAltFill /> <span className="break-words">{lesson.place.address}</span></span>
              <span className='font-bold flex items-center gap-2'><RiGroup2Fill /> {lesson.place.classroom}</span>
            </div>
          ) : <span />}
          {Boolean(lesson.resources.length) && (
            <Button onClick={handleOpenResources} className="min-h-[44px] w-full sm:w-auto"><AiOutlineFolderView />&nbsp;Материалы</Button>
          )}
        </CardFooter>
      )}
      <ResourcesDialog 
        open={resourcesDialogOpened} 
        onClose={() => setResourcesDialogOpened(false)}
        teacherName={('teacher' in lesson && lesson.teacher) ? lesson.teacher : undefined}
        resources={lesson.resources} 
      />
    </Card>
  )
}