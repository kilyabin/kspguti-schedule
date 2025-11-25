'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu'

export function ThemeSwitcher() {
  const { setTheme } = useTheme()

  return (
    <div className="flex-shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-h-[44px] md:min-h-0 flex-shrink-0 gap-2 px-3 whitespace-nowrap">
            <div className="relative h-[1.2rem] w-[1.2rem] flex-shrink-0">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute inset-0" />
              <Moon className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 absolute inset-0" />
            </div>
            <span className="flex-shrink-0">Тема</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px] whitespace-nowrap">
          <DropdownMenuItem onClick={() => setTheme('light')} className="whitespace-nowrap">
            Светлая тема
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')} className="whitespace-nowrap">
            Темная тема
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')} className="whitespace-nowrap">
            Как в системе
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
