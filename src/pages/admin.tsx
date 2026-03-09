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
import { loadSettings, AppSettings } from '@/shared/data/settings-loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shadcn/ui/select'
import { ToastContainer, Toast } from '@/shared/ui/toast'
import Head from 'next/head'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shadcn/ui/accordion'
import { SCHED_MODE } from '@/shared/constants/urls'

type AdminPageProps = {
  groups: GroupsData
  settings: AppSettings
  isDefaultPassword: boolean
  isKspsutiMode: boolean
}

// Компонент Toggle Switch
function ToggleSwitch({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
    </label>
  )
}

// Компонент выбора курса
function CourseSelect({ value, onChange, id }: {
  value: string
  onChange: (value: string) => void
  id: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
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
  )
}

// Компонент для DialogFooter с кнопками
function DialogFooterButtons({ onCancel, onSubmit, submitLabel, loading, submitVariant = 'default' }: {
  onCancel: () => void
  onSubmit?: () => void
  submitLabel: string
  loading?: boolean
  submitVariant?: 'default' | 'destructive'
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Отмена
      </Button>
      {onSubmit && (
        <Button type="button" variant={submitVariant} onClick={onSubmit} disabled={loading}>
          {loading ? 'Обработка...' : submitLabel}
        </Button>
      )}
    </DialogFooter>
  )
}

export default function AdminPage({ groups: initialGroups, settings: initialSettings, isDefaultPassword: initialIsDefaultPassword, isKspsutiMode }: AdminPageProps) {
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null)
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<GroupsData>(initialGroups)
  const [settings, setSettings] = React.useState<AppSettings>(initialSettings)
  const [editingGroup, setEditingGroup] = React.useState<{ id: string; parseId: number; name: string; course: number } | null>(null)
  const [showAddDialog, setShowAddDialog] = React.useState(false)
  const [showEditDialog, setShowEditDialog] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [showLogsDialog, setShowLogsDialog] = React.useState(false)
  const [logs, setLogs] = React.useState<string>('')
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [groupToDelete, setGroupToDelete] = React.useState<string | null>(null)
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [showChangePasswordDialog, setShowChangePasswordDialog] = React.useState(false)
  const [isDefaultPassword, setIsDefaultPassword] = React.useState<boolean>(initialIsDefaultPassword)
  const [passwordFormData, setPasswordFormData] = React.useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showVacationModeEditDialog, setShowVacationModeEditDialog] = React.useState(false)
  const [vacationModeContent, setVacationModeContent] = React.useState<string>(settings.vacationModeContent || '')

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

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
        // Обновляем список групп и настроек после авторизации
        await loadGroupsList()
        await loadSettingsList()
      } else {
        setError(data.error || 'Ошибка авторизации')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async <T,>(endpoint: string, setter: (data: T) => void) => {
    try {
      const res = await fetch(endpoint)
      const data = await res.json()
      if (data.groups) {
        setter(data.groups as T)
      } else if (data.settings) {
        setter(data.settings as T)
      }
    } catch (err) {
      console.error(`Error loading data from ${endpoint}:`, err)
    }
  }

  const loadGroupsList = () => loadData('/api/admin/groups', setGroups)
  const loadSettingsList = () => loadData('/api/admin/settings', setSettings)

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    // Сохраняем предыдущее состояние для отката
    const previousSettings = settings
    // Оптимистичное обновление UI
    setSettings(newSettings)
    setError(null)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Обновляем состояние из ответа сервера
        setSettings(data.settings)
        showToast('Настройки успешно обновлены', 'success')
      } else {
        // Откат изменений при ошибке
        setSettings(previousSettings)
        const errorMessage = data.error || 'Ошибка при обновлении настроек'
        setError(errorMessage)
        showToast(errorMessage, 'error')
      }
    } catch (err) {
      // Откат изменений при ошибке
      setSettings(previousSettings)
      const errorMessage = 'Ошибка соединения с сервером'
      setError(errorMessage)
      showToast(errorMessage, 'error')
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
        showToast('Группа успешно добавлена', 'success')
      } else {
        const errorMessage = data.error || 'Ошибка при добавлении группы'
        setError(errorMessage)
        showToast(errorMessage, 'error')
      }
    } catch (err) {
      const errorMessage = 'Ошибка соединения с сервером'
      setError(errorMessage)
      showToast(errorMessage, 'error')
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
        showToast('Группа успешно обновлена', 'success')
      } else {
        const errorMessage = data.error || 'Ошибка при редактировании группы'
        setError(errorMessage)
        showToast(errorMessage, 'error')
      }
    } catch (err) {
      const errorMessage = 'Ошибка соединения с сервером'
      setError(errorMessage)
      showToast(errorMessage, 'error')
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
        showToast('Группа успешно удалена', 'success')
      } else {
        const errorMessage = data.error || 'Ошибка при удалении группы'
        setError(errorMessage)
        showToast(errorMessage, 'error')
      }
    } catch (err) {
      const errorMessage = 'Ошибка соединения с сервером'
      setError(errorMessage)
      showToast(errorMessage, 'error')
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

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/admin/logs')
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs ?? '')
      } else {
        setLogs(data.error || 'Не удалось загрузить логи')
      }
    } catch (err) {
      setLogs('Ошибка при загрузке логов')
      console.error('Error loading logs:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleOpenLogsDialog = () => {
    setShowLogsDialog(true)
    loadLogs()
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleOpenLogsDialog}
              >
                Логи
              </Button>
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
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {isDefaultPassword && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <CardHeader>
                <CardTitle className="text-yellow-800 dark:text-yellow-200">Внимание: используется стандартный пароль</CardTitle>
                <CardDescription className="text-yellow-700 dark:text-yellow-300">
                  Для безопасности рекомендуется сменить пароль на более надежный
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowChangePasswordDialog(true)} variant="default">
                  Сменить пароль
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Безопасность</CardTitle>
              <CardDescription>Управление паролем администратора</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowChangePasswordDialog(true)} variant="outline">
                Сменить пароль
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
              <CardDescription>Управление настройками приложения</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold">Навигация по неделям</div>
                    <div className="text-sm text-muted-foreground">
                      Включить или выключить навигацию по неделям в расписании
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.weekNavigationEnabled}
                    onChange={(checked) => handleUpdateSettings({ ...settings, weekNavigationEnabled: checked })}
                    disabled={loading}
                  />
                </div>
                {!isKspsutiMode && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-semibold">Кнопка "Добавить группу"</div>
                      <div className="text-sm text-muted-foreground">
                        Отображать кнопку "Добавить группу" на главной странице
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={settings.showAddGroupButton ?? true}
                      onChange={(checked) => handleUpdateSettings({ ...settings, showAddGroupButton: checked })}
                      disabled={loading}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold">Кнопка "Преподаватели"</div>
                    <div className="text-sm text-muted-foreground">
                      Отображать кнопку перехода к расписанию преподавателей на главной странице
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.showTeachersButton ?? true}
                    onChange={(checked) => handleUpdateSettings({ ...settings, showTeachersButton: checked })}
                    disabled={loading}
                  />
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold">Режим "Каникулы"</div>
                      <div className="text-sm text-muted-foreground">
                        Включить режим каникул (заменяет главную страницу)
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={settings.vacationModeEnabled ?? false}
                      onChange={(checked) => handleUpdateSettings({ ...settings, vacationModeEnabled: checked })}
                      disabled={loading}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Редактировать текст каникул</div>
                      <div className="text-sm text-muted-foreground">
                        Настроить текст, отображаемый в режиме каникул
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setVacationModeContent(settings.vacationModeContent || '')
                        setShowVacationModeEditDialog(true)
                      }}
                      disabled={loading}
                    >
                      Редактировать
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Группы</CardTitle>
                  <CardDescription>Управление группами для расписания</CardDescription>
                </div>
                {!isKspsutiMode && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    Добавить группу
                  </Button>
                )}
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
                        {isKspsutiMode && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Группа получена автоматически с lk.ks.psuti.ru. Редактирование отключено.
                          </div>
                        )}
                      </div>
                      {!isKspsutiMode && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {process.env.NODE_ENV === 'development' && (
            <Card>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="debug-options">
                  <AccordionTrigger className="px-6">
                    <CardTitle className="text-base">Debug опции</CardTitle>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-semibold">Принудительно использовать кэш</div>
                            <div className="text-sm text-muted-foreground">
                              Принудительно использовать кэш, даже если он свежий (симулирует ошибку парсинга)
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={settings.debug?.forceCache ?? false}
                            onChange={(checked) => handleUpdateSettings({
                              ...settings,
                              debug: {
                                ...settings.debug,
                                forceCache: checked
                              }
                            })}
                            disabled={loading}
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-semibold">Принудительно показать пустое расписание</div>
                            <div className="text-sm text-muted-foreground">
                              Показать пустое расписание независимо от реальных данных
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={settings.debug?.forceEmpty ?? false}
                            onChange={(checked) => handleUpdateSettings({
                              ...settings,
                              debug: {
                                ...settings.debug,
                                forceEmpty: checked
                              }
                            })}
                            disabled={loading}
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-semibold">Принудительно показать ошибку</div>
                            <div className="text-sm text-muted-foreground">
                              Показать страницу ошибки независимо от реальных данных
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={settings.debug?.forceError ?? false}
                            onChange={(checked) => handleUpdateSettings({
                              ...settings,
                              debug: {
                                ...settings.debug,
                                forceError: checked
                              }
                            })}
                            disabled={loading}
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-semibold">Принудительно симулировать таймаут</div>
                            <div className="text-sm text-muted-foreground">
                              Симулировать таймаут при загрузке расписания
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={settings.debug?.forceTimeout ?? false}
                            onChange={(checked) => handleUpdateSettings({
                              ...settings,
                              debug: {
                                ...settings.debug,
                                forceTimeout: checked
                              }
                            })}
                            disabled={loading}
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-semibold">Показать информацию о кэше</div>
                            <div className="text-sm text-muted-foreground">
                              Показать дополнительную информацию о кэше в интерфейсе
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={settings.debug?.showCacheInfo ?? false}
                            onChange={(checked) => handleUpdateSettings({
                              ...settings,
                              debug: {
                                ...settings.debug,
                                showCacheInfo: checked
                              }
                            })}
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          )}
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
                <CourseSelect
                  value={formData.course}
                  onChange={(value) => setFormData({ ...formData, course: value })}
                  id="add-course"
                />
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
                <CourseSelect
                  value={formData.course}
                  onChange={(value) => setFormData({ ...formData, course: value })}
                  id="edit-course"
                />
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
          <DialogFooterButtons
            onCancel={() => setShowDeleteDialog(false)}
            onSubmit={handleDeleteGroup}
            submitLabel="Удалить"
            loading={loading}
            submitVariant="destructive"
          />
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра логов */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Логи ошибок</DialogTitle>
            <DialogDescription>
              Ошибки парсинга записываются в error.log. Если записей пока нет — здесь будет пусто.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {logsLoading ? (
              <div className="p-4 text-center text-muted-foreground">Загрузка логов...</div>
            ) : (
              <div className="relative">
                <pre className="p-4 bg-muted rounded-md overflow-auto max-h-[60vh] text-sm font-mono whitespace-pre-wrap break-words">
                  {logs || 'Логи пусты'}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={loadLogs}
                >
                  Обновить
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowLogsDialog(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог смены пароля */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сменить пароль</DialogTitle>
            <DialogDescription>
              Введите старый пароль и новый пароль (минимум 8 символов)
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              setError(null)

              // Валидация на клиенте
              if (passwordFormData.newPassword.length < 8) {
                setError('Новый пароль должен содержать минимум 8 символов')
                setLoading(false)
                return
              }

              if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
                setError('Новые пароли не совпадают')
                setLoading(false)
                return
              }

              try {
                const res = await fetch('/api/admin/change-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    oldPassword: passwordFormData.oldPassword,
                    newPassword: passwordFormData.newPassword
                  })
                })

                const data = await res.json()

                if (res.ok && data.success) {
                  setShowChangePasswordDialog(false)
                  setPasswordFormData({ oldPassword: '', newPassword: '', confirmPassword: '' })
                  setIsDefaultPassword(false) // После смены пароля он больше не дефолтный
                  showToast('Пароль успешно изменен', 'success')
                } else {
                  const errorMessage = data.error || 'Ошибка при смене пароля'
                  setError(errorMessage)
                  showToast(errorMessage, 'error')
                }
              } catch (err) {
                const errorMessage = 'Ошибка соединения с сервером'
                setError(errorMessage)
                showToast(errorMessage, 'error')
              } finally {
                setLoading(false)
              }
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="old-password">Старый пароль</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={passwordFormData.oldPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, oldPassword: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Новый пароль</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Минимум 8 символов
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Подтверждение нового пароля</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowChangePasswordDialog(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сменить пароль'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования текста каникул */}
      <Dialog open={showVacationModeEditDialog} onOpenChange={setShowVacationModeEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Редактирование текста режима Каникулы</DialogTitle>
            <DialogDescription>
              Отредактируйте текст, который будет отображаться в режиме каникул. Поддерживается форматирование Markdown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vacation-mode-content">Текст (Markdown)</Label>
              <textarea
                id="vacation-mode-content"
                value={vacationModeContent}
                onChange={(e) => setVacationModeContent(e.target.value)}
                className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder="Введите текст в формате Markdown..."
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold">Подсказки по форматированию:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><code className="bg-muted px-1 py-0.5 rounded"># Заголовок</code> - заголовок первого уровня</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">## Подзаголовок</code> - заголовок второго уровня</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">**жирный**</code> - <strong>жирный текст</strong></li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">*курсив*</code> - <em>курсивный текст</em></li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">[текст](url)</code> - ссылка</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">- элемент</code> - маркированный список</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowVacationModeEditDialog(false)
                setVacationModeContent(settings.vacationModeContent || '')
              }}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setLoading(true)
                setError(null)

                try {
                  const updatedSettings = {
                    ...settings,
                    vacationModeContent: vacationModeContent
                  }
                  await handleUpdateSettings(updatedSettings)
                  setShowVacationModeEditDialog(false)
                  showToast('Текст каникул успешно сохранен', 'success')
                } catch (err) {
                  const errorMessage = 'Ошибка при сохранении текста'
                  setError(errorMessage)
                  showToast(errorMessage, 'error')
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast уведомления */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async () => {
  const groups = await loadGroups()
  const settings = loadSettings()
  
  // Проверяем, используется ли дефолтный пароль
  const { isDefaultPassword } = await import('@/shared/data/database')
  const isDefault = await isDefaultPassword()
  
  return {
    props: {
      groups,
      settings,
      isDefaultPassword: isDefault,
      isKspsutiMode: SCHED_MODE === 'kspsuti',
    }
  }
}
