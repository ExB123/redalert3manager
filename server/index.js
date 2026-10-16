const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('node:crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ra3-manager.sqlite');
if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
const db = new Database(dbPath, { fileMustExist: true });
db.pragma('foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS PlayerFinance (
  playerId TEXT PRIMARY KEY REFERENCES Player(id) ON DELETE CASCADE ON UPDATE CASCADE,
  marketValueUSD INTEGER,
  forecastUSD INTEGER,
  updatedAt TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS TeamFinance (
  teamId TEXT PRIMARY KEY REFERENCES Team(id) ON DELETE CASCADE ON UPDATE CASCADE,
  marketValueUSD INTEGER,
  forecastUSD INTEGER,
  updatedAt TEXT NOT NULL
)`);
const defaultCurrencyRules = [
  ['currency_player_win_reward','2000','Доход игрока за победу в рейтинговом матче, USD'],
  ['currency_captain_win_bonus','1000','Доплата капитану за победу в рейтинговом матче, USD'],
  ['currency_team_win_reward','15000','Доход команды за победу в матче, USD'],
  ['currency_player_prize_champions_league','198333.3333333333','Доход игрока за победу команды в Champions League, USD'],
  ['currency_player_prize_grand_league','187500','Доход игрока за победу команды в Grand League, USD'],
  ['currency_team_prize_champions_league','2500000','Доход команды за победу в Champions League, USD'],
  ['currency_team_prize_grand_league','1650000','Доход команды за победу в Grand League, USD'],
  ['currency_team_prize_astra_league','1600000','Доход команды за победу в Astra League, USD'],
  ['currency_team_share_percent','20','Доля команды от суммарного дохода игроков, проценты'],
  ['currency_player_prize_astra_league','0','Доход игрока за победу команды в Astra League, USD (не подтверждён исходными правилами)'],
  ['currency_player_prize_ultimate_league','0','Доход игрока за победу команды в Ultimate League, USD (не подтверждён исходными правилами)'],
  ['currency_player_prize_ffa_league','0','Доход игрока за победу команды в FFA League, USD (не подтверждён исходными правилами)'],
  ['currency_player_prize_outsiders_league','0','Доход игрока за победу команды в Outsiders League, USD (не подтверждён исходными правилами)'],
  ['currency_team_prize_ultimate_league','0','Доход команды за победу в Ultimate League, USD (не подтверждён исходными правилами)'],
  ['currency_team_prize_ffa_league','0','Доход команды за победу в FFA League, USD (не подтверждён исходными правилами)'],
  ['currency_team_prize_outsiders_league','0','Доход команды за победу в Outsiders League, USD (не подтверждён исходными правилами)']
];
const insertCurrencyRule = db.prepare('INSERT OR IGNORE INTO GameConfig (id,key,value,description,createdAt) VALUES (?,?,?,?,?)');
for (const [key,value,description] of defaultCurrencyRules) {
  insertCurrencyRule.run(crypto.randomUUID().replace(/-/g,''),key,value,description,new Date().toISOString());
}
db.prepare("UPDATE GameConfig SET value='198333.3333333333' WHERE key='currency_player_prize_champions_league' AND value='198333'").run();
const pdfPlayerValuations = [
  ['GGanz',6730000,8750000],['mONESY',4680000,5900000],['Magister.Yoda',4440000,4710000],
  ['MATUBA',4680000,6270000],['KuroKy',4950000,5640000],['MinD_ContRoL',4360000,4540000]
];
const seedPlayerValuation = db.prepare("INSERT OR IGNORE INTO PlayerFinance (playerId,marketValueUSD,forecastUSD,updatedAt) SELECT id,?,?,? FROM Player WHERE nickname=? COLLATE NOCASE");
for (const [nickname,marketValueUSD,forecastUSD] of pdfPlayerValuations) {
  seedPlayerValuation.run(marketValueUSD,forecastUSD,new Date().toISOString(),nickname);
}
const pdfTeamValuations = [
  ['DS Esports',19050000,20570000],['Astralis',15120000,21170000],['Fnatic',10980000,11850000],
  ['T1 Clan',9300000,8560000],['NexGen',8580000,12020000],['ENCE',7390000,6800000],['Vitality',7150000,6570000]
];
const seedTeamValuation = db.prepare("INSERT OR IGNORE INTO TeamFinance (teamId,marketValueUSD,forecastUSD,updatedAt) SELECT id,?,?,? FROM Team WHERE name=? COLLATE NOCASE");
for (const [name,marketValueUSD,forecastUSD] of pdfTeamValuations) {
  seedTeamValuation.run(marketValueUSD,forecastUSD,new Date().toISOString(),name);
}

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
  res.json(db.prepare(`SELECT t.id,t.name,t.logoUrl,t.wins,t.losses,t.points,t.level,
    COALESCE(t.bestMap,(SELECT COALESCE(m.name,ms.mapName) FROM MapStat ms LEFT JOIN Map m ON m.id=ms.mapId JOIN Player mp ON mp.id=ms.playerId WHERE mp.teamId=t.id AND (ms.wins+ms.losses)>0 GROUP BY COALESCE(m.name,ms.mapName) ORDER BY SUM(ms.wins) DESC,SUM(ms.losses) ASC,COALESCE(m.name,ms.mapName) ASC LIMIT 1)) AS bestMap,
    COALESCE(t.worstMap,(SELECT COALESCE(m.name,ms.mapName) FROM MapStat ms LEFT JOIN Map m ON m.id=ms.mapId JOIN Player mp ON mp.id=ms.playerId WHERE mp.teamId=t.id AND (ms.wins+ms.losses)>0 GROUP BY COALESCE(m.name,ms.mapName) ORDER BY SUM(ms.losses) DESC,SUM(ms.wins) ASC,COALESCE(m.name,ms.mapName) ASC LIMIT 1)) AS worstMap
    FROM Team t ORDER BY t.points DESC, t.wins DESC, t.name ASC`).all());
});
app.get('/api/players', (_req, res) => {
  res.json(db.prepare(`SELECT p.id,p.nickname,p.faction,p.teamId,p.experience,p.wins,p.ratingPoints,p.ratingGames,p.ratingWins,p.ratingLosses,p.rpPoints,p.rpPeak,p.position,p.isTeamCaptain,p.rankId,
    COALESCE(p.bestMap,(SELECT COALESCE(m.name,ms.mapName) FROM MapStat ms LEFT JOIN Map m ON m.id=ms.mapId WHERE ms.playerId=p.id AND (ms.wins+ms.losses)>0 ORDER BY ms.wins DESC,ms.losses ASC,COALESCE(m.name,ms.mapName) ASC LIMIT 1)) AS bestMap,
    COALESCE(p.worstMap,(SELECT COALESCE(m.name,ms.mapName) FROM MapStat ms LEFT JOIN Map m ON m.id=ms.mapId WHERE ms.playerId=p.id AND (ms.wins+ms.losses)>0 ORDER BY ms.losses DESC,ms.wins ASC,COALESCE(m.name,ms.mapName) ASC LIMIT 1)) AS worstMap,
    p.matchWins,p.matchLosses,t.name AS teamName,r.name AS rankName,r.imageUrl AS rankImageUrl
    FROM Player p LEFT JOIN Team t ON t.id=p.teamId LEFT JOIN Rank r ON r.id=p.rankId
    ORDER BY p.rpPoints DESC, p.ratingPoints DESC, p.nickname ASC`).all());
});
app.get('/api/faction-stats', (_req, res) => {
  res.json(db.prepare(`WITH player_summary AS (
      SELECT faction,COUNT(*) AS players,ROUND(AVG(COALESCE(rpPoints,0)),1) AS averageRP,MAX(COALESCE(rpPeak,0)) AS peakRP
      FROM Player WHERE faction IS NOT NULL AND TRIM(faction)<>'' GROUP BY faction
    ), winner_summary AS (
      SELECT p.faction,COUNT(*) AS wins FROM RatingMatch rm JOIN Player p ON p.id=rm.winnerId
      WHERE rm.completed=1 AND p.faction IS NOT NULL AND TRIM(p.faction)<>'' GROUP BY p.faction
    ), loser_summary AS (
      SELECT p.faction,COUNT(*) AS losses
      FROM RatingMatch rm
      JOIN Player p ON p.id=CASE WHEN rm.winnerId=rm.player1Id THEN rm.player2Id ELSE rm.player1Id END
      WHERE rm.completed=1 AND rm.winnerId IN (rm.player1Id,rm.player2Id)
        AND p.faction IS NOT NULL AND TRIM(p.faction)<>''
      GROUP BY p.faction
    )
    SELECT ps.faction,ps.players,COALESCE(ws.wins,0) AS wins,COALESCE(ls.losses,0) AS losses,
      COALESCE(ws.wins,0) AS ratingWins,COALESCE(ls.losses,0) AS ratingLosses,ps.averageRP,ps.peakRP
    FROM player_summary ps LEFT JOIN winner_summary ws ON ws.faction=ps.faction
    LEFT JOIN loser_summary ls ON ls.faction=ps.faction
    ORDER BY ps.players DESC,ps.faction ASC`).all());
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
  res.json(db.prepare(`SELECT rm.id,rm.player1Id,rm.player2Id,rm.scheduledAt,rm.completed,rm.winnerId,rm.createdAt,rm.map,
    p1.nickname AS player1,p1.faction AS player1Faction,p1.rpPoints AS player1RP,p1.ratingPoints AS player1MMR,
    t1.name AS player1Team,r1.name AS player1Rank,r1.imageUrl AS player1RankImageUrl,
    p2.nickname AS player2,p2.faction AS player2Faction,p2.rpPoints AS player2RP,p2.ratingPoints AS player2MMR,
    t2.name AS player2Team,r2.name AS player2Rank,r2.imageUrl AS player2RankImageUrl,pw.nickname AS winner
    FROM RatingMatch rm
    LEFT JOIN Player p1 ON p1.id=rm.player1Id LEFT JOIN Team t1 ON t1.id=p1.teamId LEFT JOIN Rank r1 ON r1.id=p1.rankId
    LEFT JOIN Player p2 ON p2.id=rm.player2Id LEFT JOIN Team t2 ON t2.id=p2.teamId LEFT JOIN Rank r2 ON r2.id=p2.rankId
    LEFT JOIN Player pw ON pw.id=rm.winnerId ORDER BY rm.scheduledAt DESC,rm.createdAt DESC`).all());
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
  res.json(db.prepare(`SELECT ms.id,ms.mapName,ms.mapId,ms.teamId,ms.playerId,ms.wins,ms.losses,ms.createdAt,COALESCE(t.name,pt.name) AS teamName,p.nickname AS playerName,m.name AS map FROM MapStat ms LEFT JOIN Team t ON t.id=ms.teamId LEFT JOIN Player p ON p.id=ms.playerId LEFT JOIN Team pt ON pt.id=p.teamId LEFT JOIN Map m ON m.id=ms.mapId ORDER BY (ms.wins + ms.losses) DESC, ms.mapName ASC`).all());
});
const currencyTypeSlug = value => String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
function currencyRuleNumber(key, fallback = 0) {
  const row = db.prepare('SELECT value FROM GameConfig WHERE key=?').get(key);
  if (!row) return fallback;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : fallback;
}
function currencyEffectiveTournamentType(tournament) {
  const name=String(tournament?.name||'').toLowerCase();
  const known=['Champions League','Grand League','Astra League','Ultimate League','FFA League','Outsiders League'];
  const fromName=known.find(type=>name.startsWith(type.toLowerCase()));
  return fromName||tournament?.type||'';
}
function currencyTournamentPrize(type, audience) {
  return currencyRuleNumber('currency_'+audience+'_prize_'+currencyTypeSlug(type),0);
}
app.get('/api/currency', (_req,res) => {
  try {
    const players = db.prepare(`SELECT p.id,p.nickname,p.faction,p.teamId,p.isTeamCaptain,p.ratingGames,p.ratingWins,p.ratingLosses,p.rpPoints,p.ratingPoints,t.name AS teamName
      FROM Player p LEFT JOIN Team t ON t.id=p.teamId ORDER BY p.rpPoints DESC,p.nickname ASC`).all();
    const teams = db.prepare('SELECT id,name,wins,losses,points,level,bestMap,worstMap FROM Team ORDER BY points DESC,wins DESC,name ASC').all();
    const tournaments = db.prepare('SELECT id,name,type,winnerId,winnerName FROM Tournament').all();
    const finance = new Map(db.prepare('SELECT playerId,marketValueUSD,forecastUSD FROM PlayerFinance').all().map(row=>[row.playerId,row]));
    const teamFinance = new Map(db.prepare('SELECT teamId,marketValueUSD,forecastUSD FROM TeamFinance').all().map(row=>[row.teamId,row]));
    const playerWinReward = currencyRuleNumber('currency_player_win_reward',2000);
    const captainBonus = currencyRuleNumber('currency_captain_win_bonus',1000);
    const teamWinReward = currencyRuleNumber('currency_team_win_reward',15000);
    const teamSharePercent = currencyRuleNumber('currency_team_share_percent',20);
    const playerRows = players.map(player => {
      const ratingWins = Number(player.ratingWins||0), ratingLosses = Number(player.ratingLosses||0);
      const matchIncome = ratingWins*(playerWinReward+(player.isTeamCaptain?captainBonus:0));
      const titles = tournaments.filter(tournament => (player.teamId && tournament.winnerId===player.teamId) || (!tournament.winnerId && player.teamName && tournament.winnerName===player.teamName));
      const tournamentIncome = titles.reduce((sum,tournament)=>sum+currencyTournamentPrize(currencyEffectiveTournamentType(tournament),'player'),0);
      const market = finance.get(player.id);
      return {...player,ratingGames:ratingWins+ratingLosses,matchIncome,tournamentIncome,totalIncome:matchIncome+tournamentIncome,
        marketValueUSD:market?.marketValueUSD??null,forecastUSD:market?.forecastUSD??null,
        tournamentTitles:titles.map(tournament=>({id:tournament.id,name:tournament.name,type:currencyEffectiveTournamentType(tournament),prizeUSD:currencyTournamentPrize(currencyEffectiveTournamentType(tournament),'player')}))};
    });
    const teamRows = teams.map(team => {
      const roster = playerRows.filter(player=>player.teamId===team.id);
      const titles = tournaments.filter(tournament=>tournament.winnerId===team.id||(!tournament.winnerId&&tournament.winnerName===team.name));
      const matchIncome = Number(team.wins||0)*teamWinReward;
      const tournamentIncome = titles.reduce((sum,tournament)=>sum+currencyTournamentPrize(currencyEffectiveTournamentType(tournament),'team'),0);
      const playersIncome = roster.reduce((sum,player)=>sum+player.totalIncome,0);
      const shareIncome = Math.round(playersIncome*teamSharePercent/100);
      const valuation = teamFinance.get(team.id);
      return {...team,playerCount:roster.length,matchIncome,tournamentIncome,shareIncome,totalIncome:matchIncome+tournamentIncome+shareIncome,
        marketValueUSD:valuation?.marketValueUSD??null,
        forecastUSD:valuation?.forecastUSD??null,
        tournamentTitles:titles.map(tournament=>({id:tournament.id,name:tournament.name,type:currencyEffectiveTournamentType(tournament),prizeUSD:currencyTournamentPrize(currencyEffectiveTournamentType(tournament),'team')})),
        players:roster.map(player=>({id:player.id,nickname:player.nickname,totalIncome:player.totalIncome,marketValueUSD:player.marketValueUSD,forecastUSD:player.forecastUSD}))};
    });
    const configRows=db.prepare("SELECT id,key,value,description FROM GameConfig WHERE key LIKE 'currency_%' ORDER BY key ASC").all();
    res.json({players:playerRows,teams:teamRows,rules:{playerWinReward,captainBonus,teamWinReward,teamSharePercent},configRows});
  } catch(error) { res.status(500).json({error:safeErrorMessage(error)}); }
});
app.put('/api/currency/rules', (req,res) => {
  try {
    const values=req.body?.rules;
    if(!values||typeof values!=='object'||Array.isArray(values))return res.status(400).json({error:'Передайте объект правил расчёта.'});
    const update=db.transaction(()=>{
      const statement=db.prepare("UPDATE GameConfig SET value=? WHERE key=? AND key LIKE 'currency_%'");
      for(const [key,raw] of Object.entries(values)){
        const value=Number(raw);
        if(!key.startsWith('currency_')||!Number.isFinite(value)||value<0)throw new Error('Правило '+key+' должно быть неотрицательным числом.');
        const result=statement.run(String(value),key);
        if(!result.changes)throw new Error('Правило '+key+' не найдено.');
      }
      return db.prepare("SELECT id,key,value,description FROM GameConfig WHERE key LIKE 'currency_%' ORDER BY key ASC").all();
    });
    res.json({ok:true,rules:update()});
  } catch(error) { res.status(400).json({error:safeErrorMessage(error)}); }
});
app.put('/api/currency/teams/:id', (req,res) => {
  try {
    const team=db.prepare('SELECT id FROM Team WHERE id=?').get(req.params.id);
    if(!team)return res.status(404).json({error:'Команда не найдена.'});
    const parseMoney=(value,label)=>{
      if(value===null||value===undefined||value==='')return null;
      const number=Number(value);
      if(!Number.isFinite(number)||number<0||!Number.isSafeInteger(Math.round(number)))throw new Error(label+' должно быть неотрицательным числом.');
      return Math.round(number);
    };
    const marketValueUSD=parseMoney(req.body?.marketValueUSD,'Стоимость команды');
    const forecastUSD=parseMoney(req.body?.forecastUSD,'Прогноз');
    const updatedAt=new Date().toISOString();
    db.prepare('INSERT INTO TeamFinance (teamId,marketValueUSD,forecastUSD,updatedAt) VALUES (?,?,?,?) ON CONFLICT(teamId) DO UPDATE SET marketValueUSD=excluded.marketValueUSD,forecastUSD=excluded.forecastUSD,updatedAt=excluded.updatedAt')
      .run(team.id,marketValueUSD,forecastUSD,updatedAt);
    res.json({ok:true,teamId:team.id,marketValueUSD,forecastUSD,updatedAt});
  } catch(error) { res.status(400).json({error:safeErrorMessage(error)}); }
});
app.put('/api/currency/players/:id', (req,res) => {
  try {
    const player=db.prepare('SELECT id FROM Player WHERE id=?').get(req.params.id);
    if(!player)return res.status(404).json({error:'Игрок не найден.'});
    const parseMoney=(value,label)=>{
      if(value===null||value===undefined||value==='')return null;
      const number=Number(value);
      if(!Number.isFinite(number)||number<0||!Number.isSafeInteger(Math.round(number)))throw new Error(label+' должно быть неотрицательным числом.');
      return Math.round(number);
    };
    const marketValueUSD=parseMoney(req.body?.marketValueUSD,'Стоимость игрока');
    const forecastUSD=parseMoney(req.body?.forecastUSD,'Прогноз');
    const updatedAt=new Date().toISOString();
    db.prepare('INSERT INTO PlayerFinance (playerId,marketValueUSD,forecastUSD,updatedAt) VALUES (?,?,?,?) ON CONFLICT(playerId) DO UPDATE SET marketValueUSD=excluded.marketValueUSD,forecastUSD=excluded.forecastUSD,updatedAt=excluded.updatedAt')
      .run(player.id,marketValueUSD,forecastUSD,updatedAt);
    res.json({ok:true,playerId:player.id,marketValueUSD,forecastUSD,updatedAt});
  } catch(error) { res.status(400).json({error:safeErrorMessage(error)}); }
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
      const createdPairs = [];
      const usedPairs = new Set([[pair.first.id,pair.second.id].sort().join(':')]);
      const pairedIds = new Set([mainPlayer.id,opponent.id]);
      const otherPlayers = players.filter(player => player.id !== mainPlayer.id && player.id !== opponent.id && !busy.has(player.id));
      for (let index=0; index<20; index++) {
        const nextPair = chooseRankedPair(otherPlayers,usedPairs,pairedIds);
        if (!nextPair) break;
        usedPairs.add(nextPair.key);
        pairedIds.add(nextPair.first.id);
        pairedIds.add(nextPair.second.id);
        const pairTime = new Date(now.getTime()+(index+2)*10*60*1000).toISOString();
        const pairId = crypto.randomUUID().replace(/-/g,'');
        const pairMap = maps.length ? maps[Math.floor(Math.random()*maps.length)] : null;
        db.prepare('INSERT INTO RatingMatch (id,player1Id,player2Id,scheduledAt,completed,winnerId,createdAt,updatedAt,map) VALUES (?,?,?,?,0,NULL,?,?,?)')
          .run(pairId,nextPair.first.id,nextPair.second.id,pairTime,nowIso,nowIso,pairMap);
        createdPairs.push({id:pairId,player1Id:nextPair.first.id,player2Id:nextPair.second.id,player1:nextPair.first.nickname,player2:nextPair.second.nickname,scheduledAt:pairTime,completed:0,map:pairMap});
      }
      return { ok:true, match:{id,player1Id:pair.first.id,player2Id:pair.second.id,player1:pair.first.nickname,player2:pair.second.nickname,scheduledAt,completed:0,map}, createdPairs, message:'Соперник найден. Матч добавлен в расписание; также создано пар других игроков: '+createdPairs.length+'.' };
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
      const maps = rankedMaps();
      const allPlayers = allRankedPlayers();
      const configuredMainId = db.prepare("SELECT value FROM GameConfig WHERE key='main_player_id'").get()?.value;
      const mainPlayer = (configuredMainId && allPlayers.find(player=>player.id===configuredMainId))
        || allPlayers.find(player=>String(player.nickname||'').toLowerCase()==='gganz');
      const eligiblePlayers = allPlayers.filter(player=>!mainPlayer || player.id!==mainPlayer.id);
      if (eligiblePlayers.length < 40) throw new Error('Для создания 20 пар без повторения игроков нужно минимум 40 игроков помимо основного.');
      const created = [];
      const usedPairs = new Set();
      const pairedIds = new Set();
      const now = new Date();
      for (let i=0;i<20;i++) {
        const pair = chooseRankedPair(eligiblePlayers,usedPairs,pairedIds);
        if (!pair) throw new Error('Не удалось подобрать 20 уникальных пар без повторения игроков.');
        usedPairs.add(pair.key);
        pairedIds.add(pair.first.id);
        pairedIds.add(pair.second.id);
        const scheduledAt = new Date(now.getTime()+(i+1)*10*60*1000).toISOString();
        const createdAt = now.toISOString();
        const map = maps.length ? maps[Math.floor(Math.random()*maps.length)] : null;
        const id = crypto.randomUUID().replace(/-/g,'');
        db.prepare('INSERT INTO RatingMatch (id,player1Id,player2Id,scheduledAt,completed,winnerId,createdAt,updatedAt,map) VALUES (?,?,?,?,0,NULL,?,?,?)')
          .run(id,pair.first.id,pair.second.id,scheduledAt,createdAt,createdAt,map);
        created.push({id,player1Id:pair.first.id,player2Id:pair.second.id,player1:pair.first.nickname,player2:pair.second.nickname,scheduledAt,completed:0,winnerId:null,map});
      }
      const payload = {count:created.length,matches:created,excludedMainPlayer:mainPlayer?.nickname || null,resultsGenerated:false};
      db.prepare('INSERT INTO Simulation (id,createdAt,input,result) VALUES (?,?,?,?)')
        .run(crypto.randomUUID().replace(/-/g,''),now.toISOString(),JSON.stringify({type:'rating-batch-scheduled',count:created.length,excludedMainPlayer:mainPlayer?.nickname || null}),JSON.stringify(payload));
      return {ok:true,...payload,message:'Создано 20 предстоящих рейтинговых матчей без участия основного игрока. Для проведения используйте «Симулировать ближайшие матчи».'};
    })();
    res.json(result);
  } catch(error) { res.status(400).json({error:error.message || 'Не удалось создать 20 рейтинговых матчей.'}); }
});
app.post('/api/rating-matches/simulate-upcoming', (_req,res) => {
  try {
    const result = db.transaction(() => {
      const rules = rankedRules();
      const allPlayers = allRankedPlayers();
      const configuredMainId = db.prepare("SELECT value FROM GameConfig WHERE key='main_player_id'").get()?.value;
      const mainPlayer = (configuredMainId && allPlayers.find(player=>player.id===configuredMainId))
        || allPlayers.find(player=>String(player.nickname||'').toLowerCase()==='gganz');
      const pending = db.prepare('SELECT id,player1Id,player2Id,scheduledAt,map FROM RatingMatch WHERE completed=0 AND player1Id<>? AND player2Id<>? ORDER BY scheduledAt ASC,createdAt ASC LIMIT 20')
        .all(mainPlayer?.id || '',mainPlayer?.id || '');
      if (!pending.length) return {ok:true,count:0,matches:[],message:'Нет незавершённых рейтинговых матчей без участия основного игрока для симуляции.'};
      const playersById = new Map(allPlayers.map(player=>[player.id,player]));
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
