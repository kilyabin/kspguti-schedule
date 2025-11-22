import React from 'react'
import { AddGroupButton } from '@/features/add-group'
import { ThemeSwitcher } from '@/features/theme-switch'
import { Button } from '@/shadcn/ui/button'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FaGithub } from 'react-icons/fa'
import { ArrowLeft } from 'lucide-react'
import cx from 'classnames'
import { NavContext, NavContextProvider } from '@/shared/context/nav-context'
import { GITHUB_REPO_URL } from '@/shared/constants/urls'
import { GroupsData } from '@/shared/data/groups-loader'

export function NavBar({ cacheAvailableFor, groups }: {
  cacheAvailableFor: string[]
  groups: GroupsData
}) {
  const { resolvedTheme } = useTheme()
  // Используем состояние для предотвращения проблем с гидратацией
  const [mounted, setMounted] = React.useState(false)
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // На сервере используем 'light' по умолчанию, чтобы избежать различий в гидратации
  const theme = mounted ? (resolvedTheme || 'light') : 'light'

  return (
    <NavContextProvider cacheAvailableFor={cacheAvailableFor}>
      <header className="sticky top-0 w-full p-2 bg-background z-[1] pb-0 mb-2 shadow-header">
        <nav className={cx('rounded-lg p-2 w-full flex gap-2 md:justify-between', { 'bg-slate-200': theme === 'light', 'bg-slate-900': theme === 'dark' })} suppressHydrationWarning>
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <ul className="flex gap-2 flex-nowrap">
              <li className="flex-shrink-0">
                <Link href="/">
                  <Button 
                    variant="secondary" 
                    className="min-h-[44px] whitespace-nowrap gap-2"
                    tabIndex={-1}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">К группам</span>
                  </Button>
                </Link>
              </li>
              {Object.entries(groups).map(([id, group]) => (
                <li key={id} className="hidden md:list-item flex-shrink-0">
                  <NavBarItem url={`/${id}`}>{group.name}</NavBarItem>
                </li>
              ))}
              <li className="flex-shrink-0 hidden md:list-item">
                <AddGroupButton />
              </li>
            </ul>
          </div>
          <div className='flex gap-1 min-[500px]:gap-2 flex-shrink-0'>
            <Link href={GITHUB_REPO_URL} target='_blank' rel='nofollower noreferrer'>
              <Button variant='outline' size='icon' className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0" tabIndex={-1}>
                <FaGithub />
              </Button>
            </Link>
            <ThemeSwitcher />
          </div>
        </nav>
      </header>
    </NavContextProvider>
  )
}

function NavBarItem({ url, children }: React.PropsWithChildren<{
  url: string
}>) {
  const router = useRouter()
  const isActive = router.asPath === url
  const { cacheAvailableFor, isLoading, setIsLoading } = React.useContext(NavContext)

  // Подписываемся на события роутера для сброса состояния загрузки
  React.useEffect(() => {
    const handleRouteChangeComplete = () => {
      setIsLoading(false)
    }

    const handleRouteChangeError = () => {
      setIsLoading(false)
    }

    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    router.events.on('routeChangeError', handleRouteChangeError)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
      router.events.off('routeChangeError', handleRouteChangeError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // router.events и setIsLoading стабильны, не требуют зависимостей

  const handleStartLoading = async () => {
    if (cacheAvailableFor.includes(url.slice(1))) {
      await new Promise(resolve => setTimeout(resolve, 500))
      if (isLoading && isLoading !== url) return
    }
    setIsLoading(url)
  }

  const button = (
    <Button 
      tabIndex={-1} variant={isActive ? 'default' : 'secondary'} 
      disabled={Boolean(isLoading)}
      loading={isLoading === url}
      className="min-h-[44px] whitespace-nowrap"
    >
      {children}
    </Button>
  )

  return (
    <li>
      {isLoading && isLoading === url ? (
        button
      ) : (
        <Link href={url} onClick={handleStartLoading}>
          {button}
        </Link>
      )}
    </li>
  )
}