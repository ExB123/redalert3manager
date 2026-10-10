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
app.get('/api/simulations', (_req, res) => {
  res.json(db.prepare(`SELECT id,createdAt,input,result FROM Simulation ORDER BY createdAt DESC LIMIT 100`).all());
});

// The original database has no bets table; do not invent betting records or logic.

const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.listen(PORT, () => console.log(`RA3 Manager API running at http://localhost:${PORT}`));
