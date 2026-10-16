const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const Database=require('better-sqlite3');
const root=path.join(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ra3-smoke-')),dbPath=path.join(dir,'test.sqlite');
const port=32000+Math.floor(Math.random()*20000),url='http://127.0.0.1:'+port,now=new Date().toISOString();
const db=new Database(dbPath);
db.exec("CREATE TABLE Team(id TEXT PRIMARY KEY,name TEXT NOT NULL,logoUrl TEXT,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0,points INTEGER DEFAULT 0,level INTEGER DEFAULT 1,bestMap TEXT,worstMap TEXT,createdAt TEXT,updatedAt TEXT);"+
"CREATE TABLE Player(id TEXT PRIMARY KEY,nickname TEXT NOT NULL,faction TEXT,teamId TEXT,isTeamCaptain INTEGER DEFAULT 0,ratingGames INTEGER DEFAULT 0,ratingWins INTEGER DEFAULT 0,ratingLosses INTEGER DEFAULT 0,ratingPoints INTEGER DEFAULT 1000,rpPoints INTEGER DEFAULT 0,rpPeak INTEGER DEFAULT 0,experience INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,position TEXT,bestMap TEXT,worstMap TEXT,matchWins INTEGER DEFAULT 0,matchLosses INTEGER DEFAULT 0,rankId TEXT);"+
"CREATE TABLE Tournament(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT,winnerId TEXT,winnerName TEXT,seasonId TEXT,seasonNumber TEXT,createdAt TEXT,description TEXT,imageUrl TEXT);"+
"CREATE TABLE Match(id TEXT PRIMARY KEY,tournamentId TEXT,homeTeamId TEXT,awayTeamId TEXT,homeScore INTEGER,awayScore INTEGER,winnerId TEXT,completed INTEGER DEFAULT 0,map TEXT,nextMatchId TEXT,round INTEGER,updatedAt TEXT,createdAt TEXT);"+
"CREATE TABLE GameConfig(id TEXT PRIMARY KEY,key TEXT NOT NULL UNIQUE,value TEXT NOT NULL,description TEXT,createdAt TEXT);"+
"CREATE TABLE Map(id TEXT PRIMARY KEY,name TEXT NOT NULL,playersCount INTEGER DEFAULT 2,imageUrl TEXT,description TEXT);"+
"CREATE TABLE Rank(id TEXT PRIMARY KEY,name TEXT,description TEXT,imageUrl TEXT,requiredWins INTEGER NOT NULL DEFAULT 0,requiredXP INTEGER NOT NULL DEFAULT 0,createdAt TEXT);"+
"CREATE TABLE MapStat(id TEXT PRIMARY KEY,mapName TEXT,mapId TEXT,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0,teamId TEXT,playerId TEXT,createdAt TEXT);"+
"CREATE TABLE RatingMatch(id TEXT PRIMARY KEY,player1Id TEXT NOT NULL,player2Id TEXT NOT NULL,scheduledAt TEXT NOT NULL,completed INTEGER DEFAULT 0,winnerId TEXT,createdAt TEXT,updatedAt TEXT,map TEXT);"+
"CREATE TABLE Simulation(id TEXT PRIMARY KEY,createdAt TEXT,input TEXT NOT NULL,result TEXT NOT NULL);"+
"CREATE TABLE Mail(id TEXT PRIMARY KEY,playerId TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'general',isRead INTEGER NOT NULL DEFAULT 0,meta TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);");
const team=db.prepare('INSERT INTO Team(id,name,wins,losses,points,level,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)');
team.run('ds','DS Esports',22,4,170,2,now,now);team.run('as','Astralis',21,5,162,2,now,now);team.run('other','Other Team',10,5,50,1,now,now);team.run('fnatic','Fnatic',13,6,105,2,now,now);
const player=db.prepare('INSERT INTO Player(id,nickname,faction,teamId,isTeamCaptain,ratingGames,ratingWins,ratingLosses,ratingPoints,rpPoints,rpPeak,experience) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
for(const p of [
['gg','GGanz','Союз','ds',1,71,43,28,1200,875,900,30000],
['mo','mONESY','Союз','ds',0,38,27,11,1100,740,760,25000],
['ma','Magister.Yoda','Альянс','ds',0,32,21,11,1150,630,640,24000],
['mat','MATUBA','Империя','as',0,41,28,13,1080,649,660,25000],
['ku','KuroKy','Союз','as',0,39,27,12,1275,718,744,26000],
['mi','MinD_ContRoL','Союз','as',0,36,25,11,1185,736,762,23000]
])player.run(...p);
for(let i=0;i<37;i++)player.run('o'+i,'Player'+i,i%3===0?'Союз':i%3===1?'Альянс':'Империя','other',0,i%5,Math.floor(i/2),Math.floor(i/3),1000+i,300+i,350+i,10000+i);
const tournament=db.prepare('INSERT INTO Tournament(id,name,type,winnerId,winnerName,createdAt) VALUES(?,?,?,?,?,?)');
for(let i=1;i<=3;i++)tournament.run('cl'+i,i===2?'Champions League':'Champions League S'+i,'Champions League','ds','DS Esports',now);
tournament.run('gl1','Grand League S1','Grand League','as','Astralis',now);
tournament.run('gl2','Grand League S2','Champions League','as','Astralis',now);
tournament.run('t-final','Champions League Test','Champions League',null,null,now);
db.prepare('INSERT INTO Match(id,tournamentId,homeTeamId,awayTeamId,homeScore,awayScore,winnerId,completed,map,nextMatchId,round,updatedAt,createdAt) VALUES(?,?,?,?,?,?,NULL,0,?,NULL,?,?,?)')
  .run('final-test','t-final','ds','as',3,1,'Обычное столкновение',5,now,now);
db.prepare('INSERT INTO Match(id,tournamentId,homeTeamId,awayTeamId,homeScore,awayScore,winnerId,completed,map,nextMatchId,round,updatedAt,createdAt) VALUES(?,?,?,?,?,?,?,1,?,NULL,?,?,?)')
  .run('third-test','t-final','fnatic','other',2,1,'fnatic','Обычное столкновение',4,now,now);
const addConfig=db.prepare('INSERT INTO GameConfig(id,key,value,description,createdAt) VALUES(?,?,?,?,?)');
addConfig.run('match','match_win',JSON.stringify({teamPoints:10,playerPoints:5,playerMMR:50,playerMMR_Loss:-25}),'Match rules',now);
addConfig.run('cl-first','champions_league_1_place',JSON.stringify({teamPoints:10,teamMMR:400,playerPoints:10,playerMMR:100}),'First place',now);
addConfig.run('cl-second','champions_league_2_place',JSON.stringify({teamPoints:9,teamMMR:400,playerPoints:10,playerMMR:100}),'Second place',now);
addConfig.run('cl-third','champions_league_3_place',JSON.stringify({teamPoints:8,teamMMR:400,playerPoints:10,playerMMR:100}),'Third place',now);
db.prepare('INSERT INTO Map(id,name,playersCount) VALUES(?,?,?)').run('m1','Обычное столкновение',2);
db.prepare('INSERT INTO Map(id,name,playersCount) VALUES(?,?,?)').run('m2','Промышленная мощь',2);
const addMapStat=db.prepare('INSERT INTO MapStat(id,mapName,mapId,wins,losses,teamId,playerId,createdAt) VALUES(?,?,?,?,?,?,?,?)');
addMapStat.run('ms-gg','Обычное столкновение','m1',5,2,null,'gg',now);
addMapStat.run('ms-mo','Обычное столкновение','m1',4,3,null,'mo',now);
addMapStat.run('ms-ma','Промышленная мощь','m2',1,6,null,'ma',now);
const addRank=db.prepare('INSERT INTO Rank(id,name,requiredWins,requiredXP,createdAt) VALUES(?,?,?,?,?)');
addRank.run('rank-newbie','Новобранец',0,0,now);addRank.run('rank-lieutenant','Старший лейтенант',0,31000,now);addRank.run('rank-captain','Капитан',0,38000,now);
const addMail=db.prepare('INSERT INTO Mail(id,playerId,subject,body,kind,isRead,meta,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)');
addMail.run('mail-transfer','gg','Трансферное предложение от Astralis','Предлагается перейти в Astralis.','transfer',0,JSON.stringify({type:'transfer',teamId:'as',teamName:'Astralis',role:'Капитан',contractYears:2,transferFeeUSD:900000,annualSalaryUSD:300000,signingBonusUSD:50000}),now,now);
addMail.run('mail-coop','gg','Партнёрство с HyperX','Предложение о сотрудничестве.','cooperation',0,JSON.stringify({type:'cooperation',company:'HyperX',amountUSD:15000,durationMonths:6,perks:['стримы','мерч']}),now,now);
const addCompletedMatch=db.prepare('INSERT INTO RatingMatch(id,player1Id,player2Id,scheduledAt,completed,winnerId,createdAt,updatedAt,map) VALUES(?,?,?,?,1,?,?,?,?)');
addCompletedMatch.run('faction-match-1','gg','mat',now,'gg',now,now,'Обычное столкновение');
addCompletedMatch.run('faction-match-2','mo','ma',now,'ma',now,now,'Обычное столкновение');
addCompletedMatch.run('faction-match-3','mat','ma',now,'mat',now,now,'Обычное столкновение');
db.close();
const child=spawn(process.execPath,[path.join(root,'server','index.js')],{cwd:root,env:{...process.env,DB_PATH:dbPath,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
async function req(route,options){const r=await fetch(url+route,options);const j=await r.json();if(!r.ok)throw Error(route+' HTTP '+r.status+' '+JSON.stringify(j));return j;}
async function wait(){for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error('Server startup failed: '+logs);try{if((await fetch(url+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Server timeout: '+logs);}
async function stop(){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,1500))]);if(child.exitCode===null)child.kill('SIGKILL');}}
async function main(){try{
await wait();
const teamApi=await req('/api/teams');
assert.equal(teamApi.find(team=>team.name==='DS Esports').bestMap,'Обычное столкновение');
assert.equal(teamApi.find(team=>team.name==='DS Esports').worstMap,'Промышленная мощь');
const mapStats=await req('/api/map-stats');
assert.equal(mapStats.find(row=>row.playerName==='GGanz').teamName,'DS Esports');
const playerApi=await req('/api/players');
assert.equal(playerApi.find(player=>player.nickname==='GGanz').bestMap,'Обычное столкновение');
const ratingApi=await req('/api/rating-matches');
assert.ok(ratingApi.some(match=>match.player1Id==='gg'&&match.player2Id==='mat'&&match.player1Faction==='Союз'&&match.player2Faction==='Империя'));
const factionStats=await req('/api/faction-stats');
assert.equal(factionStats.reduce((sum,row)=>sum+row.wins,0),3);
assert.equal(factionStats.reduce((sum,row)=>sum+row.losses,0),3);
assert.equal(factionStats.find(row=>row.faction==='Союз').wins,1);
assert.equal(factionStats.find(row=>row.faction==='Альянс').wins,1);
assert.equal(factionStats.find(row=>row.faction==='Империя').wins,1);
const defaultMain=await req('/api/settings/main-player');assert.equal(defaultMain.player.nickname,'GGanz');
const changedMain=await req('/api/settings/main-player',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:'mo'})});assert.equal(changedMain.player.nickname,'mONESY');
assert.equal((await req('/api/settings/main-player')).player.nickname,'mONESY');
await req('/api/settings/main-player',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:'gg'})});
await req('/api/manage/players/gg',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({experience:34016})});
assert.equal((await req('/api/players')).find(player=>player.nickname==='GGanz').rankName,'Старший лейтенант');
await req('/api/manage/players/gg',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({experience:38000})});
assert.equal((await req('/api/players')).find(player=>player.nickname==='GGanz').rankName,'Капитан');
let c=await req('/api/currency');let gg=c.players.find(p=>p.nickname==='GGanz'),ds=c.teams.find(t=>t.name==='DS Esports'),as=c.teams.find(t=>t.name==='Astralis');
assert.equal(gg.matchIncome,129000);assert.ok(Math.abs(gg.tournamentIncome-595000)<1);assert.ok(Math.abs(gg.totalIncome-724000)<1);
assert.equal(ds.matchIncome,330000);assert.equal(ds.tournamentIncome,7500000);assert.equal(ds.shareIncome,402000);assert.equal(ds.totalIncome,8232000);
assert.equal(as.matchIncome,315000);assert.equal(as.tournamentIncome,3300000);assert.equal(as.shareIncome,257000);assert.equal(as.totalIncome,3872000);
assert.equal(gg.marketValueUSD,6730000);assert.equal(gg.forecastUSD,8750000);assert.equal(ds.marketValueUSD,19050000);assert.equal(ds.forecastUSD,20570000);assert.equal(as.marketValueUSD,15120000);assert.equal(as.forecastUSD,21170000);
for(const [id,marketValueUSD,forecastUSD] of [['gg',6730000,8750000],['mo',4680000,5900000],['ma',4440000,4710000]])await req('/api/currency/players/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({marketValueUSD,forecastUSD})});
c=await req('/api/currency');ds=c.teams.find(t=>t.name==='DS Esports');assert.equal(ds.marketValueUSD,19050000);assert.equal(ds.forecastUSD,20570000);await req('/api/currency/teams/ds',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({marketValueUSD:19100000,forecastUSD:20600000})});c=await req('/api/currency');ds=c.teams.find(t=>t.name==='DS Esports');assert.equal(ds.marketValueUSD,19100000);assert.equal(ds.forecastUSD,20600000);
const saved=await req('/api/currency/rules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{currency_player_win_reward:'2100'}})});assert.ok(saved.rules.some(x=>x.key==='currency_player_win_reward'&&Number(x.value)===2100));
const batch=await req('/api/rating-matches/simulate-20',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(batch.count,20);assert.equal(batch.resultsGenerated,false);
let ids=batch.matches.flatMap(m=>[m.player1Id,m.player2Id]);assert.equal(new Set(ids).size,40);assert.ok(!ids.includes('gg'));assert.ok(batch.matches.every(m=>m.completed===0&&!m.winnerId));
const d2=new Database(dbPath);d2.prepare('INSERT INTO RatingMatch(id,player1Id,player2Id,scheduledAt,completed,createdAt,updatedAt,map) VALUES(?,?,?,?,0,?,?,?)').run('main-pending','gg','o0',new Date(Date.now()+1000).toISOString(),now,now,'Обычное столкновение');d2.close();
const beforeDb=new Database(dbPath);const beforeMapTotals=beforeDb.prepare('SELECT COALESCE(SUM(wins),0) AS wins,COALESCE(SUM(losses),0) AS losses FROM MapStat').get();beforeDb.close();
const simulated=await req('/api/rating-matches/simulate-upcoming',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(simulated.count,20);
const afterDb=new Database(dbPath);const afterMapTotals=afterDb.prepare('SELECT COALESCE(SUM(wins),0) AS wins,COALESCE(SUM(losses),0) AS losses FROM MapStat').get();assert.equal(afterMapTotals.wins,beforeMapTotals.wins+20);assert.equal(afterMapTotals.losses,beforeMapTotals.losses+20);assert.equal(afterDb.prepare("SELECT completed FROM RatingMatch WHERE id='main-pending'").get().completed,0);afterDb.prepare("DELETE FROM RatingMatch WHERE id='main-pending'").run();afterDb.close();
const editCompleted=await fetch(url+'/api/manage/rating-matches/faction-match-1',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({scheduledAt:now})});assert.equal(editCompleted.status,409);
const deleteCompleted=await fetch(url+'/api/manage/rating-matches/faction-match-1',{method:'DELETE'});assert.equal(deleteCompleted.status,409);
const invalidResult=await fetch(url+'/api/manage/rating-matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player1Id:'gg',player2Id:'mo',scheduledAt:now,completed:true,winnerId:'gg'})});assert.equal(invalidResult.status,400);
const found=await req('/api/rating-matches/find-opponent',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.ok(found.match.player1Id==='gg'||found.match.player2Id==='gg');assert.equal(found.createdPairs.length,20);
ids=found.createdPairs.flatMap(m=>[m.player1Id,m.player2Id]);assert.equal(new Set(ids).size,40);assert.ok(!ids.includes('gg'));assert.ok(!ids.includes(found.match.player1Id==='gg'?found.match.player2Id:found.match.player1Id));
const completedFinal=await req('/api/matches/final-test/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(completedFinal.tournamentWinnerUpdated,true);
assert.equal(completedFinal.tournamentAwards.length,3);
assert.deepEqual(completedFinal.tournamentAwards.map(award=>award.place),[1,2,3]);
const afterTournamentTeams=await req('/api/teams');
assert.equal(afterTournamentTeams.find(team=>team.name==='DS Esports').teamMMR,740);
assert.equal(afterTournamentTeams.find(team=>team.name==='Astralis').teamMMR,724);
assert.equal(afterTournamentTeams.find(team=>team.name==='Fnatic').teamMMR,610);
const verifyTournament=new Database(dbPath);
const finalTournament=verifyTournament.prepare("SELECT winnerId,winnerName FROM Tournament WHERE id='t-final'").get();
assert.equal(finalTournament.winnerId,'ds');assert.equal(finalTournament.winnerName,'DS Esports');
assert.equal(verifyTournament.prepare("SELECT completed FROM Match WHERE id='final-test'").get().completed,1);
verifyTournament.close();
const inbox=await req('/api/mail');assert.equal(inbox.length,2);assert.ok(inbox.some(item=>item.id==='mail-transfer'&&!item.isRead));
const readMail=await req('/api/mail/mail-transfer/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({isRead:true})});assert.equal(readMail.isRead,true);
const acceptedOffer=await req('/api/mail/mail-transfer/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'accept'})});assert.equal(acceptedOffer.acceptedTeam,'Astralis');
const transferredPlayer=(await req('/api/players')).find(player=>player.nickname==='GGanz');assert.equal(transferredPlayer.teamId,'as');assert.equal(transferredPlayer.position,'Капитан');
const duplicateResponse=await fetch(url+'/api/mail/mail-transfer/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'decline'})});assert.equal(duplicateResponse.status,400);
const respondedInbox=await req('/api/mail');assert.equal(respondedInbox.find(item=>item.id==='mail-transfer').meta.response.status,'accepted');
const backup=await req('/api/backups',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.ok(backup.ok&&backup.id&&backup.tableCount>0);
const backupList=await req('/api/backups');assert.ok(backupList.some(item=>item.id===backup.id&&item.restorable));
await req('/api/manage/teams/ds',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Temporary Backup Test Team'})});
assert.ok((await req('/api/teams')).some(team=>team.name==='Temporary Backup Test Team'));
const restored=await req('/api/backups/'+backup.id+'/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(restored.ok,true);
assert.ok((await req('/api/teams')).some(team=>team.name==='DS Esports'));
assert.ok(!(await req('/api/teams')).some(team=>team.name==='Temporary Backup Test Team'));
console.log('Smoke tests passed: PDF currency calculations, saved valuations, rule editing, map/faction statistics, map updates after ranked matches, saved main-player settings, rank progression from XP thresholds, mail reading and transfer acceptance, protected completed-match history, full database backup and restore, unique 20-match scheduling, GGanz exclusion, matchmaking, and tournament-final winner recording.');
}finally{await stop();for(const f of ['test.sqlite','test.sqlite-shm','test.sqlite-wal'])try{fs.rmSync(path.join(dir,f),{force:true});}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
