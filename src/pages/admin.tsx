import React from 'react'
import { GetServerSideProps } from 'next'
import { Button } from '@/shadcn/ui/button'
import { Input } from '@/shadcn/ui/input'
import { Label } from '@/shadcn/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shadcn/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shadcn/ui/dialog'
import { loadGroups, GroupsData } from '@/shared/data/groups-loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shadcn/ui/select'
import Head from 'next/head'

type AdminPageProps = {
  groups: GroupsData
}

export default function AdminPage({ groups: initialGroups }: AdminPageProps) {
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null)
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<GroupsData>(initialGroups)
  const [editingGroup, setEditingGroup] = React.useState<{ id: string; parseId: number; name: string; course: number } | null>(null)
  const [showAddDialog, setShowAddDialog] = React.useState(false)
  const [showEditDialog, setShowEditDialog] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [groupToDelete, setGroupToDelete] = React.useState<string | null>(null)

  // Форма добавления/редактирования
  const [formData, setFormData] = React.useState({
    id: '',
    parseId: '',
    name: '',
    course: '1'
  })

  // Проверка авторизации при загрузке
  React.useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/check-auth')
      const data = await res.json()
      setAuthenticated(data.authenticated)
    } catch (err) {
      setAuthenticated(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setAuthenticated(true)
        setPassword('')
        // Обновляем список групп после авторизации
        await loadGroupsList()
      } else {
        setError(data.error || 'Ошибка авторизации')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const loadGroupsList = async () => {
    try {
      const res = await fetch('/api/admin/groups')
      const data = await res.json()
      if (data.groups) {
        setGroups(data.groups)
      }
    } catch (err) {
      console.error('Error loading groups:', err)
    }
  }

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          parseId: parseInt(formData.parseId, 10),
          name: formData.name,
          course: parseInt(formData.course, 10)
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setGroups(data.groups)
        setShowAddDialog(false)
        setFormData({ id: '', parseId: '', name: '', course: '1' })
      } else {
        setError(data.error || 'Ошибка при добавлении группы')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parseId: parseInt(formData.parseId, 10),
          name: formData.name,
          course: parseInt(formData.course, 10)
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setGroups(data.groups)
        setShowEditDialog(false)
        setEditingGroup(null)
        setFormData({ id: '', parseId: '', name: '', course: '1' })
      } else {
        setError(data.error || 'Ошибка при редактировании группы')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/groups/${groupToDelete}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setGroups(data.groups)
        setShowDeleteDialog(false)
        setGroupToDelete(null)
      } else {
        setError(data.error || 'Ошибка при удалении группы')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (id: string) => {
    const group = groups[id]
    if (group) {
      setEditingGroup({ id, parseId: group.parseId, name: group.name, course: group.course })
      setFormData({ id, parseId: group.parseId.toString(), name: group.name, course: group.course.toString() })
      setShowEditDialog(true)
    }
  }

  const openDeleteDialog = (id: string) => {
    setGroupToDelete(id)
    setShowDeleteDialog(true)
  }

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Загрузка...</div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <>
        <Head>
          <title>Админ-панель — Авторизация</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Авторизация</CardTitle>
              <CardDescription>Введите пароль для доступа к админ-панели</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Вход...' : 'Войти'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Админ-панель — Управление группами</title>
      </Head>
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Админ-панель</h1>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await fetch('/api/admin/logout', { method: 'POST' })
                } catch (err) {
                  console.error('Logout error:', err)
                }
                setAuthenticated(false)
              }}
            >
              Выйти
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Группы</CardTitle>
                  <CardDescription>Управление группами для расписания</CardDescription>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                  Добавить группу
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(groups).length === 0 ? (
                <p className="text-muted-foreground">Группы не найдены</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groups).map(([id, group]) => (
                    <div
                      key={id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-semibold">{group.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {id} | Parse ID: {group.parseId} | Курс: {group.course}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(id)}
                        >
                          Редактировать
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(id)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Диалог добавления группы */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить группу</DialogTitle>
            <DialogDescription>
              Заполните данные для новой группы
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddGroup}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-id">ID группы (slug)</Label>
                <Input
                  id="add-id"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="ib4k"
                  required
                  pattern="[a-z0-9_-]+"
                />
                <p className="text-xs text-muted-foreground">
                  Только строчные буквы, цифры, дефисы и подчеркивания
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-parse-id">ID для парсинга</Label>
                <Input
                  id="add-parse-id"
                  type="number"
                  value={formData.parseId}
                  onChange={(e) => setFormData({ ...formData, parseId: e.target.value })}
                  placeholder="138"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-name">Название группы</Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ИБ-4к"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-course">Курс</Label>
                <Select
                  value={formData.course}
                  onValueChange={(value) => setFormData({ ...formData, course: value })}
                >
                  <SelectTrigger id="add-course">
                    <SelectValue placeholder="Выберите курс" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 курс</SelectItem>
                    <SelectItem value="2">2 курс</SelectItem>
                    <SelectItem value="3">3 курс</SelectItem>
                    <SelectItem value="4">4 курс</SelectItem>
                    <SelectItem value="5">5 курс</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования группы */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать группу</DialogTitle>
            <DialogDescription>
              Измените данные группы
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditGroup}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-id">ID группы</Label>
                <Input
                  id="edit-id"
                  value={editingGroup?.id || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  ID группы нельзя изменить
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-parse-id">ID для парсинга</Label>
                <Input
                  id="edit-parse-id"
                  type="number"
                  value={formData.parseId}
                  onChange={(e) => setFormData({ ...formData, parseId: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Название группы</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-course">Курс</Label>
                <Select
                  value={formData.course}
                  onValueChange={(value) => setFormData({ ...formData, course: value })}
                >
                  <SelectTrigger id="edit-course">
                    <SelectValue placeholder="Выберите курс" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 курс</SelectItem>
                    <SelectItem value="2">2 курс</SelectItem>
                    <SelectItem value="3">3 курс</SelectItem>
                    <SelectItem value="4">4 курс</SelectItem>
                    <SelectItem value="5">5 курс</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог удаления группы */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить группу?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить группу &quot;{groupToDelete && groups[groupToDelete]?.name}&quot;?
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteGroup} disabled={loading}>
              {loading ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async () => {
  const groups = loadGroups()
  return {
    props: {
      groups
    }
  }
}

