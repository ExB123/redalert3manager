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
  res.json(db.prepare(`SELECT p.id,p.nickname,p.faction,p.teamId,p.experience,p.wins,p.ratingPoints,p.ratingGames,p.ratingWins,p.ratingLosses,p.rpPoints,p.rpPeak,p.position,p.isTeamCaptain,p.rankId,p.bestMap,p.worstMap,p.matchWins,p.matchLosses,t.name AS teamName,r.name AS rankName,r.imageUrl AS rankImageUrl FROM Player p LEFT JOIN Team t ON t.id=p.teamId LEFT JOIN Rank r ON r.id=p.rankId ORDER BY p.rpPoints DESC, p.ratingPoints DESC, p.nickname ASC`).all());
});
app.get('/api/faction-stats', (_req, res) => {
  res.json(db.prepare(`SELECT faction,COUNT(*) AS players,SUM(COALESCE(matchWins,0)) AS wins,SUM(COALESCE(matchLosses,0)) AS losses,SUM(COALESCE(ratingWins,0)) AS ratingWins,SUM(COALESCE(ratingLosses,0)) AS ratingLosses,ROUND(AVG(COALESCE(rpPoints,0)),1) AS averageRP,MAX(COALESCE(rpPeak,0)) AS peakRP FROM Player WHERE faction IS NOT NULL AND TRIM(faction) <> '' GROUP BY faction ORDER BY players DESC,faction ASC`).all());
});
app.get('/api/tournaments', (_req, res) => {
  res.json(db.prepare(`SELECT tr.id,tr.name,tr.description,tr.imageUrl,tr.type,tr.seasonId,tr.createdAt,tr.seasonNumber,tr.winnerId,tr.winnerName,tm.name AS winnerTeamName,s.name AS seasonName FROM Tournament tr LEFT JOIN Team tm ON tm.id=tr.winnerId LEFT JOIN Season s ON s.id=tr.seasonId ORDER BY tr.createdAt DESC`).all());
});
app.get('/api/matches', (_req, res) => {
  res.json(db.prepare(`SELECT m.id,m.tournamentId,m.homeTeamId,m.awayTeamId,m.homeScore,m.awayScore,m.winnerId,m.nextMatchId,m.round,m.map,m.completed,m.createdAt,t.name AS tournamentName,h.name AS homeTeam,a.name AS awayTeam,w.name AS winnerName,COALESCE(h.name,'?') || ' — ' || COALESCE(a.name,'?') || ' · ' || COALESCE(m.map,'карта не указана') AS matchLabel FROM Match m LEFT JOIN Tournament t ON t.id=m.tournamentId LEFT JOIN Team h ON h.id=m.homeTeamId LEFT JOIN Team a ON a.id=m.awayTeamId LEFT JOIN Team w ON w.id=m.winnerId ORDER BY m.createdAt DESC LIMIT 500`).all());
});
app.post('/api/matches/:id/complete', (req, res) => {
  try {
    const match = db.prepare('SELECT id,tournamentId,homeTeamId,awayTeamId,homeScore,awayScore,winnerId,completed,map,nextMatchId FROM Match WHERE id=?').get(req.params.id);
    if (!match) return res.status(404).json({ error: 'Матч не найден.' });
    if (match.completed) return res.status(409).json({ error: 'Этот матч уже завершён; повторное начисление статистики запрещено.' });
    if (!match.homeTeamId || !match.awayTeamId || match.homeTeamId === match.awayTeamId) return res.status(400).json({ error: 'Укажите две разные команды.' });
    if (match.homeScore === null || match.homeScore === undefined || match.awayScore === null || match.awayScore === undefined) return res.status(400).json({ error: 'Перед завершением укажите счёт обеих команд.' });
    if (![Number(match.homeScore),Number(match.awayScore)].every(score => Number.isInteger(score) && score >= 0)) return res.status(400).json({ error: 'Счёт должен состоять из целых неотрицательных чисел.' });
    if (Number(match.homeScore) === Number(match.awayScore)) return res.status(400).json({ error: 'Ничья не поддерживается: для завершения выберите счёт с победителем.' });
    const home = db.prepare('SELECT id,name FROM Team WHERE id=?').get(match.homeTeamId);
    const away = db.prepare('SELECT id,name FROM Team WHERE id=?').get(match.awayTeamId);
    if (!home || !away) return res.status(400).json({ error: 'Одна из команд не найдена.' });
    const configRow = db.prepare("SELECT value FROM GameConfig WHERE key='match_win'").get();
    let rules;
    try { rules = JSON.parse(configRow?.value || '{}'); } catch { return res.status(500).json({ error: 'Правило match_win в GameConfig содержит некорректный JSON.' }); }
    const teamPoints = Number(rules.teamPoints ?? 0);
    const playerPoints = Number(rules.playerPoints ?? 0);
    const playerMMR = Number(rules.playerMMR ?? 0);
    const playerMMRLoss = Number(rules.playerMMR_Loss ?? 0);
    if (![teamPoints,playerPoints,playerMMR,playerMMRLoss].every(Number.isFinite)) return res.status(500).json({ error: 'Правило match_win содержит некорректные числовые значения.' });
    const homeWon = Number(match.homeScore) > Number(match.awayScore);
    const winner = homeWon ? home : away;
    const loser = homeWon ? away : home;
    const now = new Date().toISOString();
    const result = db.transaction(() => {
      db.prepare('UPDATE Match SET completed=1,winnerId=?,updatedAt=? WHERE id=? AND completed=0').run(winner.id,now,match.id);
      db.prepare('UPDATE Team SET wins=wins+1,points=points+?,updatedAt=? WHERE id=?').run(teamPoints,now,winner.id);
      db.prepare('UPDATE Team SET losses=losses+1,updatedAt=? WHERE id=?').run(now,loser.id);
      const winningPlayers = db.prepare('SELECT id,rpPoints FROM Player WHERE teamId=?').all(winner.id);
      const losingPlayers = db.prepare('SELECT id FROM Player WHERE teamId=?').all(loser.id);
      const updateWinner = db.prepare('UPDATE Player SET matchWins=matchWins+1,ratingPoints=MAX(0,ratingPoints+?),rpPoints=rpPoints+?,rpPeak=MAX(rpPeak,rpPoints+?) WHERE id=?');
      const updateLoser = db.prepare('UPDATE Player SET matchLosses=matchLosses+1,ratingPoints=MAX(0,ratingPoints+?) WHERE id=?');
      for (const player of winningPlayers) updateWinner.run(playerMMR,playerPoints,playerPoints,player.id);
      for (const player of losingPlayers) updateLoser.run(playerMMRLoss,player.id);
      let mapId = null;
      if (match.map) mapId = db.prepare('SELECT id FROM Map WHERE name=? COLLATE NOCASE').get(match.map)?.id || null;
      const updateMapWin = db.prepare('UPDATE MapStat SET wins=wins+1 WHERE id=?');
      const updateMapLoss = db.prepare('UPDATE MapStat SET losses=losses+1 WHERE id=?');
      const insertMapStat = db.prepare('INSERT INTO MapStat (id,mapName,mapId,wins,losses,teamId,playerId,createdAt) VALUES (?,?,?,?,?,?,?,?)');
      const updateStats = (players, won) => {
        if (!match.map) return;
        for (const player of players) {
          const stat = mapId
            ? db.prepare('SELECT id FROM MapStat WHERE mapId=? AND playerId=?').get(mapId,player.id)
            : db.prepare('SELECT id FROM MapStat WHERE mapId IS NULL AND mapName=? AND playerId=?').get(match.map,player.id);
          if (stat) (won ? updateMapWin : updateMapLoss).run(stat.id);
          else insertMapStat.run(crypto.randomUUID().replace(/-/g,''),match.map,mapId,won?1:0,won?0:1,null,player.id,now);
        }
      };
      updateStats(winningPlayers,true);
      updateStats(losingPlayers,false);
      let advanced = false;
      if (match.nextMatchId) {
        const next = db.prepare('SELECT id,homeTeamId,awayTeamId,completed FROM Match WHERE id=?').get(match.nextMatchId);
        if (next && !next.completed) {
          if (!next.homeTeamId) {
            db.prepare('UPDATE Match SET homeTeamId=?,updatedAt=? WHERE id=?').run(winner.id,now,next.id);
            advanced = true;
          } else if (!next.awayTeamId) {
            db.prepare('UPDATE Match SET awayTeamId=?,updatedAt=? WHERE id=?').run(winner.id,now,next.id);
            advanced = true;
          }
        }
      }
      return { winner:winner.name, loser:loser.name, nextMatchAdvanced:advanced, winningPlayers:winningPlayers.length, losingPlayers:losingPlayers.length };
    })();
    res.json({ ok:true, matchId:match.id, ...result });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
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
  res.json(db.prepare(`SELECT ms.id,ms.mapName,ms.mapId,ms.teamId,ms.playerId,ms.wins,ms.losses,ms.createdAt,t.name AS teamName,p.nickname AS playerName,m.name AS map FROM MapStat ms LEFT JOIN Team t ON t.id=ms.teamId LEFT JOIN Player p ON p.id=ms.playerId LEFT JOIN Map m ON m.id=ms.mapId ORDER BY (ms.wins + ms.losses) DESC, ms.mapName ASC LIMIT 1000`).all());
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
  res.json(db.prepare(`SELECT n.id,n.title,n.content,n.createdAt,n.relatedMatchId,n.relatedTournamentId,t.name AS relatedTournamentName,m.map AS relatedMatchMap,m.round AS relatedMatchRound,h.name AS relatedHomeTeam,a.name AS relatedAwayTeam FROM News n LEFT JOIN Tournament t ON t.id=n.relatedTournamentId LEFT JOIN Match m ON m.id=n.relatedMatchId LEFT JOIN Team h ON h.id=m.homeTeamId LEFT JOIN Team a ON a.id=m.awayTeamId ORDER BY n.createdAt DESC`).all());
});
app.get('/api/winner-posts', (_req, res) => {
  res.json(db.prepare(`SELECT wp.id,wp.tournamentId,wp.teamId,wp.title,wp.content,wp.createdAt,t.name AS tournamentName,tm.name AS teamName FROM WinnerPost wp LEFT JOIN Tournament t ON t.id=wp.tournamentId LEFT JOIN Team tm ON tm.id=wp.teamId ORDER BY wp.createdAt DESC`).all());
});
app.get('/api/achievement-showcase', (_req, res) => {
  res.json(db.prepare(`SELECT s.id,s.name,s.description,s.imageUrl,s.createdAt,(SELECT group_concat(a.name, ', ') FROM _AchievementToAchievementShowcase link JOIN Achievement a ON a.id=link.A WHERE link.B=s.id) AS achievementNames FROM AchievementShowcase s ORDER BY s.createdAt DESC`).all());
});
app.get('/api/achievement-showcase/:id/achievements', (req, res) => {
  const showcase = db.prepare('SELECT id FROM AchievementShowcase WHERE id=?').get(req.params.id);
  if (!showcase) return res.status(404).json({ error: 'Витрина не найдена.' });
  res.json(db.prepare(`SELECT a.id,a.name,a.description,a.teamId,a.playerId,a.tournamentId,CASE WHEN link.A IS NULL THEN 0 ELSE 1 END AS selected,t.name AS teamName,p.nickname AS playerName,tr.name AS tournamentName FROM Achievement a LEFT JOIN _AchievementToAchievementShowcase link ON link.A=a.id AND link.B=? LEFT JOIN Team t ON t.id=a.teamId LEFT JOIN Player p ON p.id=a.playerId LEFT JOIN Tournament tr ON tr.id=a.tournamentId ORDER BY a.name COLLATE NOCASE`).all(req.params.id));
});
app.put('/api/achievement-showcase/:id/achievements', (req, res) => {
  const showcase = db.prepare('SELECT id FROM AchievementShowcase WHERE id=?').get(req.params.id);
  if (!showcase) return res.status(404).json({ error: 'Витрина не найдена.' });
  const ids = req.body?.achievementIds;
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return res.status(400).json({ error: 'Передайте список achievementIds.' });
  const uniqueIds = [...new Set(ids)];
  const exists = db.prepare('SELECT id FROM Achievement WHERE id=?');
  for (const id of uniqueIds) if (!exists.get(id)) return res.status(400).json({ error: 'Одно из достижений не найдено.' });
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM _AchievementToAchievementShowcase WHERE B=?').run(req.params.id);
      const add = db.prepare('INSERT INTO _AchievementToAchievementShowcase (A,B) VALUES (?,?)');
      for (const id of uniqueIds) add.run(id, req.params.id);
    })();
    res.json({ ok: true, showcaseId: req.params.id, achievementIds: uniqueIds });
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});
app.get('/api/simulations', (_req, res) => {
  res.json(db.prepare(`SELECT id,createdAt,input,result FROM Simulation ORDER BY createdAt DESC LIMIT 100`).all());
});


const crypto = require('node:crypto');

// Ranked-match mechanics are driven by RatingMatch and GameConfig.match_win from the original SQL schema.
function rankedRules() {
  const row = db.prepare("SELECT value FROM GameConfig WHERE key='match_win'").get();
  let value = {};
  try { value = JSON.parse(row?.value || '{}'); } catch { throw new Error('Правило match_win в GameConfig содержит некорректный JSON.'); }
  const rules = {
    playerPoints: Number(value.playerPoints ?? 5),
    playerMMR: Number(value.playerMMR ?? 50),
    playerMMRLoss: Number(value.playerMMR_Loss ?? -25)
  };
  if (!Object.values(rules).every(Number.isFinite)) throw new Error('Правило match_win содержит некорректные числовые значения.');
  return rules;
}
function rankedMaps() {
  return db.prepare('SELECT name FROM Map WHERE playersCount=2 ORDER BY name').all().map(row => row.name);
}
function allRankedPlayers() {
  return db.prepare(`SELECT id,nickname,COALESCE(ratingPoints,0) AS ratingPoints,
    COALESCE(ratingGames,0) AS ratingGames,COALESCE(ratingWins,0) AS ratingWins,
    COALESCE(ratingLosses,0) AS ratingLosses,COALESCE(rpPoints,0) AS rpPoints,
    COALESCE(rpPeak,0) AS rpPeak FROM Player ORDER BY ratingGames ASC,nickname COLLATE NOCASE ASC`).all();
}
function chooseRankedPair(players, usedPairs = new Set(), busyIds = new Set()) {
  const available = players.filter(player => !busyIds.has(player.id));
  if (available.length < 2) return null;
  const lowestGames = Math.min(...available.map(player => player.ratingGames));
  const initiators = available.filter(player => player.ratingGames <= lowestGames + 3);
  const first = initiators[Math.floor(Math.random() * initiators.length)];
  let opponents = available.filter(player => player.id !== first.id && !usedPairs.has([first.id,player.id].sort().join(':')));
  if (!opponents.length) opponents = available.filter(player => player.id !== first.id);
  opponents.sort((a,b) => Math.abs(a.ratingPoints-first.ratingPoints)-Math.abs(b.ratingPoints-first.ratingPoints) || a.ratingGames-b.ratingGames);
  const best = opponents.slice(0,Math.min(5,opponents.length));
  const second = best[Math.floor(Math.random() * best.length)];
  return { first, second, key:[first.id,second.id].sort().join(':') };
}
function simulateRankedMatch(match, playersById, rules, nowIso, forcedWinnerId = null) {
  const first = playersById.get(match.player1Id) || db.prepare('SELECT id,nickname,ratingPoints,ratingGames,ratingWins,ratingLosses,rpPoints,rpPeak FROM Player WHERE id=?').get(match.player1Id);
  const second = playersById.get(match.player2Id) || db.prepare('SELECT id,nickname,ratingPoints,ratingGames,ratingWins,ratingLosses,rpPoints,rpPeak FROM Player WHERE id=?').get(match.player2Id);
  if (!first || !second || first.id === second.id) throw new Error('У рейтингового матча отсутствуют два разных игрока.');
  const p1 = Number(first.ratingPoints || 0);
  const p2 = Number(second.ratingPoints || 0);
  const chance1 = 1 / (1 + Math.pow(10, (p2-p1)/400));
  const winner = forcedWinnerId ? [first, second].find(player => player.id === forcedWinnerId) : (Math.random() < chance1 ? first : second);
  if (!winner) throw new Error('Победитель должен быть одним из двух участников матча.');
  const loser = winner.id === first.id ? second : first;
  const winMMR = Math.max(0, Number(winner.ratingPoints || 0) + rules.playerMMR);
  const loseMMR = Math.max(0, Number(loser.ratingPoints || 0) + rules.playerMMRLoss);
  const winRP = Math.max(0, Number(winner.rpPoints || 0) + rules.playerPoints);
  db.prepare('UPDATE Player SET ratingGames=COALESCE(ratingGames,0)+1,ratingWins=COALESCE(ratingWins,0)+1,ratingPoints=?,rpPoints=?,rpPeak=MAX(COALESCE(rpPeak,0),?) WHERE id=?')
    .run(winMMR,winRP,winRP,winner.id);
  db.prepare('UPDATE Player SET ratingGames=COALESCE(ratingGames,0)+1,ratingLosses=COALESCE(ratingLosses,0)+1,ratingPoints=? WHERE id=?')
    .run(loseMMR,loser.id);
  db.prepare('UPDATE RatingMatch SET completed=1,winnerId=?,updatedAt=? WHERE id=? AND completed=0')
    .run(winner.id,nowIso,match.id);
  for (const player of [first,second]) {
    const fresh = db.prepare('SELECT id,nickname,COALESCE(ratingPoints,0) AS ratingPoints,COALESCE(ratingGames,0) AS ratingGames,COALESCE(ratingWins,0) AS ratingWins,COALESCE(ratingLosses,0) AS ratingLosses,COALESCE(rpPoints,0) AS rpPoints,COALESCE(rpPeak,0) AS rpPeak FROM Player WHERE id=?').get(player.id);
    playersById.set(player.id,fresh);
  }
  return { matchId:match.id, player1:first.nickname, player2:second.nickname, winner:winner.nickname, map:match.map || null };
}
app.get('/api/settings/main-player', (_req,res) => {
  try {
    const configured = db.prepare("SELECT value FROM GameConfig WHERE key='main_player_id'").get()?.value;
    let player = configured ? db.prepare('SELECT id,nickname FROM Player WHERE id=?').get(configured) : null;
    if (!player) player = db.prepare('SELECT id,nickname FROM Player WHERE nickname=? COLLATE NOCASE').get('GGanz');
    res.json({player:player || null,players:db.prepare('SELECT id,nickname FROM Player ORDER BY nickname COLLATE NOCASE').all()});
  } catch(error) { res.status(500).json({error:error.message}); }
});
app.put('/api/settings/main-player', (req,res) => {
  try {
    const playerId = req.body?.playerId;
    const player = db.prepare('SELECT id,nickname FROM Player WHERE id=?').get(playerId);
    if (!player) return res.status(400).json({error:'Выберите существующего игрока.'});
    const now = new Date().toISOString();
    const current = db.prepare("SELECT id FROM GameConfig WHERE key='main_player_id'").get();
    if (current) db.prepare("UPDATE GameConfig SET value=?,description=?,updatedAt=? WHERE key='main_player_id'").run(player.id,'Основной игрок для поиска рейтингового соперника',now);
    else db.prepare("INSERT INTO GameConfig (id,key,value,description,createdAt,updatedAt) VALUES (?,?,?,?,?,?)").run(crypto.randomUUID().replace(/-/g,''),'main_player_id',player.id,'Основной игрок для поиска рейтингового соперника',now,now);
    res.json({ok:true,player});
  } catch(error) { res.status(400).json({error:error.message || 'Не удалось сохранить игрока.'}); }
});

app.post('/api/rating-matches/find-opponent', (_req,res) => {
  try {
    const result = db.transaction(() => {
      const players = allRankedPlayers();
      const configured = db.prepare("SELECT value FROM GameConfig WHERE key='main_player_id'").get()?.value;
      const mainPlayer = (configured && players.find(p=>p.id===configured)) || players.find(p=>p.nickname.toLowerCase()==='gganz');
      if (!mainPlayer) throw new Error('Игрок GGanz не найден. Добавьте его в список игроков или выберите основного игрока в настройках.');
      const busy = new Set(db.prepare('SELECT player1Id AS id FROM RatingMatch WHERE completed=0 UNION SELECT player2Id AS id FROM RatingMatch WHERE completed=0').all().map(row=>row.id));
      if (busy.has(mainPlayer.id)) throw new Error('У основного игрока уже есть незавершённый рейтинговый матч.');
      const candidates = players.filter(p=>p.id!==mainPlayer.id && !busy.has(p.id));
      if (!candidates.length) throw new Error('Нет свободных соперников для основного игрока.');
      candidates.sort((a,b)=>Math.abs(Number(a.ratingPoints||0)-Number(mainPlayer.ratingPoints||0))-Math.abs(Number(b.ratingPoints||0)-Number(mainPlayer.ratingPoints||0)) || Number(a.ratingGames||0)-Number(b.ratingGames||0));
      const shortlist = candidates.slice(0,Math.min(5,candidates.length));
      const opponent = shortlist[Math.floor(Math.random()*shortlist.length)];
      const pair = {first:mainPlayer,second:opponent};
      const maps = rankedMaps();
      const map = maps.length ? maps[Math.floor(Math.random()*maps.length)] : null;
      const now = new Date();
      const scheduledAt = new Date(now.getTime()+5*60*1000).toISOString();
      const id = crypto.randomUUID().replace(/-/g,'');
      const nowIso = now.toISOString();
      db.prepare('INSERT INTO RatingMatch (id,player1Id,player2Id,scheduledAt,completed,winnerId,createdAt,updatedAt,map) VALUES (?,?,?,?,0,NULL,?,?,?)')
        .run(id,pair.first.id,pair.second.id,scheduledAt,nowIso,nowIso,map);
      return { ok:true, match:{id,player1Id:pair.first.id,player2Id:pair.second.id,player1:pair.first.nickname,player2:pair.second.nickname,scheduledAt,completed:0,map}, message:'Соперник найден. Матч добавлен в расписание.' };
    })();
    res.status(201).json(result);
  } catch(error) { res.status(400).json({error:error.message || 'Не удалось подобрать соперника.'}); }
});
app.post('/api/rating-matches/:id/complete', (req,res) => {
  try {
    const winnerId = req.body?.winnerId;
    if (typeof winnerId !== 'string' || !winnerId) return res.status(400).json({error:'Укажите победителя матча.'});
    const result = db.transaction(() => {
      const match = db.prepare('SELECT id,player1Id,player2Id,scheduledAt,map,completed FROM RatingMatch WHERE id=?').get(req.params.id);
      if (!match) throw new Error('Рейтинговый матч не найден.');
      if (match.completed) throw new Error('Этот матч уже завершён; повторное начисление рейтинга запрещено.');
      if (winnerId !== match.player1Id && winnerId !== match.player2Id) throw new Error('Победитель должен быть одним из участников матча.');
      const rules = rankedRules();
      const playersById = new Map(allRankedPlayers().map(player=>[player.id,player]));
      const played = simulateRankedMatch(match,playersById,rules,new Date().toISOString(),winnerId);
      db.prepare('INSERT INTO Simulation (id,createdAt,input,result) VALUES (?,?,?,?)')
        .run(crypto.randomUUID().replace(/-/g,''),new Date().toISOString(),JSON.stringify({type:'rating-manual',matchId:match.id,winnerId}),JSON.stringify(played));
      return {ok:true,...played};
    })();
    res.json(result);
  } catch(error) { res.status(400).json({error:error.message || 'Не удалось завершить рейтинговый матч.'}); }
});

app.post('/api/rating-matches/simulate-20', (_req,res) => {
  try {
    const result = db.transaction(() => {
      const rules = rankedRules();
      const maps = rankedMaps();
      const allPlayers = allRankedPlayers();
      const configuredMainId = db.prepare("SELECT value FROM GameConfig WHERE key='main_player_id'").get()?.value;
      const mainPlayer = (configuredMainId && allPlayers.find(player=>player.id===configuredMainId))
        || allPlayers.find(player=>String(player.nickname||'').toLowerCase()==='gganz');
      // Bulk run intentionally excludes the configured main player (GGanz by default).
      const playersById = new Map(allPlayers.filter(player=>!mainPlayer || player.id!==mainPlayer.id).map(player=>[player.id,player]));
      if (playersById.size < 2) throw new Error('Для симуляции нужны минимум два игрока помимо основного игрока.');
      const created = [];
      const usedPairs = new Set();
      for (let i=0;i<20;i++) {
        const players = [...playersById.values()].sort((a,b)=>a.ratingGames-b.ratingGames);
        const pair = chooseRankedPair(players,usedPairs);
        if (!pair) throw new Error('Не удалось подобрать игроков для всех 20 матчей.');
        usedPairs.add(pair.key);
        const now = new Date(Date.now()+i);
        const nowIso = now.toISOString();
        const map = maps.length ? maps[Math.floor(Math.random()*maps.length)] : null;
        const id = crypto.randomUUID().replace(/-/g,'');
        db.prepare('INSERT INTO RatingMatch (id,player1Id,player2Id,scheduledAt,completed,winnerId,createdAt,updatedAt,map) VALUES (?,?,?,?,0,NULL,?,?,?)')
          .run(id,pair.first.id,pair.second.id,nowIso,nowIso,nowIso,map);
        const played = simulateRankedMatch({id,player1Id:pair.first.id,player2Id:pair.second.id,map},playersById,rules,nowIso);
        created.push(played);
      }
      db.prepare('INSERT INTO Simulation (id,createdAt,input,result) VALUES (?,?,?,?)')
        .run(crypto.randomUUID().replace(/-/g,''),new Date().toISOString(),JSON.stringify({type:'rating-batch',count:20,excludedMainPlayer:mainPlayer?.nickname || null}),JSON.stringify({count:created.length,matches:created}));
      return {ok:true,count:created.length,matches:created};
    })();
    res.json(result);
  } catch(error) { res.status(400).json({error:error.message || 'Не удалось провести 20 рейтинговых матчей.'}); }
});
app.post('/api/rating-matches/simulate-upcoming', (_req,res) => {
  try {
    const result = db.transaction(() => {
      const rules = rankedRules();
      const pending = db.prepare('SELECT id,player1Id,player2Id,scheduledAt,map FROM RatingMatch WHERE completed=0 ORDER BY scheduledAt ASC,createdAt ASC LIMIT 20').all();
      if (!pending.length) return {ok:true,count:0,matches:[],message:'Нет незавершённых рейтинговых матчей для симуляции.'};
      const playersById = new Map(allRankedPlayers().map(player=>[player.id,player]));
      const played = pending.map(match=>simulateRankedMatch(match,playersById,rules,new Date().toISOString()));
      db.prepare('INSERT INTO Simulation (id,createdAt,input,result) VALUES (?,?,?,?)')
        .run(crypto.randomUUID().replace(/-/g,''),new Date().toISOString(),JSON.stringify({type:'rating-upcoming',count:pending.length}),JSON.stringify({count:played.length,matches:played}));
      return {ok:true,count:played.length,matches:played,message:'Ближайшие незавершённые матчи симулированы.'};
    })();
    res.json(result);
  } catch(error) { res.status(400).json({error:error.message || 'Не удалось симулировать ближайшие матчи.'}); }
});

app.post('/api/simulations/run', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { team1Id, team2Id } = body;
    if (!team1Id || !team2Id) return res.status(400).json({ error: 'Выберите обе команды.' });
    if (team1Id === team2Id) return res.status(400).json({ error: 'Нужно выбрать две разные команды.' });
    const prob1 = Number(body.prob1);
    const prob2 = Number(body.prob2);
    if (!Number.isFinite(prob1) || !Number.isFinite(prob2) || prob1 < 0 || prob2 < 0 || prob1 > 100 || prob2 > 100 || prob1 + prob2 <= 0) {
      return res.status(400).json({ error: 'Вероятности должны быть числами от 0 и выше, а их сумма должна быть больше нуля.' });
    }
    const team1 = db.prepare('SELECT id,name FROM Team WHERE id=?').get(team1Id);
    const team2 = db.prepare('SELECT id,name FROM Team WHERE id=?').get(team2Id);
    if (!team1 || !team2) return res.status(400).json({ error: 'Одна из выбранных команд не найдена.' });
    const tournament = body.tournamentId ? db.prepare('SELECT id,name FROM Tournament WHERE id=?').get(body.tournamentId) : null;
    if (body.tournamentId && !tournament) return res.status(400).json({ error: 'Выбранный турнир не найден.' });
    const players1 = db.prepare('SELECT nickname FROM Player WHERE teamId=? ORDER BY nickname').all(team1Id).map(x => x.nickname);
    const players2 = db.prepare('SELECT nickname FROM Player WHERE teamId=? ORDER BY nickname').all(team2Id).map(x => x.nickname);
    const winner = Math.random() < prob1 / (prob1 + prob2) ? team1.name : team2.name;
    const input = { tournamentId: tournament?.id || null, tournamentName: tournament?.name || null, team1: team1.name, team2: team2.name, prob1, prob2, map: String(body.map || '') };
    const result = { winner, prob1, prob2, map: String(body.map || ''), teams: [team1.name, team2.name], players1, players2, tournamentId: tournament?.id || null, tournamentName: tournament?.name || null };
    const id = crypto.randomUUID().replace(/-/g, '');
    db.prepare('INSERT INTO Simulation (id,input,result) VALUES (?,?,?)').run(id, JSON.stringify(input), JSON.stringify(result));
    res.status(201).json({ id, createdAt: new Date().toISOString(), input, result });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Explicit allowlist prevents arbitrary table/column access through API requests.
const editableEntities = {
  teams: { table: 'Team', fields: ['name','logoUrl','wins','losses','points','level','bestMap','worstMap'], required: ['name'] },
  players: { table: 'Player', fields: ['nickname','faction','teamId','experience','wins','ratingPoints','ratingGames','ratingWins','ratingLosses','rpPoints','rpPeak','isTeamCaptain','position','bestMap','worstMap','rankId','matchWins','matchLosses'], required: ['nickname','faction','teamId'] },
  tournaments: { table: 'Tournament', fields: ['name','description','imageUrl','type','seasonId','seasonNumber','winnerId','winnerName'], required: ['name'] },
  matches: { table: 'Match', fields: ['tournamentId','homeTeamId','awayTeamId','homeScore','awayScore','round','map','nextMatchId','simulationLog'], required: ['tournamentId'] },
  'rating-matches': { table: 'RatingMatch', fields: ['player1Id','player2Id','scheduledAt','completed','winnerId','map'], required: ['player1Id','player2Id','scheduledAt'] },
  seasons: { table: 'Season', fields: ['name','startDate','endDate','isActive'], required: ['name'] },
  maps: { table: 'Map', fields: ['name','imageUrl','description','playersCount'], required: ['name'] },
  'map-stats': { table: 'MapStat', fields: ['mapName','mapId','teamId','playerId','wins','losses'], required: ['mapName'] },
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
    if (entity.table === 'Match' && db.prepare('SELECT completed FROM Match WHERE id=?').get(req.params.id)?.completed) return res.status(409).json({ error: 'Завершённый матч зафиксирован. Для изменения результата нужен отдельный откат статистики.' });
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
    if (entity.table === 'Match' && db.prepare('SELECT completed FROM Match WHERE id=?').get(req.params.id)?.completed) return res.status(409).json({ error: 'Завершённый матч нельзя удалить, потому что его результат уже учтён в статистике.' });
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
