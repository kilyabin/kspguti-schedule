#!/usr/bin/env node

/**
 * Скрипт для проверки базы данных преподавателей
 * Запуск: node scripts/test-teachers-db.js
 */

const path = require('path');
const fs = require('fs');

// Определяем директорию базы данных
function getDatabaseDir() {
  if (process.env.DATABASE_DIR) {
    return process.env.DATABASE_DIR;
  }

  const cwd = process.cwd();
  console.log(`Current working directory: ${cwd}`);

  if (cwd.includes('.next/standalone')) {
    const standaloneMatch = cwd.match(/^(.+?)\/\.next\/standalone/);
    if (standaloneMatch && standaloneMatch[1]) {
      return standaloneMatch[1];
    }
    return path.resolve(cwd, '..', '..');
  }

  if (fs.existsSync('/opt/kspguti-schedule')) {
    return '/opt/kspguti-schedule';
  }

  return cwd;
}

const DATABASE_DIR = getDatabaseDir();
const DB_PATH = path.join(DATABASE_DIR, 'db', 'schedule-app.db');

console.log(`Database directory: ${DATABASE_DIR}`);
console.log(`Database path: ${DB_PATH}`);
console.log(`Database exists: ${fs.existsSync(DB_PATH)}`);

if (!fs.existsSync(DB_PATH)) {
  console.error('Database file does not exist!');
  process.exit(1);
}

// Проверяем права доступа
try {
  fs.accessSync(DB_PATH, fs.constants.R_OK | fs.constants.W_OK);
  console.log('Database file is readable and writable');
} catch (err) {
  console.error('Database file permissions error:', err.message);
  process.exit(1);
}

// Подключаемся к базе данных
const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

// Проверяем таблицу teachers
console.log('\n=== Teachers Table ===');
const teachersCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get();
console.log(`Total teachers in database: ${teachersCount.count}`);

if (teachersCount.count > 0) {
  const teachers = db.prepare('SELECT id, parseId, name FROM teachers LIMIT 10').all();
  console.log('First 10 teachers:');
  teachers.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.id}] ${t.name} (parseId: ${t.parseId})`);
  });
} else {
  console.log('Teachers table is EMPTY!');
}

// Проверяем таблицу groups
console.log('\n=== Groups Table ===');
const groupsCount = db.prepare('SELECT COUNT(*) as count FROM groups').get();
console.log(`Total groups in database: ${groupsCount.count}`);

if (groupsCount.count > 0) {
  const groups = db.prepare('SELECT id, parseId, name, course FROM groups LIMIT 10').all();
  console.log('First 10 groups:');
  groups.forEach((g, i) => {
    console.log(`  ${i + 1}. [${g.id}] ${g.name} (parseId: ${g.parseId}, course: ${g.course})`);
  });
}

// Проверяем таблицу settings
console.log('\n=== Settings Table ===');
const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('app');
if (settings) {
  console.log('App settings:', settings.value);
} else {
  console.log('No app settings found');
}

db.close();
console.log('\nDone!');
