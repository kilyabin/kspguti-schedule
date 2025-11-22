import React from 'react'
import { Button } from '@/shadcn/ui/button'
import { MdAdd } from 'react-icons/md'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shadcn/ui/dialog'
import Link from 'next/link'
import Image from 'next/image'
import { BsTelegram } from 'react-icons/bs'
import { SlSocialVkontakte } from 'react-icons/sl'
import { TELEGRAM_CONTACT_URL } from '@/shared/constants/urls'

export function AddGroupButton() {
  const [popupVisible, setPopupVisible] = React.useState(false)

  const handleOpenPopup = () => {
    setPopupVisible(true)
  }

  return (
    <>
      <Button variant='secondary' size='icon' className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0" onClick={handleOpenPopup}><MdAdd /></Button>
      <Popup open={popupVisible} onClose={() => setPopupVisible(false)} />
    </>
  )
}

function Popup({ open, onClose }: {
  open: boolean
  onClose: () => any
}) {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
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
        <DialogDescription>
        </DialogDescription>
        <DialogFooter className='!justify-start !flex-row mt-3 gap-3'>
          <Link href={TELEGRAM_CONTACT_URL}>
            <Button tabIndex={-1} className='gap-3'><BsTelegram /> Мой Telegram</Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
