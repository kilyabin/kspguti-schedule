#!/usr/bin/env node

/**
 * Скрипт для сброса пароля администратора
 * 
 * Использование:
 *   node scripts/reset-admin-password.js [новый_пароль]
 *   или
 *   node scripts/reset-admin-password.js (интерактивный режим)
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Определяем путь к базе данных
function findDatabase() {
  // Определяем корень проекта (для standalone режима поднимаемся на 2 уровня вверх)
  let projectRoot = process.cwd();
  if (projectRoot.includes('.next/standalone')) {
    const match = projectRoot.match(/^(.+?)\/\.next\/standalone/);
    if (match && match[1]) {
      projectRoot = match[1];
    } else {
      projectRoot = path.resolve(projectRoot, '..', '..');
    }
  }

  const possiblePaths = [
    path.join(projectRoot, 'db', 'schedule-app.db'),
    '/opt/kspguti-schedule/db/schedule-app.db',
    path.join(process.cwd(), 'db', 'schedule-app.db'),
    path.join(process.cwd(), '.next', 'standalone', 'db', 'schedule-app.db'),
    '/opt/kspguti-schedule/.next/standalone/db/schedule-app.db',
    // Старые пути для обратной совместимости
    path.join(projectRoot, 'data', 'schedule-app.db'),
    '/opt/kspguti-schedule/data/schedule-app.db',
  ];

  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      return dbPath;
    }
  }

  return null;
}

// Функция для чтения пароля из терминала (простая версия)
function readPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (password) => {
      rl.close();
      resolve(password);
    });
  });
}

async function main() {
  console.log('🔐 Сброс пароля администратора\n');

  // Находим базу данных
  const dbPath = findDatabase();
  if (!dbPath) {
    console.error('❌ Ошибка: База данных не найдена!');
    console.log('\nИскали в следующих местах:');
    
    // Определяем корень проекта для отображения
    let projectRoot = process.cwd();
    if (projectRoot.includes('.next/standalone')) {
      const match = projectRoot.match(/^(.+?)\/\.next\/standalone/);
      if (match && match[1]) {
        projectRoot = match[1];
      } else {
        projectRoot = path.resolve(projectRoot, '..', '..');
      }
    }
    
    console.log('  - ' + path.join(projectRoot, 'db', 'schedule-app.db'));
    console.log('  - /opt/kspguti-schedule/db/schedule-app.db');
    console.log('  - ' + path.join(process.cwd(), 'db', 'schedule-app.db'));
    console.log('\n💡 Подсказка: База данных должна находиться в папке db/ в корне проекта');
    process.exit(1);
  }

  console.log('✓ Найдена база данных: ' + dbPath + '\n');

  // Получаем новый пароль
  let newPassword;
  if (process.argv[2]) {
    newPassword = process.argv[2];
  } else {
    newPassword = await readPassword('Введите новый пароль (минимум 8 символов): ');
    
    if (newPassword.length < 8) {
      console.error('❌ Ошибка: Пароль должен содержать минимум 8 символов');
      process.exit(1);
    }

    const confirmPassword = await readPassword('Подтвердите пароль: ');
    
    if (newPassword !== confirmPassword) {
      console.error('❌ Ошибка: Пароли не совпадают');
      process.exit(1);
    }
  }

  if (newPassword.length < 8) {
    console.error('❌ Ошибка: Пароль должен содержать минимум 8 символов');
    process.exit(1);
  }

  // Открываем базу данных и обновляем пароль
  try {
    console.log('\n⏳ Обновление пароля...');
    
    const db = new Database(dbPath);
    
    // Хешируем новый пароль
    const saltRounds = 10;
    const hash = bcrypt.hashSync(newPassword, saltRounds);
    
    // Обновляем пароль в базе данных
    db.prepare('INSERT OR REPLACE INTO admin_password (id, password_hash) VALUES (1, ?)').run(hash);
    
    db.close();
    
    console.log('✅ Пароль успешно изменен!');
    console.log('\n⚠️  ВАЖНО: Сохраните пароль в безопасном месте!');
    if (process.argv[2]) {
      console.log('Новый пароль: ' + newPassword);
    }
  } catch (error) {
    console.error('❌ Ошибка при изменении пароля:');
    console.error(error.message);
    process.exit(1);
  }
}

main();

