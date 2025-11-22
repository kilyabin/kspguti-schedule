// Загружаем группы из JSON файла только на сервере
// На клиенте будет пустой объект, группы должны передаваться через props
let groups: { [group: string]: [number, string] } = {}

// Используем условный require только на сервере для избежания включения fs в клиентскую сборку
if (typeof window === 'undefined') {
  // Серверная сторона
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const groupsLoader = require('./groups-loader')
    groups = groupsLoader.loadGroups()
  } catch (error) {
    console.error('Error loading groups:', error)
    groups = {}
  }
}

export { groups }
