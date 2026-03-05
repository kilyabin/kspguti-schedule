#!/usr/bin/env node

/**
 * Тест парсера преподавателей
 * Запуск: node scripts/test-teachers-parser.js
 */

const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Импортируем парсер
const { parseTeachersList } = require('./src/app/parser/teachers-list');

// HTML с сервера (сохраните в файл или передайте через аргумент)
const testHtml = `
<html>
<body>
<table border="0" cellpadding="1" cellspacing="1" width="100%" bgcolor="ffffff">
<tr><td bgcolor='eeeeee' align=center><a href='?mn=3&obj=3'><b>Абалымова Людмила Павловна</b></a></td></tr>
<tr><td bgcolor='dddddd' align=center><a href='?mn=3&obj=4'><b>Абрамова Светлана Геннадьевна</b></a></td></tr>
<tr><td bgcolor='eeeeee' align=center><a href='?mn=3&obj=253'><b>Айриянц Илона Артуровна</b></a></td></tr>
<tr><td bgcolor='dddddd' align=center><a href='?mn=3&obj=2'><b>Алёхин Иван Николаевич</b></a></td></tr>
<tr><td bgcolor='eeeeee' align=center><a href='?mn=3&obj=65'><b>Андреевская Наталья Владимировна</b></a></td></tr>
</table>
</body>
</html>
`;

console.log('=== Testing Teachers Parser ===\n');

// Создаём JSDOM
const dom = new JSDOM(testHtml, { url: 'https://lk.ks.psuti.ru/?mn=3' });
const document = dom.window.document;

// Проверяем, находит ли селектор ссылки
const links = Array.from(document.querySelectorAll('a[href*="?mn=3&obj="], a[href*="mn=3&obj="]'));
console.log(`Links found by selector: ${links.length}`);
links.forEach((link, i) => {
  console.log(`  ${i + 1}. href="${link.getAttribute('href')}", text="${link.textContent?.trim()}"`);
});

// Запускаем парсер
const teachers = parseTeachersList(document);
console.log(`\nTeachers parsed: ${teachers.length}`);
teachers.forEach((t, i) => {
  console.log(`  ${i + 1}. [${t.parseId}] ${t.name}`);
});

dom.window.close();

// Теперь тестируем на реальном HTML с сервера
console.log('\n\n=== Testing with Real HTML from Server ===\n');

const realHtmlPath = path.join(__dirname, 'teachers-test.html');
if (fs.existsSync(realHtmlPath)) {
  const realHtml = fs.readFileSync(realHtmlPath, 'utf8');
  const realDom = new JSDOM(realHtml, { url: 'https://lk.ks.psuti.ru/?mn=3' });
  const realDocument = realDom.window.document;
  
  const realTeachers = parseTeachersList(realDocument);
  console.log(`Real teachers parsed: ${realTeachers.length}`);
  realTeachers.slice(0, 10).forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.parseId}] ${t.name}`);
  });
  
  if (realTeachers.length > 10) {
    console.log(`  ... and ${realTeachers.length - 10} more`);
  }
  
  realDom.window.close();
} else {
  console.log(`Test file not found: ${realHtmlPath}`);
  console.log('To test with real HTML, save the curl output to scripts/teachers-test.html');
  console.log('Example: curl -L "https://lk.ks.psuti.ru/?mn=3" > scripts/teachers-test.html');
}
