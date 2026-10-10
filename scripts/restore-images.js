const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const dbPath = process.env.DB_PATH || path.join(root, 'data', 'ra3-manager.sqlite');
const outputDir = path.join(root, 'client', 'public', 'images', 'imported');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const concurrency = 6;

if (!fs.existsSync(dbPath)) {
  console.error('База не найдена:', dbPath);
  console.error('Положите ra3-manager.sqlite в папку data или задайте DB_PATH.');
  process.exit(1);
}

const db = new Database(dbPath);
const imageFields = [
  ['Team', 'logoUrl'],
  ['Rank', 'imageUrl'],
  ['RatingLeague', 'imageUrl'],
  ['Map', 'imageUrl'],
  ['Tournament', 'imageUrl'],
  ['Achievement', 'imageUrl'],
  ['Medal', 'imageUrl'],
  ['AchievementShowcase', 'imageUrl']
];

const urlSet = new Set();
for (const [table, field] of imageFields) {
  const rows = db.prepare(`SELECT "${field}" AS url FROM "${table}" WHERE "${field}" IS NOT NULL AND "${field}" != ''`).all();
  for (const row of rows) {
    if (/^https?:\/\//i.test(row.url)) urlSet.add(row.url);
  }
}

const urls = [...urlSet];
const downloaded = new Map();
const failed = [];
fs.mkdirSync(outputDir, { recursive: true });

function extensionFor(url, contentType) {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(fromUrl)) return fromUrl;
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  return ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' })[mime] || '.img';
}

async function download(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'RA3-Manager-Image-Migration/1.0' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const type = response.headers.get('content-type') || '';
    if (!type.toLowerCase().startsWith('image/')) throw new Error('сервер вернул не изображение (' + type + ')');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_IMAGE_BYTES) throw new Error('файл больше 10 МБ');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('пустой файл или размер больше 10 МБ');
    const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 20);
    const fileName = hash + extensionFor(url, type);
    fs.writeFileSync(path.join(outputDir, fileName), bytes);
    downloaded.set(url, '/images/imported/' + fileName);
  } catch (error) {
    failed.push({ url, error: error.message });
  }
}

async function main() {
  console.log('Найдено уникальных внешних изображений:', urls.length);
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const index = next++;
      await download(urls[index]);
      if ((index + 1) % 10 === 0 || index + 1 === urls.length) {
        console.log('Проверено:', index + 1, '/', urls.length);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

  const updateStatements = imageFields.map(([table, field]) => ({
    table,
    field,
    statement: db.prepare(`UPDATE "${table}" SET "${field}" = ? WHERE "${field}" = ?`)
  }));
  const updateAll = db.transaction(() => {
    for (const [oldUrl, localUrl] of downloaded) {
      for (const item of updateStatements) item.statement.run(localUrl, oldUrl);
    }
  });
  updateAll();

  console.log('');
  console.log('Успешно сохранено локально:', downloaded.size);
  console.log('Не удалось скачать:', failed.length);
  if (failed.length) {
    const reportPath = path.join(root, 'image-restore-failures.txt');
    fs.writeFileSync(reportPath, failed.map(x => x.url + '\n  ' + x.error).join('\n\n'), 'utf8');
    console.log('Список недоступных изображений:', reportPath);
  }
  console.log('Локальные изображения:', outputDir);
  console.log('Обновлено только тех адресов, изображения которых удалось скачать. Остальные ссылки и записи не удалялись.');
  db.close();
}

main().catch(error => {
  console.error(error);
  db.close();
  process.exit(1);
});
