const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ra3-manager.sqlite');
if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
const db = new Database(dbPath, { fileMustExist: true });
db.pragma('foreign_keys = ON');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Red Alert Tournament Manager API', database: path.basename(dbPath) }));
app.get('/api/summary', (_req, res) => res.json({
  teams: count('Team'), players: count('Player'), matches: count('Match'),
  ratingMatches: count('RatingMatch'), tournaments: count('Tournament'),
  seasons: count('Season'), leagues: count('RatingLeague')
}));

app.get('/api/teams', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,logoUrl,wins,losses,points,level,bestMap,worstMap FROM Team ORDER BY points DESC, wins DESC, name ASC`).all());
});
app.get('/api/players', (_req, res) => {
  res.json(db.prepare(`SELECT p.id,p.nickname,p.faction,p.teamId,p.experience,p.wins,p.ratingPoints,p.ratingGames,p.ratingWins,p.ratingLosses,p.rpPoints,p.rpPeak,p.position,p.bestMap,p.worstMap,p.matchWins,p.matchLosses,t.name AS teamName,r.name AS rankName,r.imageUrl AS rankImageUrl FROM Player p LEFT JOIN Team t ON t.id=p.teamId LEFT JOIN Rank r ON r.id=p.rankId ORDER BY p.rpPoints DESC, p.ratingPoints DESC, p.nickname ASC`).all());
});
app.get('/api/tournaments', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,description,imageUrl,type,seasonId,createdAt,seasonNumber,winnerId,winnerName FROM Tournament ORDER BY createdAt DESC`).all());
});
app.get('/api/matches', (_req, res) => {
  res.json(db.prepare(`SELECT m.id,m.tournamentId,m.homeTeamId,m.awayTeamId,m.homeScore,m.awayScore,m.winnerId,m.round,m.map,m.completed,m.createdAt,t.name AS tournamentName,h.name AS homeTeam,a.name AS awayTeam FROM Match m LEFT JOIN Tournament t ON t.id=m.tournamentId LEFT JOIN Team h ON h.id=m.homeTeamId LEFT JOIN Team a ON a.id=m.awayTeamId ORDER BY m.createdAt DESC LIMIT 500`).all());
});
app.get('/api/rating-matches', (_req, res) => {
  res.json(db.prepare(`SELECT rm.id,rm.player1Id,rm.player2Id,rm.scheduledAt,rm.completed,rm.winnerId,rm.createdAt,rm.map,p1.nickname AS player1,p2.nickname AS player2,pw.nickname AS winner FROM RatingMatch rm LEFT JOIN Player p1 ON p1.id=rm.player1Id LEFT JOIN Player p2 ON p2.id=rm.player2Id LEFT JOIN Player pw ON pw.id=rm.winnerId ORDER BY rm.scheduledAt DESC LIMIT 500`).all());
});
app.get('/api/leagues', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,description,imageUrl,requiredPoints,orderIndex,createdAt,updatedAt FROM RatingLeague ORDER BY orderIndex ASC`).all());
});
app.get('/api/seasons', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,startDate,endDate,isActive,createdAt FROM Season ORDER BY startDate DESC`).all());
});
app.get('/api/maps', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,imageUrl,description,playersCount,createdAt,updatedAt FROM Map ORDER BY name ASC`).all());
});
app.get('/api/map-stats', (_req, res) => {
  res.json(db.prepare(`SELECT ms.id,ms.mapName,ms.wins,ms.losses,ms.createdAt,t.name AS teamName,p.nickname AS playerName,m.name AS map FROM MapStat ms LEFT JOIN Team t ON t.id=ms.teamId LEFT JOIN Player p ON p.id=ms.playerId LEFT JOIN Map m ON m.id=ms.mapId ORDER BY (ms.wins + ms.losses) DESC, ms.mapName ASC LIMIT 1000`).all());
});
app.get('/api/config', (_req, res) => {
  res.json(db.prepare(`SELECT id,key,value,description,createdAt FROM GameConfig ORDER BY key ASC`).all());
});
app.get('/api/ranks', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,description,imageUrl,requiredWins,requiredXP,createdAt FROM Rank ORDER BY requiredXP ASC, requiredWins ASC`).all());
});
app.get('/api/achievements', (_req, res) => {
  res.json(db.prepare(`SELECT a.id,a.name,a.description,a.imageUrl,a.teamId,a.playerId,a.tournamentId,a.createdAt,a.conditionType,a.requiredTournamentType,t.name AS teamName,p.nickname AS playerName,tr.name AS tournamentName FROM Achievement a LEFT JOIN Team t ON t.id=a.teamId LEFT JOIN Player p ON p.id=a.playerId LEFT JOIN Tournament tr ON tr.id=a.tournamentId ORDER BY a.createdAt DESC`).all());
});
app.get('/api/medals', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,description,imageUrl,createdAt FROM Medal ORDER BY name ASC`).all());
});
app.get('/api/news', (_req, res) => {
  res.json(db.prepare(`SELECT id,title,content,createdAt,relatedMatchId,relatedTournamentId FROM News ORDER BY createdAt DESC`).all());
});
app.get('/api/winner-posts', (_req, res) => {
  res.json(db.prepare(`SELECT wp.id,wp.tournamentId,wp.teamId,wp.title,wp.content,wp.createdAt,t.name AS tournamentName,tm.name AS teamName FROM WinnerPost wp LEFT JOIN Tournament t ON t.id=wp.tournamentId LEFT JOIN Team tm ON tm.id=wp.teamId ORDER BY wp.createdAt DESC`).all());
});
app.get('/api/achievement-showcase', (_req, res) => {
  res.json(db.prepare(`SELECT id,name,description,imageUrl,createdAt FROM AchievementShowcase ORDER BY createdAt DESC`).all());
});
app.get('/api/simulations', (_req, res) => {
  res.json(db.prepare(`SELECT id,createdAt,input,result FROM Simulation ORDER BY createdAt DESC LIMIT 100`).all());
});


const crypto = require('node:crypto');

// Explicit allowlist prevents arbitrary table/column access through API requests.
const editableEntities = {
  teams: { table: 'Team', fields: ['name','logoUrl','wins','losses','points','level','bestMap','worstMap'], required: ['name'] },
  players: { table: 'Player', fields: ['nickname','faction','teamId','experience','wins','ratingPoints','ratingGames','ratingWins','ratingLosses','rpPoints','rpPeak','isTeamCaptain','position','bestMap','worstMap','rankId','matchWins','matchLosses'], required: ['nickname','faction','teamId'] },
  tournaments: { table: 'Tournament', fields: ['name','description','imageUrl','type','seasonId','seasonNumber','winnerId','winnerName'], required: ['name'] },
  matches: { table: 'Match', fields: ['tournamentId','homeTeamId','awayTeamId','homeScore','awayScore','winnerId','round','map','completed','nextMatchId','simulationLog'], required: ['tournamentId'] },
  'rating-matches': { table: 'RatingMatch', fields: ['player1Id','player2Id','scheduledAt','completed','winnerId','map'], required: ['player1Id','player2Id','scheduledAt'] },
  seasons: { table: 'Season', fields: ['name','startDate','endDate','isActive'], required: ['name'] },
  maps: { table: 'Map', fields: ['name','imageUrl','description','playersCount'], required: ['name'] },
  ranks: { table: 'Rank', fields: ['name','description','imageUrl','requiredWins','requiredXP'], required: ['name'] },
  leagues: { table: 'RatingLeague', fields: ['name','description','imageUrl','requiredPoints','orderIndex'], required: ['name'] },
  config: { table: 'GameConfig', fields: ['key','value','description'], required: ['key','value'] },
  news: { table: 'News', fields: ['title','content','relatedMatchId','relatedTournamentId'], required: ['title','content'] },
  medals: { table: 'Medal', fields: ['name','description','imageUrl'], required: ['name'] },
  achievements: { table: 'Achievement', fields: ['name','description','imageUrl','teamId','playerId','tournamentId','conditionType','requiredTournamentType'], required: ['name'] },
  'winner-posts': { table: 'WinnerPost', fields: ['tournamentId','teamId','title','content'], required: ['tournamentId','teamId','title','content'] },
  'achievement-showcase': { table: 'AchievementShowcase', fields: ['name','description','imageUrl'], required: ['name'] }
};
const columnCache = new Map();
function tableColumns(table) {
  if (!columnCache.has(table)) columnCache.set(table, new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(x => x.name)));
  return columnCache.get(table);
}
function normalizeField(field, value) {
  if (value === '' && !['name','nickname','faction','title','content','key','value','type','scheduledAt'].includes(field)) return null;
  if (['wins','losses','points','level','experience','ratingPoints','ratingGames','ratingWins','ratingLosses','rpPoints','rpPeak','matchWins','matchLosses','homeScore','awayScore','round','playersCount','requiredWins','requiredXP','requiredPoints','orderIndex'].includes(field)) {
    if (value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Поле "' + field + '" должно быть числом.');
    return Math.trunc(number);
  }
  if (['isTeamCaptain','completed','isActive'].includes(field)) return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
  if (value === undefined) return undefined;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}
function getEntityConfig(req, res) {
  const entity = editableEntities[req.params.entity];
  if (!entity) { res.status(404).json({ error: 'Этот тип записей не поддерживается.' }); return null; }
  return entity;
}
function safeErrorMessage(error) {
  if (String(error.message).includes('UNIQUE constraint failed')) return 'Такая запись уже существует. Проверьте уникальные поля.';
  if (String(error.message).includes('FOREIGN KEY constraint failed')) return 'Нельзя сохранить запись: одна из связанных записей не существует или используется другими данными.';
  if (String(error.message).includes('NOT NULL constraint failed')) return 'Не заполнено обязательное поле.';
  return error.message || 'Неизвестная ошибка базы данных.';
}
app.post('/api/manage/:entity', (req, res) => {
  const entity = getEntityConfig(req, res);
  if (!entity) return;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    for (const field of entity.required) {
      if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
        return res.status(400).json({ error: 'Заполните обязательное поле: ' + field });
      }
    }
    const fields = entity.fields.filter(field => body[field] !== undefined);
    if (!fields.length) return res.status(400).json({ error: 'Нет данных для сохранения.' });
    const row = {};
    for (const field of fields) row[field] = normalizeField(field, body[field]);
    const columns = tableColumns(entity.table);
    if (columns.has('updatedAt')) row.updatedAt = new Date().toISOString();
    row.id = crypto.randomUUID().replace(/-/g, '');
    const keys = Object.keys(row).filter(key => row[key] !== undefined);
    const sql = `INSERT INTO "${entity.table}" (${keys.map(key => '"' + key + '"').join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    db.prepare(sql).run(...keys.map(key => row[key]));
    const saved = db.prepare(`SELECT * FROM "${entity.table}" WHERE id = ?`).get(row.id);
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});
app.put('/api/manage/:entity/:id', (req, res) => {
  const entity = getEntityConfig(req, res);
  if (!entity) return;
  try {
    const exists = db.prepare(`SELECT id FROM "${entity.table}" WHERE id = ?`).get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Запись не найдена.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const fields = entity.fields.filter(field => body[field] !== undefined);
    if (!fields.length) return res.status(400).json({ error: 'Нет полей для обновления.' });
    for (const field of entity.required) {
      if (body[field] !== undefined && (body[field] === null || String(body[field]).trim() === '')) {
        return res.status(400).json({ error: 'Поле обязательно: ' + field });
      }
    }
    const row = {};
    for (const field of fields) row[field] = normalizeField(field, body[field]);
    if (tableColumns(entity.table).has('updatedAt')) row.updatedAt = new Date().toISOString();
    const keys = Object.keys(row).filter(key => row[key] !== undefined);
    db.prepare(`UPDATE "${entity.table}" SET ${keys.map(key => '"' + key + '" = ?').join(',')} WHERE id = ?`).run(...keys.map(key => row[key]), req.params.id);
    res.json(db.prepare(`SELECT * FROM "${entity.table}" WHERE id = ?`).get(req.params.id));
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});
app.delete('/api/manage/:entity/:id', (req, res) => {
  const entity = getEntityConfig(req, res);
  if (!entity) return;
  try {
    const result = db.prepare(`DELETE FROM "${entity.table}" WHERE id = ?`).run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Запись не найдена.' });
    res.json({ ok: true, deletedId: req.params.id });
  } catch (error) {
    res.status(409).json({ error: safeErrorMessage(error) });
  }
});

// The original database has no bets table; do not invent betting records or logic.

const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.listen(PORT, () => console.log(`RA3 Manager API running at http://localhost:${PORT}`));
