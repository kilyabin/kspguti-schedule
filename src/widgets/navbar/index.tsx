import React from 'react'
import { AddGroupButton } from '@/features/add-group'
import { ThemeSwitcher } from '@/features/theme-switch'
import { Button } from '@/shadcn/ui/button'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FaGithub } from 'react-icons/fa'
import cx from 'classnames'
import { NavContext, NavContextProvider } from '@/shared/context/nav-context'

export function NavBar({ cacheAvailableFor }: {
  cacheAvailableFor: string[]
}) {
  const { resolvedTheme } = useTheme()
  const [schemeTheme, setSchemeTheme] = React.useState<string>()
  const navRef = React.useRef<HTMLDivElement>(null)

  const getSchemeTheme = () => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('theme') || document.querySelector('html')!.style.colorScheme
    } else 
      return 'light'
  }

  React.useEffect(() => {
    setSchemeTheme(getSchemeTheme())
  }, [])

  const theme = resolvedTheme || schemeTheme

  React.useEffect(() => {
    if(theme === 'light') {
      navRef.current?.classList.add('bg-slate-200')
      navRef.current?.classList.remove('bg-slate-900')
    } else {
      navRef.current?.classList.add('bg-slate-900')
      navRef.current?.classList.remove('bg-slate-200')
    }
  }, [theme])

  return (
    <NavContextProvider cacheAvailableFor={cacheAvailableFor}>
      <header className="sticky top-0 w-full p-2 bg-background z-[1] pb-0 mb-2 shadow-header">
        <nav className={cx('rounded-lg p-2 w-full flex justify-between', { 'bg-slate-200': theme === 'light', 'bg-slate-900': theme === 'dark' })} ref={navRef}>
          <ul className="flex gap-2">
            <NavBarItem url="/ps7">ПС-7</NavBarItem>
            <NavBarItem url="/pks35k">ПКС-35к</NavBarItem>
            <AddGroupButton />
          </ul>
          <div className='flex gap-1 min-[500px]:gap-2'>
            <Link href='https://github.com/VityaSchel/kspguti-schedule' target='_blank' rel='nofollower noreferrer'>
              <Button variant='outline' size='icon' tabIndex={-1}>
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

  const handleStartLoading = async () => {
    let isLoaded = false

    const loadEnd = () => {
      isLoaded = true
      setIsLoading(false)
    }

    router.events.on('routeChangeComplete', loadEnd)
    router.events.on('routeChangeError', loadEnd)

    if (cacheAvailableFor.includes(url.slice(1))) {
      await new Promise(resolve => setTimeout(resolve, 500))
      if(isLoaded) return
    }
    setIsLoading(url)

    return () => {
      router.events.off('routeChangeComplete', loadEnd)
      router.events.off('routeChangeError', loadEnd)
    }
  }

  const button = (
    <Button 
      tabIndex={-1} variant={isActive ? 'default' : 'secondary'} 
      disabled={Boolean(isLoading)}
      loading={isLoading === url}
    >
      {children}
    </Button>
  )

  return (
    <li>
      {isLoading ? (
        button
      ) : (
        <Link href={url} onClick={handleStartLoading}>
          {button}
        </Link>
      )}
    </li>
  )
}