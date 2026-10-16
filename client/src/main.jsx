import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Coins, Award, Info, Map, CalendarDays, ChartNoAxesColumn, Layers, FlaskConical, ContactRound, UsersRound, Swords, Trophy, Search, Settings, RefreshCw, House, ChevronRight, CircleAlert, Plus, Pencil, Trash2, X, Save, CheckCircle2 } from 'lucide-react';
import './style.css';

const nav = [
  ['Валюта', Coins, 'config'], ['Звания', Award, 'ranks'], ['Информация', Info, 'info'], ['Карты', Map, 'maps'],
  ['Матчи', CalendarDays, 'matches'], ['Рейтинг', ChartNoAxesColumn, 'rating'], ['Рейтинговая лига', Layers, 'league'],
  ['Сезоны', CalendarDays, 'seasons'], ['Симулятор', FlaskConical, 'simulator'], ['Список игроков', ContactRound, 'players'],
  ['Список команд', UsersRound, 'teams'], ['Ставки', Coins, 'bets'], ['Турниры', Swords, 'tournaments'], ['Настройки', Settings, 'settings']
];
const endpoints = {
  teams:'/api/teams', players:'/api/players', tournaments:'/api/tournaments', matches:'/api/matches',
  league:'/api/leagues', seasons:'/api/seasons', maps:'/api/maps', config:'/api/config',
  ranks:'/api/ranks', info:'/api/news', simulator:'/api/simulations'
};
const fmt = v => v == null || v === '' ? '—' : v;
const bool = v => v ? 'Да' : 'Нет';

function App() {
  const [page, setPage] = useState('home');
  const [subtab, setSubtab] = useState('Рейтинг Команд');
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('points');
  const [crudDialog, setCrudDialog] = useState(null);
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [rankedBusy, setRankedBusy] = useState(false);
  const [tableSort, setTableSort] = useState({ column: null, direction: 'asc' });

  const ratingTabs = ['Рейтинг Команд','Рейтинг Игроков','Рейтинг Альянс','Рейтинг Союз','Рейтинг Империя'];
  const leagueTabs = ['Информация о лигах','Рейтинговые матчи','Лучшие игроки','Кабинет игрока','Статистика фракций'];

  function goPage(id) {
    setPage(id);
    setSearch('');
    if (id === 'rating') setSubtab('Рейтинг Команд');
    if (id === 'league') setSubtab('Информация о лигах');
    if (id === 'maps') setSubtab('Карты');
    if (id === 'info') setSubtab('Информация');
  }

  function endpointFor() {
    if (page === 'rating') return subtab === 'Рейтинг Команд' ? '/api/teams' : '/api/players';
    if (page === 'league') {
      if (subtab === 'Рейтинговые матчи') return '/api/rating-matches';
      if (subtab === 'Лучшие игроки') return '/api/players';
      if (subtab === 'Статистика фракций') return '/api/faction-stats';
      if (subtab === 'Кабинет игрока') return '/api/players';
      return '/api/leagues';
    }
    if (page === 'maps' && subtab === 'Статистика карт') return '/api/map-stats';
    if (page === 'info' && subtab === 'Достижения') return '/api/achievements';
    if (page === 'info' && subtab === 'Медали') return '/api/medals';
    if (page === 'info' && subtab === 'Посты победителей') return '/api/winner-posts';
    if (page === 'info' && subtab === 'Витрина достижений') return '/api/achievement-showcase';
    return endpoints[page];
  }

  async function load() {
    if (page === 'home' || page === 'bets' || page === 'settings') { setData([]); setError(''); return; }
    setLoading(true); setError('');
    try {
      const [r, s] = await Promise.all([fetch(endpointFor()), fetch('/api/summary')]);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const rows = await r.json();
      if (!Array.isArray(rows)) throw new Error('Неожиданный формат ответа сервера');
      setData(rows);
      if (s.ok) setSummary(await s.json());
    } catch (e) {
      setError('Не удалось загрузить данные: ' + (e?.message || 'неизвестная ошибка') + '. Проверьте доступность API и консоль сервера.');
      setData([]);
    } finally { setLoading(false); }
  }

  async function runRankedAction(action) {
    if (rankedBusy) return;
    if (action === 'simulate-20' && !window.confirm('Создать 20 новых пар рейтинговых матчей без участия основного игрока? Результаты и рейтинги не изменятся, пока вы не запустите «Симулировать ближайшие матчи».')) return;
    if (action === 'simulate-upcoming' && !window.confirm('Симулировать до 20 ближайших незавершённых рейтинговых матчей без участия основного игрока? Результаты и рейтинги будут сохранены.')) return;
    setRankedBusy(true);
    setError('');
    setActionMessage('');
    try {
      const response = await fetch('/api/rating-matches/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось выполнить действие.');
      if (action === 'find-opponent') {
        setActionMessage(result.message + ' ' + result.match.player1 + ' vs ' + result.match.player2 + (result.match.map ? ' · Карта: ' + result.match.map : '') + '.');
      } else if (action === 'simulate-20') {
        setActionMessage(result.message || ('Создано предстоящих матчей: ' + result.count + '.'));
      } else {
        setActionMessage((result.message || 'Операция завершена.') + ' Проведено матчей: ' + result.count + '.');
      }
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось выполнить действие с рейтинговыми матчами.');
    } finally {
      setRankedBusy(false);
    }
  }

  useEffect(() => {
    fetch('/api/summary').then(r => r.json()).then(setSummary).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [page, subtab]);
  useEffect(() => { setTableSort({ column: null, direction: 'asc' }); }, [page, subtab]);

  const visibleData = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data.filter(x => !q || Object.values(x).some(v => String(v ?? '').toLowerCase().includes(q)));
    if (page === 'rating' && subtab === 'Рейтинг Команд') {
      const teamRanks = new Map([...data].sort((a,b) => Number(b.points||0)-Number(a.points||0) || Number(b.wins||0)-Number(a.wins||0) || String(a.name||'').localeCompare(String(b.name||''))).map((row,index)=>[row.id,index]));
      rows = rows.map(row => ({...row,_podiumRank:teamRanks.get(row.id) ?? 999}));
    }
    if (page === 'rating' && subtab !== 'Рейтинг Команд') {
      const faction = { 'Рейтинг Альянс':'Альянс', 'Рейтинг Союз':'Союз', 'Рейтинг Империя':'Империя' }[subtab];
      const aliases = {'Альянс':['альянс','allied','allies'],'Союз':['союз','soviet'],'Империя':['импер','empire']};
      const terms = faction ? (aliases[faction] || [faction.toLowerCase()]) : null;
      if (terms) rows = rows.filter(r => terms.some(term=>String(r.faction||'').toLowerCase().includes(term)));
      const rankRows = data.filter(r=>!terms||terms.some(term=>String(r.faction||'').toLowerCase().includes(term)))
        .sort((a,b)=>Number(b.ratingPoints||0)-Number(a.ratingPoints||0));
      const playerRanks = new Map(rankRows.map((row,index)=>[row.id,index]));
      rows.sort((a,b) => Number(b.ratingPoints || 0) - Number(a.ratingPoints || 0));
      rows = rows.map(row=>({...row,_podiumRank:playerRanks.get(row.id) ?? 999}));
    }
    if (page === 'league' && subtab === 'Лучшие игроки') rows.sort((a,b) => Number(b.rpPoints || 0) - Number(a.rpPoints || 0));
    if (page === 'teams') rows.sort((a,b) => Number(b[sort] || 0) - Number(a[sort] || 0));
    return rows;
  }, [data, search, page, subtab, sort]);

  const title = nav.find(x => x[2] === page)?.[0] || (page === 'home' ? 'Главная' : 'Раздел');
  const homeCards = [
    ['Команды','Управление командами и статистикой','teams',UsersRound],
    ['Матчи','Расписание и результаты матчей','matches',CalendarDays],
    ['Турниры','Турниры и их настройки','tournaments',Trophy],
    ['Звания','Система званий и опыта игроков','ranks',Award]
  ];

  let columns = columnsFor(page, subtab);
  let sectionTitle = title;
  if (page === 'rating') {
    sectionTitle = subtab;
    columns = subtab === 'Рейтинг Команд' ? [
      ['Место',r=>(r._podiumRank??0)+1],['Команда',r=><span className="team-name"><ImageCell src={r.logoUrl} alt={r.name} type="team"/>{r.name}</span>],
      ['Сыграно игр',r=>(r.wins||0)+(r.losses||0)],['Очки',r=>r.points],['MMR',r=>Number(r.points||0)*2],['Победы',r=>r.wins],['Поражения',r=>r.losses],['Уровень',r=>r.level],['Аналитика',r=><button className="ranked-secondary currency-analytics-btn" onClick={()=>setTeamAnalytics(r)}>Аналитика</button>]
     ] : [['Место',r=>(r._podiumRank??0)+1],['Игрок',r=><span className="player-ranking-name"><span className={'player-faction-dot '+(String(r.faction||'').toLowerCase().includes('союз')||String(r.faction||'').toLowerCase().includes('soviet')?'faction-red':String(r.faction||'').toLowerCase().includes('альянс')||String(r.faction||'').toLowerCase().includes('allied')?'faction-blue':String(r.faction||'').toLowerCase().includes('импер')||String(r.faction||'').toLowerCase().includes('empire')?'faction-yellow':'faction-neutral')}>●</span>{r.nickname}</span>],['Фракция',r=><FactionName value={r.faction}/>],['Команда','teamName'],['Очки','wins'],['RP','ratingPoints'],['Победы','matchWins'],['Поражения','matchLosses']];
  } else if (page === 'league') {
    sectionTitle = subtab;
    if (subtab === 'Информация о лигах') columns = [['#',(_,i)=>i+1],['Эмблема',r=><ImageCell src={r.imageUrl} alt={r.name} type="league"/>],['Лига','name'],['Минимум очков','requiredPoints'],['Описание','description']];
    else if (subtab === 'Рейтинговые матчи') columns = [['Игрок 1','player1'],['Игрок 2','player2'],['Дата','scheduledAt'],['Карта','map'],['Победитель','winner'],['Завершён',r=>bool(r.completed)]];
    else if (subtab === 'Лучшие игроки') columns = [['#',(_,i)=>i+1],['Игрок',r=><span className="player-ranking-name"><span className={'player-faction-dot '+(String(r.faction||'').toLowerCase().includes('союз')||String(r.faction||'').toLowerCase().includes('soviet')?'faction-red':String(r.faction||'').toLowerCase().includes('альянс')||String(r.faction||'').toLowerCase().includes('allied')?'faction-blue':'faction-yellow')}>●</span>{r.nickname}</span>],['Команда','teamName'],['RP','rpPoints'],['Рейтинговые победы','ratingWins'],['Лучшая карта',r=>r.bestMap||'—']];
    else if (subtab === 'Статистика фракций') columns = [['Фракция','faction'],['Игроков','players'],['Победы в матчах','wins'],['Поражения в матчах','losses'],['Рейтинговые победы','ratingWins'],['Рейтинговые поражения','ratingLosses'],['Средний RP','averageRP'],['Максимальный пиковый RP','peakRP']];
    else columns = [];
  } else if (page === 'maps' && subtab === 'Статистика карт') columns = [['Карта',r=>r.map || r.mapName],['Команда','teamName'],['Игрок','playerName'],['Победы','wins'],['Поражения','losses']];
  else if (page === 'info' && subtab === 'Достижения') columns = [['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="achievement"/>],['Достижение','name'],['Описание','description'],['Игрок','playerName'],['Команда','teamName'],['Тип условия','conditionType']];
  else if (page === 'info' && subtab === 'Медали') columns = [['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="achievement"/>],['Медаль','name'],['Описание','description'],['Создана','createdAt']];
  else if (page === 'info' && subtab === 'Посты победителей') columns = [['Турнир','tournamentName'],['Команда','teamName'],['Заголовок','title'],['Содержание','content'],['Создан','createdAt']];
  else if (page === 'info' && subtab === 'Информация') columns = [['Заголовок','title'],['Текст новости','content'],['Турнир','relatedTournamentName'],['Карта матча','relatedMatchMap'],['Дата','createdAt']];
  else if (page === 'info' && subtab === 'Витрина достижений') columns = [['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="achievement"/>],['Название','name'],['Описание','description'],['Достижения','achievementNames'],['Создана','createdAt']];

  const specialPlaceholder = page === 'bets'
    ? 'В исходной SQL-базе нет таблицы ставок. Раздел нельзя корректно включить без согласования правил и структуры данных.'
    : null;
  const crudEntity = entityFor(page, subtab);
  const crudFields = fieldsFor(page, subtab);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand" onClick={() => goPage('home')}>Red Alert Tournament<br/>Manager</div>
      <nav>{nav.map(([label,Icon,id]) => <button key={id} className={'nav-item '+(page===id?'active':'')} onClick={() => goPage(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot">Независимая версия · 0.2</div>
    </aside>
    <main className="main">
      <header className="topbar"><span className="crumb"><House size={15}/> <ChevronRight size={14}/> {title}</span><button className="icon-btn" title="Обновить данные" onClick={load}><RefreshCw size={17}/></button></header>
      <div className="content">
        {page === 'home' ? <>
          <div className="hero"><h1>Red Alert Tournament Manager</h1><p>Система для организации турниров по Red Alert 3</p></div>
          {summary && <div className="stats-grid">{[['Команды',summary.teams],['Игроки',summary.players],['Матчи',summary.matches],['Турниры',summary.tournaments]].map(([l,n])=><div className="stat-card" key={l}><span>{l}</span><strong>{n}</strong></div>)}</div>}
          <div className="home-grid">{homeCards.map(([name,desc,id,Icon])=><article className="home-card" key={id}><h2><Icon size={22}/>{name}</h2><p>{desc}</p><button className="primary" onClick={() => goPage(id)}>Перейти</button></article>)}</div>
        </> : <>
          <h1 className="page-title">{title}</h1>
          {page === 'settings' ? <SettingsPanel /> : null}
          {page === 'rating' && <div className="tabs rating-tabs">{ratingTabs.map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div>}
          {page === 'league' && <div className="tabs">{leagueTabs.map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div>}
          {page === 'maps' && <div className="tabs"><button className={subtab==='Карты'?'selected':''} onClick={()=>setSubtab('Карты')}>Карты</button><button className={subtab==='Статистика карт'?'selected':''} onClick={()=>setSubtab('Статистика карт')}>Статистика карт</button></div>}
          {page === 'info' && <div className="tabs">{['Информация','Достижения','Медали','Посты победителей','Витрина достижений'].map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div>}
          {page !== 'settings' && <section className="panel">
            <div className="panel-head"><div><h2>{sectionTitle}</h2><p className="muted">Данные читаются из локальной SQL-базы независимой версии.</p></div>
              <div className="panel-tools">
                {crudEntity && <button className="primary" onClick={() => { setActionMessage(''); setCrudDialog({ entity: crudEntity, row: null, fields: crudFields }); }}><Plus size={16}/>Добавить</button>}
                {page !== 'bets' && !(page==='league' && ['Кабинет игрока','Статистика фракций'].includes(subtab)) && <Toolbar search={search} setSearch={setSearch} sort={sort} setSort={setSort} showSort={page==='teams'}/>}
              </div>
            </div>
            {page === 'league' && subtab === 'Рейтинговые матчи' && <div className="ranked-actions">
              <button className="primary" disabled={rankedBusy} onClick={() => runRankedAction('find-opponent')}><Search size={16}/>{rankedBusy ? 'Обработка…' : 'Найти соперника'}</button>
              <button className="ranked-secondary" disabled={rankedBusy} onClick={() => runRankedAction('simulate-20')}><Swords size={16}/>{rankedBusy ? 'Обработка…' : 'Провести 20 матчей'}</button>
              <button className="ranked-secondary" disabled={rankedBusy} onClick={() => runRankedAction('simulate-upcoming')}><RefreshCw size={16}/>{rankedBusy ? 'Обработка…' : 'Симулировать ближайшие матчи'}</button>
            </div>}
            {error && <div className="error"><CircleAlert size={18}/>{error}</div>}
            {actionMessage && <div className="success-message">{actionMessage}</div>}
            
            {page === 'simulator' && (
              <SimulatorPanel onComplete={async winner => {
                setActionMessage('Симуляция завершена. Победитель: ' + winner);
                await load();
              }} />
            )}
            {page === 'settings' ? null : page === 'league' && subtab === 'Кабинет игрока' ? (
              loading ? <p className="muted">Загрузка игроков…</p> : <PlayerCabinet players={data} onFindMatch={() => runRankedAction('find-opponent')} />
            ) : page === 'league' && subtab === 'Рейтинговые матчи' ? (
              loading ? <p className="muted">Загрузка рейтинговых матчей…</p> : <RatingMatchesTable rows={visibleData} onComplete={async () => { await load(); }} />
            ) : page === 'config' ? (
              <CurrencyDashboard />
            ) : page === 'maps' && subtab === 'Статистика карт' ? (
              loading ? <p className="muted">Загрузка статистики карт…</p> : <MapStatsPanel rows={visibleData} />
            ) : page === 'league' && subtab === 'Статистика фракций' ? (
              loading ? <p className="muted">Загрузка статистики фракций…</p> : <FactionStatsPanel rows={visibleData} />
            ) : specialPlaceholder ? (
              <div className="empty-state">{specialPlaceholder}</div>
            ) : loading ? (
              <p className="muted">Загрузка…</p>
            ) : (
              <DataTable
                rows={page === 'league' && subtab === 'Лучшие игроки' ? visibleData.slice(0,10) : visibleData}
                columns={columns}
                podium={page === 'rating' && ['Рейтинг Команд','Рейтинг Игроков'].includes(subtab)}
                empty={emptyMessage(page,subtab)}
                onEdit={crudEntity ? row => { setActionMessage(''); setCrudDialog({ entity: crudEntity, row, fields: crudFields }); } : null}
                onDelete={crudEntity ? deleteRow : null}
                canEdit={row => !(crudEntity === 'matches' && row.completed)}
                canDelete={row => !(crudEntity === 'matches' && row.completed)}
                onComplete={page === 'matches' ? completeMatch : null}
                canComplete={row => Boolean(!row.completed && row.homeTeamId && row.awayTeamId && row.homeTeamId !== row.awayTeamId && row.homeScore !== null && row.homeScore !== undefined && row.awayScore !== null && row.awayScore !== undefined && Number.isInteger(Number(row.homeScore)) && Number.isInteger(Number(row.awayScore)) && Number(row.homeScore) >= 0 && Number(row.awayScore) >= 0 && Number(row.homeScore) !== Number(row.awayScore))}
                sortColumn={tableSort.column}
                sortDirection={tableSort.direction}
                onSort={column => setTableSort(current => ({
                  column,
                  direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc'
                }))}
              />
            )}
            {page === 'info' && subtab === 'Витрина достижений' && !loading && (
              <ShowcaseLinksPanel
                showcases={data}
                onChanged={async () => {
                  setActionMessage('Связи достижений обновлены.');
                  await load();
                }}
              />
            )}
          </section>}
        </>}
        <footer>Red Alert Tournament Manager <span>· независимая версия</span></footer>
      </div>
    </main>
    {teamAnalytics && <div className="modal-backdrop" onClick={() => setTeamAnalytics(null)}><div className="modal currency-detail-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h2>Аналитика команды: {teamAnalytics.name}</h2><button className="icon-btn" onClick={() => setTeamAnalytics(null)}><X size={18}/></button></div>
      <div className="currency-detail-grid">{[['Сыграно игр',Number(teamAnalytics.wins||0)+Number(teamAnalytics.losses||0)],['Очки',teamAnalytics.points||0],['MMR',Number(teamAnalytics.points||0)*2],['Победы',teamAnalytics.wins||0],['Поражения',teamAnalytics.losses||0],['Уровень',teamAnalytics.level||0],['Лучшая карта',teamAnalytics.bestMap||'—'],['Худшая карта',teamAnalytics.worstMap||'—']].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="muted">MMR отображается по формуле из предоставленного образца: очки команды × 2.</p>
    </div></div>}
    {crudDialog && <CrudDialog entity={crudDialog.entity} row={crudDialog.row} fields={crudDialog.fields} onClose={() => setCrudDialog(null)} onSaved={async message => { setCrudDialog(null); setActionMessage(message); await load(); }}/>}
  </div>;

  async function completeMatch(row) {
    const ready = row.homeTeamId && row.awayTeamId && row.homeTeamId !== row.awayTeamId &&
      row.homeScore !== null && row.homeScore !== undefined &&
      row.awayScore !== null && row.awayScore !== undefined &&
      Number.isInteger(Number(row.homeScore)) && Number.isInteger(Number(row.awayScore)) && Number(row.homeScore) >= 0 && Number(row.awayScore) >= 0 &&
      Number(row.homeScore) !== Number(row.awayScore) && !row.completed;
    if (!ready) {
      setActionMessage('Для завершения укажите две разные команды и счёт с победителем.');
      return;
    }
    const winnerName = Number(row.homeScore) > Number(row.awayScore) ? row.homeTeam : row.awayTeam;
    if (!window.confirm('Завершить матч и начислить статистику? Победитель: ' + winnerName + '. После фиксации результат нельзя будет изменить или удалить без отдельного отката статистики.')) return;
    try {
      const response = await fetch('/api/matches/' + encodeURIComponent(row.id) + '/complete', { method:'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || ('HTTP ' + response.status));
      setActionMessage('Матч завершён. Победитель: ' + result.winner + '.' + (result.nextMatchAdvanced ? ' Победитель добавлен в следующий матч сетки.' : ''));
      await load();
    } catch (e) {
      setActionMessage('Не удалось завершить матч: ' + e.message);
    }
  }

  async function deleteRow(row) {
    const label = row.name || row.nickname || row.title || row.key || row.id;
    const cascadeWarning = {
      teams: ' ВНИМАНИЕ: удаление команды также удалит связанных игроков.',
      tournaments: ' ВНИМАНИЕ: удаление турнира может удалить связанные матчи и посты победителей.',
      players: ' ВНИМАНИЕ: удаление игрока также удалит связанные рейтинговые матчи и записи статистики карт.',
      maps: ' ВНИМАНИЕ: удаление карты также удалит связанные записи статистики карт.'
    }[crudEntity] || '';
    if (!window.confirm('Удалить запись «' + label + '»? Это действие нельзя отменить.' + cascadeWarning)) return;
    try {
      const response = await fetch('/api/manage/' + crudEntity + '/' + encodeURIComponent(row.id), { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || ('HTTP ' + response.status));
      setActionMessage('Запись удалена.');
      await load();
    } catch (e) {
      setActionMessage('Не удалось удалить запись: ' + e.message);
    }
  }
}

const staticOptions = {
  faction: [{value:'Альянс',label:'Альянс'},{value:'Союз',label:'Союз'},{value:'Империя',label:'Империя'}],
  type: ['Champions League','Grand League','Astra League','Ultimate League','FFA League'].map(value=>({value,label:value})),
  position: ['Игрок','Капитан','Тренер','Менеджер'].map(value=>({value,label:value})),
  boolean: [{value:'0',label:'Нет'},{value:'1',label:'Да'}]
};
function entityFor(page,subtab) {
  if (page==='rating') return subtab==='Рейтинг Команд' ? 'teams' : 'players';
  if (page==='teams') return 'teams';
  if (page==='players') return 'players';
  if (page==='tournaments') return 'tournaments';
  if (page==='matches') return 'matches';
  if (page==='seasons') return 'seasons';
  if (page==='maps' && subtab==='Карты') return 'maps';
  if (page==='maps' && subtab==='Статистика карт') return 'map-stats';
  if (page==='ranks') return 'ranks';
  if (page==='config') return 'config';
  if (page==='info' && subtab==='Информация') return 'news';
  if (page==='info' && subtab==='Достижения') return 'achievements';
  if (page==='info' && subtab==='Медали') return 'medals';
  if (page==='info' && subtab==='Посты победителей') return 'winner-posts';
  if (page==='info' && subtab==='Витрина достижений') return 'achievement-showcase';
  if (page==='league' && subtab==='Информация о лигах') return 'leagues';
  if (page==='league' && subtab==='Рейтинговые матчи') return 'rating-matches';
  if (page==='league' && subtab==='Лучшие игроки') return 'players';
  return null;
}
function fieldsFor(page,subtab) {
  const definitions = {
    teams: [
      {name:'name',label:'Название команды',required:true},{name:'logoUrl',label:'Ссылка на логотип'},
      {name:'points',label:'Очки',type:'number'},{name:'wins',label:'Победы',type:'number'},{name:'losses',label:'Поражения',type:'number'},
      {name:'level',label:'Уровень',type:'number'},{name:'bestMap',label:'Лучшая карта'},{name:'worstMap',label:'Худшая карта'}
    ],
    players: [
      {name:'nickname',label:'Ник игрока',required:true},{name:'faction',label:'Фракция',type:'select',options:'faction',required:true},
      {name:'teamId',label:'Команда',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name',required:true},
      {name:'rankId',label:'Звание',type:'remote',endpoint:'/api/ranks',valueKey:'id',labelKey:'name'},
      {name:'experience',label:'Опыт',type:'number'},{name:'wins',label:'Победы',type:'number'},
      {name:'ratingPoints',label:'Рейтинговые очки',type:'number'},{name:'ratingGames',label:'Рейтинговые игры',type:'number'},
      {name:'ratingWins',label:'Рейтинговые победы',type:'number'},{name:'ratingLosses',label:'Рейтинговые поражения',type:'number'},
      {name:'rpPoints',label:'RP',type:'number'},{name:'rpPeak',label:'Пиковый RP',type:'number'},
      {name:'isTeamCaptain',label:'Капитан команды',type:'select',options:'boolean'},
      {name:'position',label:'Позиция',type:'select',options:'position'},{name:'bestMap',label:'Лучшая карта'},{name:'worstMap',label:'Худшая карта'}
    ],
    tournaments: [
      {name:'name',label:'Название турнира',required:true},{name:'type',label:'Тип турнира',type:'select',options:'type',required:true},
      {name:'description',label:'Описание',type:'textarea'},{name:'imageUrl',label:'Ссылка на изображение'},
      {name:'seasonId',label:'Сезон',type:'remote',endpoint:'/api/seasons',valueKey:'id',labelKey:'name'},
      {name:'seasonNumber',label:'Номер сезона'},{name:'winnerId',label:'Команда-победитель',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name'},{name:'winnerName',label:'Имя победителя / заметка'}
    ],
    matches: [
      {name:'tournamentId',label:'Турнир',type:'remote',endpoint:'/api/tournaments',valueKey:'id',labelKey:'name',required:true},
      {name:'homeTeamId',label:'Команда 1',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name'},
      {name:'awayTeamId',label:'Команда 2',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name'},
      {name:'homeScore',label:'Счёт команды 1',type:'number'},{name:'awayScore',label:'Счёт команды 2',type:'number'},
      {name:'round',label:'Раунд',type:'number'},{name:'map',label:'Карта'},{name:'nextMatchId',label:'Следующий матч',type:'remote',endpoint:'/api/matches',valueKey:'id',labelKey:'matchLabel'}
    ],
    'rating-matches': [
      {name:'player1Id',label:'Игрок 1',type:'remote',endpoint:'/api/players',valueKey:'id',labelKey:'nickname',required:true},
      {name:'player2Id',label:'Игрок 2',type:'remote',endpoint:'/api/players',valueKey:'id',labelKey:'nickname',required:true},
      {name:'scheduledAt',label:'Дата и время',type:'datetime-local',required:true},{name:'map',label:'Карта'},
      {name:'completed',label:'Матч завершён',type:'select',options:'boolean'},
      {name:'winnerId',label:'Победитель',type:'remote',endpoint:'/api/players',valueKey:'id',labelKey:'nickname'}
    ],
    seasons: [
      {name:'name',label:'Название сезона',required:true},{name:'startDate',label:'Начало',type:'datetime-local',required:true},
      {name:'endDate',label:'Окончание',type:'datetime-local'},{name:'isActive',label:'Активен',type:'select',options:'boolean'}
    ],
    maps: [
      {name:'name',label:'Название карты',required:true},{name:'imageUrl',label:'Ссылка на изображение'},
      {name:'description',label:'Описание',type:'textarea'},{name:'playersCount',label:'Количество игроков',type:'number',required:true}
    ],
    'map-stats': [
      {name:'mapName',label:'Название карты в статистике',required:true},
      {name:'mapId',label:'Связанная карта',type:'remote',endpoint:'/api/maps',valueKey:'id',labelKey:'name'},
      {name:'teamId',label:'Команда',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name'},
      {name:'playerId',label:'Игрок',type:'remote',endpoint:'/api/players',valueKey:'id',labelKey:'nickname'},
      {name:'wins',label:'Победы',type:'number',required:true},{name:'losses',label:'Поражения',type:'number',required:true}
    ],
    ranks: [
      {name:'name',label:'Название звания',required:true},{name:'description',label:'Описание',type:'textarea'},
      {name:'imageUrl',label:'Ссылка на эмблему'},{name:'requiredWins',label:'Победы для получения',type:'number',required:true},
      {name:'requiredXP',label:'Опыт для получения',type:'number',required:true}
    ],
    leagues: [
      {name:'name',label:'Название лиги',required:true},{name:'description',label:'Описание',type:'textarea'},
      {name:'imageUrl',label:'Ссылка на эмблему'},{name:'requiredPoints',label:'Минимум очков',type:'number',required:true},
      {name:'orderIndex',label:'Порядок отображения',type:'number',required:true}
    ],
    config: [{name:'key',label:'Ключ параметра',required:true},{name:'value',label:'Значение',required:true},{name:'description',label:'Описание',type:'textarea'}],
    news: [
      {name:'title',label:'Заголовок',required:true},{name:'content',label:'Текст новости',type:'textarea',required:true},
      {name:'relatedTournamentId',label:'Связанный турнир',type:'remote',endpoint:'/api/tournaments',valueKey:'id',labelKey:'name'},
      {name:'relatedMatchId',label:'Связанный матч',type:'remote',endpoint:'/api/matches',valueKey:'id',labelKey:'matchLabel'}
    ],
    medals: [{name:'name',label:'Название медали',required:true},{name:'description',label:'Описание',type:'textarea'},{name:'imageUrl',label:'Ссылка на изображение'}],
    'winner-posts': [
      {name:'tournamentId',label:'Турнир',type:'remote',endpoint:'/api/tournaments',valueKey:'id',labelKey:'name',required:true},
      {name:'teamId',label:'Команда-победитель',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name',required:true},
      {name:'title',label:'Заголовок поста',required:true},{name:'content',label:'Текст поста',type:'textarea',required:true}
    ],
    'achievement-showcase': [
      {name:'name',label:'Название витрины',required:true},{name:'description',label:'Описание',type:'textarea'},{name:'imageUrl',label:'Ссылка на изображение'}
    ],
    achievements: [
      {name:'name',label:'Название достижения',required:true},{name:'description',label:'Описание',type:'textarea'},
      {name:'imageUrl',label:'Ссылка на изображение'},{name:'conditionType',label:'Тип условия'},
      {name:'requiredTournamentType',label:'Требуемый тип турнира',type:'select',options:'type'},
      {name:'teamId',label:'Команда',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name'},
      {name:'playerId',label:'Игрок',type:'remote',endpoint:'/api/players',valueKey:'id',labelKey:'nickname'},
      {name:'tournamentId',label:'Турнир',type:'remote',endpoint:'/api/tournaments',valueKey:'id',labelKey:'name'}
    ]
  };
  return definitions[entityFor(page,subtab)] || [];
}
function CrudDialog({entity,row,fields,onClose,onSaved}) {
  const [values,setValues] = useState(() => {
    const initial = {};
    for (const field of fields) {
      let value = row?.[field.name] ?? '';
      if (field.type==='datetime-local' && value) value = String(value).slice(0,16);
      if (field.type==='select' && field.options==='boolean' && value !== '') value = String(Number(Boolean(value)));
      initial[field.name] = value;
    }
    return initial;
  });
  const [options,setOptions] = useState({});
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let active = true;
    const endpoints = [...new Set(fields.filter(f=>f.type==='remote').map(f=>f.endpoint))];
    Promise.all(endpoints.map(async endpoint => {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Не удалось загрузить варианты для формы.');
      return [endpoint,await response.json()];
    })).then(entries => { if (active) setOptions(Object.fromEntries(entries)); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [fields]);
  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError('');
    const payload = {};
    const nullableFields = new Set(['logoUrl','bestMap','worstMap','description','imageUrl','seasonId','seasonNumber','winnerId','winnerName','homeTeamId','awayTeamId','homeScore','awayScore','map','nextMatchId','simulationLog','endDate','relatedMatchId','relatedTournamentId','teamId','playerId','tournamentId','rankId','requiredTournamentType']);
    for (const field of fields) {
      let value = values[field.name];
      if (value === '' || value === undefined || value === null) {
        if (nullableFields.has(field.name)) payload[field.name] = null;
        continue;
      }
      if (field.type==='number') value = Number(value);
      if (field.type==='select' && field.options==='boolean') value = value === '1';
      if (field.type==='datetime-local') value = new Date(value).toISOString();
      payload[field.name] = value;
    }
    try {
      const response = await fetch('/api/manage/'+entity+(row ? '/'+encodeURIComponent(row.id) : ''), {
        method: row ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить запись.');
      await onSaved(row ? 'Изменения сохранены.' : 'Запись добавлена.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target===event.currentTarget) onClose(); }}>
    <section className="crud-modal" role="dialog" aria-modal="true" aria-label={row ? 'Редактирование записи' : 'Добавление записи'}>
      <div className="modal-head"><h2>{row ? 'Редактировать запись' : 'Добавить запись'}</h2><button type="button" className="icon-btn" onClick={onClose} title="Закрыть"><X size={17}/></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          {fields.map(field => <label className="form-field" key={field.name}><span>{field.label}{field.required ? ' *' : ''}</span>
            {field.type==='textarea' ? <textarea required={field.required} value={values[field.name] ?? ''} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))} rows={3}/>
            : field.type==='select' ? <select required={field.required} value={values[field.name] ?? ''} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}><option value="">— Не выбрано —</option>{(staticOptions[field.options] || []).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : field.type==='remote' ? <select required={field.required} value={values[field.name] ?? ''} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}><option value="">— Не выбрано —</option>{(options[field.endpoint] || []).map(option=><option key={option[field.valueKey]} value={option[field.valueKey]}>{option[field.labelKey]}</option>)}</select>
            : <input required={field.required} type={field.type || 'text'} value={values[field.name] ?? ''} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}/>}
          </label>)}
        </div>
        {error && <div className="error"><CircleAlert size={16}/>{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Отмена</button><button type="submit" className="primary" disabled={saving}><Save size={16}/>{saving?'Сохранение…':'Сохранить'}</button></div>
      </form>
    </section>
  </div>;
}

function CurrencyDashboard() {
  const [mode,setMode] = useState('players');
  const [playerSort,setPlayerSort] = useState({key:'totalIncome',direction:'desc'});
  const [teamSort,setTeamSort] = useState({key:'totalIncome',direction:'desc'});
  const [players,setPlayers] = useState([]);
  const [teams,setTeams] = useState([]);
  const [rules,setRules] = useState({});
  const [ruleRows,setRuleRows] = useState([]);
  const [editingRules,setEditingRules] = useState(false);
  const [ruleValues,setRuleValues] = useState({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [details,setDetails] = useState(null);
  const [marketValue,setMarketValue] = useState('');
  const [forecast,setForecast] = useState('');
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState('');
  async function loadCurrency() {
    setLoading(true);setError('');
    try {
      const response=await fetch('/api/currency');
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Не удалось загрузить финансовые данные.');
      setPlayers(Array.isArray(body.players)?body.players:[]);
      setTeams(Array.isArray(body.teams)?body.teams:[]);
      setRules(body.rules||{});
      setRuleRows(Array.isArray(body.configRows)?body.configRows:[]);
    } catch(e) {setError(e.message||'Ошибка загрузки финансовых данных.');}
    finally {setLoading(false);}
  }
  useEffect(()=>{loadCurrency();},[]);
  const money=value=>value===null||value===undefined||value===''?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value));
  const shortMoney=value=>value===null||value===undefined||value===''?'Не задано':Number(value)>=1000000?(Number(value)/1000000).toLocaleString('ru-RU',{maximumFractionDigits:2})+' млн $':money(value);
  const openDetails=(kind,row)=>{
    setDetails({kind,row});
    setMarketValue(row.marketValueUSD===null||row.marketValueUSD===undefined?'':String(row.marketValueUSD));
    setForecast(row.forecastUSD===null||row.forecastUSD===undefined?'':String(row.forecastUSD));
    setMessage('');
  };
  function openRuleEditor() {
    setRuleValues(Object.fromEntries(ruleRows.map(row=>[row.key,String(row.value??'0')])));
    setEditingRules(true);setError('');setMessage('');
  }
  async function saveCurrencyRules(event) {
    event.preventDefault();setSaving(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/currency/rules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:ruleValues})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Не удалось сохранить правила доходов.');
      setEditingRules(false);
      await loadCurrency();
      setMessage('Правила расчёта сохранены.');
    } catch(e){setError(e.message||'Не удалось сохранить правила расчёта.');}
    finally{setSaving(false);}
  }
  async function saveValuation(event) {
    event.preventDefault();
    if(!details)return;
    setSaving(true);setError('');setMessage('');
    try {
      const endpoint=details.kind==='players'?'/api/currency/players/':'/api/currency/teams/';
      const response=await fetch(endpoint+encodeURIComponent(details.row.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({marketValueUSD:marketValue===''?null:Number(marketValue),forecastUSD:forecast===''?null:Number(forecast)})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Не удалось сохранить оценку игрока.');
      await loadCurrency();
      setDetails(current=>current?{...current,row:{...current.row,marketValueUSD:body.marketValueUSD,forecastUSD:body.forecastUSD}}:null);
      setMessage('Стоимость и прогноз сохранены.');
    } catch(e){setError(e.message||'Не удалось сохранить финансовую оценку.');}
    finally{setSaving(false);}
  }
  if(loading)return <div className="empty-state">Загрузка финансовых данных…</div>;
  const sortRows=(rows,sort)=>[...rows].sort((a,b)=>{
    const av=a[sort.key],bv=b[sort.key];
    let result;
    if(av===null||av===undefined||av==='')result=bv===null||bv===undefined||bv===''?0:-1;
    else if(bv===null||bv===undefined||bv==='')result=1;
    else if(typeof av==='string'||typeof bv==='string')result=String(av).localeCompare(String(bv),'ru',{numeric:true,sensitivity:'base'});
    else result=Number(av)-Number(bv);
    return sort.direction==='desc'?-result:result;
  });
  const playerRows=sortRows(players,playerSort);
  const teamRows=sortRows(teams,teamSort);
  const playerHeaders=[['Игрок','nickname'],['Команда','teamName'],['Рейт. игры','ratingGames'],['Поб/Пор','ratingWins'],['Рейтинг (win/loss)','matchIncome'],['Турниры','tournamentIncome'],['Итого','totalIncome'],['Стоимость игрока','marketValueUSD'],['Прогноз','forecastUSD'],['Аналитика',null]];
  const teamHeaders=[['Команда','name'],['Победы','wins'],['Очки','points'],['Уровень','level'],['Доходы (матчи/чемпионы/доля)','totalIncome'],['Итого','totalIncome'],['Стоимость','marketValueUSD'],['Прогноз','forecastUSD'],['Аналитика',null]];
  const currentSort=mode==='players'?playerSort:teamSort;
  const toggleSort=key=>{
    if(!key)return;
    const setter=mode==='players'?setPlayerSort:setTeamSort;
    setter(current=>({key,direction:current.key===key&&current.direction==='desc'?'asc':'desc'}));
  };
  return <div className="currency-dashboard">
    <div className="tabs currency-tabs"><button className={mode==='players'?'selected':''} onClick={()=>setMode('players')}>Игроки</button><button className={mode==='teams'?'selected':''} onClick={()=>setMode('teams')}>Команды</button></div>
    {error&&<div className="error"><CircleAlert size={18}/>{error}</div>}
    <section className="currency-table-card">
      <div className="currency-table-heading"><div><h3>{mode==='players'?'Финансовое состояние игроков':'Финансовое состояние команд'}</h3><p className="muted">Доходы пересчитываются из результатов рейтинговых матчей и побед в турнирах. Стоимость и прогноз сохраняются отдельно.</p></div><span>{mode==='players'?playerRows.length:teamRows.length} записей</span></div>
      <div className="table-wrap"><table className="data-table currency-data-table">
        <thead><tr>{(mode==='players'?playerHeaders:teamHeaders).map(([label,key])=><th key={label}>{key?<button type="button" className="sortable-header" onClick={()=>toggleSort(key)}>{label}<span aria-hidden="true">{currentSort.key===key?(currentSort.direction==='asc'?' ↑':' ↓'):' ↕'}</span></button>:label}</th>)}</tr></thead>
        <tbody>{(mode==='players'?playerRows:teamRows).map(row=>{
          if(mode==='players')return <tr key={row.id}>
            <td><span className="currency-player-name"><span className={'player-faction-dot '+(String(row.faction||'').includes('Союз')?'faction-red':String(row.faction||'').includes('Альянс')?'faction-blue':String(row.faction||'').includes('Империя')?'faction-yellow':'faction-neutral')}>●</span>{row.nickname}</span></td>
            <td>{row.teamName||'—'}</td><td>{row.ratingGames}</td><td>{Number(row.ratingWins||0)}/{Number(row.ratingLosses||0)}</td>
            <td>{money(row.matchIncome)} / {money(0)}</td><td>{money(row.tournamentIncome)}</td><td><strong>{money(row.totalIncome)}</strong></td><td>{shortMoney(row.marketValueUSD)}</td><td>{shortMoney(row.forecastUSD)}</td>
            <td><button className="ranked-secondary currency-analytics-btn" onClick={()=>openDetails('players',row)}>Аналитика</button></td>
          </tr>;
          return <tr key={row.id}><td>{row.name}</td><td>{row.wins||0}</td><td>{row.points||0}</td><td>{row.level||0}</td>
            <td>{money(row.matchIncome)} / {money(row.tournamentIncome)} / {money(row.shareIncome)}</td><td><strong>{money(row.totalIncome)}</strong></td><td>{shortMoney(row.marketValueUSD)}</td><td>{shortMoney(row.forecastUSD)}</td>
            <td><button className="ranked-secondary currency-analytics-btn" onClick={()=>openDetails('teams',row)}>Аналитика</button></td></tr>;
        })}</tbody>
      </table></div>
      {!(mode==='players'?playerRows:teamRows).length&&<div className="empty-state">Нет записей для отображения.</div>}
    </section>
    <section className="currency-config-card">
      <div className="currency-table-heading"><div><h3>Правила расчёта доходов</h3><p className="muted">Изменение правил сразу влияет на доходы игроков и команд.</p></div><button className="ranked-secondary" onClick={openRuleEditor}>Изменить правила</button></div>
      <div className="currency-rules-grid">
        <div><span>Победа игрока</span><strong>{money(rules.playerWinReward)}</strong></div>
        <div><span>Доплата капитану</span><strong>{money(rules.captainBonus)}</strong></div>
        <div><span>Победа команды</span><strong>{money(rules.teamWinReward)}</strong></div>
        <div><span>Доля команды от доходов игроков</span><strong>{rules.teamSharePercent??0}%</strong></div>
      </div>
      <p className="currency-missing">Призы Champions League и Grand League начисляются по отдельным правилам турниров. Для типов турниров без настроенного приза начисление равно 0, пока не будет добавлено правило в GameConfig. Стоимость игрока и прогноз можно указать в «Аналитике» — они сохраняются в базе.</p>
    </section>
    {editingRules&&<div className="modal-backdrop" onClick={()=>setEditingRules(false)}><section className="crud-modal currency-rules-modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Правила расчёта доходов">
      <div className="modal-head"><h2>Правила расчёта доходов</h2><button className="icon-btn" onClick={()=>setEditingRules(false)}><X size={18}/></button></div>
      <form onSubmit={saveCurrencyRules}>
        <div className="currency-rule-editor-list">{ruleRows.map(row=><label className="form-field" key={row.key}><span>{row.description||row.key}<small>{row.key}</small></span><input type="number" min="0" step="any" required value={ruleValues[row.key]??''} onChange={e=>setRuleValues(current=>({...current,[row.key]:e.target.value}))}/></label>)}</div>
        <p className="muted">Доходы от матчей, призовые за турниры и доля команды пересчитываются по этим значениям. Нулевой приз означает, что для такого типа турнира не задано начисление.</p>
        <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setEditingRules(false)}>Отмена</button><button type="submit" className="primary" disabled={saving}>{saving?'Сохранение…':'Сохранить правила'}</button></div>
      </form>
    </section></div>}
    {details&&<div className="modal-backdrop" onClick={()=>setDetails(null)}><section className="crud-modal currency-detail-modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Финансовая аналитика">
      <div className="modal-head"><h2>Аналитика: {details.kind==='players'?details.row.nickname:details.row.name}</h2><button className="icon-btn" onClick={()=>setDetails(null)}><X size={18}/></button></div>
      {details.kind==='players'?<>
        <div className="currency-detail-grid">
          <div><span>Доход от рейтинговых побед</span><strong>{money(details.row.matchIncome)}</strong></div>
          <div><span>Доход от турниров</span><strong>{money(details.row.tournamentIncome)}</strong></div>
          <div><span>Общий доход</span><strong>{money(details.row.totalIncome)}</strong></div>
          <div><span>Рейтинговые игры</span><strong>{details.row.ratingGames}</strong></div>
          <div><span>Победы / поражения</span><strong>{details.row.ratingWins} / {details.row.ratingLosses}</strong></div>
          <div><span>Команда</span><strong>{details.row.teamName||'—'}</strong></div>
        </div>
        <h3 className="currency-subheading">Турнирные начисления</h3>
        {details.row.tournamentTitles?.length?<div className="currency-title-list">{details.row.tournamentTitles.map(tournament=><div key={tournament.id}><span>{tournament.name} · {tournament.type}</span><strong>{money(tournament.prizeUSD)}</strong></div>)}</div>:<p className="muted">У команды игрока нет сохранённых побед в турнирах.</p>}
        <form onSubmit={saveValuation} className="currency-valuation-form">
          <h3>Стоимость и прогноз</h3>
          <p className="muted">Укажи подтверждённые значения. Они сохранятся в SQL и будут учитываться в общей стоимости команды.</p>
          <div className="form-grid">
            <label className="form-field"><span>Стоимость игрока, USD</span><input type="number" min="0" step="1" value={marketValue} onChange={e=>setMarketValue(e.target.value)} placeholder="Например, 6730000"/></label>
            <label className="form-field"><span>Прогноз, USD</span><input type="number" min="0" step="1" value={forecast} onChange={e=>setForecast(e.target.value)} placeholder="Например, 8750000"/></label>
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={()=>{setMarketValue('');setForecast('');}}>Очистить значения</button><button className="primary" type="submit" disabled={saving}>{saving?'Сохранение…':'Сохранить'}</button></div>
        </form>
      </>:<>
        <div className="currency-detail-grid">
          <div><span>Доход от матчей</span><strong>{money(details.row.matchIncome)}</strong></div>
          <div><span>Доход от чемпионств</span><strong>{money(details.row.tournamentIncome)}</strong></div>
          <div><span>Доля от доходов игроков</span><strong>{money(details.row.shareIncome)}</strong></div>
          <div><span>Итого</span><strong>{money(details.row.totalIncome)}</strong></div>
          <div><span>Игроков в команде</span><strong>{details.row.playerCount}</strong></div>
          <div><span>Стоимость команды</span><strong>{shortMoney(details.row.marketValueUSD)}</strong></div>
        </div>
        <h3 className="currency-subheading">Состав команды</h3>
        <div className="currency-title-list">{details.row.players.map(player=><div key={player.id}><span>{player.nickname}</span><strong>{money(player.totalIncome)}</strong></div>)}</div>
        <form onSubmit={saveValuation} className="currency-valuation-form">
          <h3>Стоимость команды и прогноз</h3>
          <p className="muted">Значения восстановлены из Screenshot2.pdf. Их можно изменить, и они сохранятся отдельно от стоимости игроков.</p>
          <div className="form-grid">
            <label className="form-field"><span>Стоимость команды, USD</span><input type="number" min="0" step="1" value={marketValue} onChange={e=>setMarketValue(e.target.value)} placeholder="Стоимость команды"/></label>
            <label className="form-field"><span>Прогноз, USD</span><input type="number" min="0" step="1" value={forecast} onChange={e=>setForecast(e.target.value)} placeholder="Прогноз"/></label>
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={()=>{setMarketValue('');setForecast('');}}>Очистить значения</button><button className="primary" type="submit" disabled={saving}>{saving?'Сохранение…':'Сохранить'}</button></div>
        </form>
      </>}
      {message&&<div className="success-message">{message}</div>}
      {error&&<div className="error">{error}</div>}
    </section></div>}
  </div>;
}

function SimulatorPanel({onComplete}) {
  const [teams,setTeams] = useState([]);
  const [tournaments,setTournaments] = useState([]);
  const [maps,setMaps] = useState([]);
  const [team1Id,setTeam1Id] = useState('');
  const [team2Id,setTeam2Id] = useState('');
  const [tournamentId,setTournamentId] = useState('');
  const [map,setMap] = useState('');
  const [prob1,setProb1] = useState('50');
  const [prob2,setProb2] = useState('50');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    Promise.all(['/api/teams','/api/tournaments','/api/maps'].map(url => fetch(url).then(r => {
      if (!r.ok) throw new Error('Не удалось загрузить списки команд, турниров и карт.');
      return r.json();
    }))).then(([teamRows,tournamentRows,mapRows]) => {
      setTeams(teamRows); setTournaments(tournamentRows); setMaps(mapRows);
    }).catch(e => setError(e.message));
  }, []);
  async function run(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/simulations/run', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({team1Id,team2Id,tournamentId:tournamentId || null,map,prob1:Number(prob1),prob2:Number(prob2)})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось провести симуляцию.');
      await onComplete(result.result.winner);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="simulator-box">
    <h3>Новая симуляция матча</h3>
    <p className="muted">Выберите команды и вероятности победы. Результат будет сохранён в таблице Simulation.</p>
    <form onSubmit={run}>
      <div className="form-grid">
        <label className="form-field"><span>Команда 1 *</span><select required value={team1Id} onChange={e=>setTeam1Id(e.target.value)}><option value="">— Выберите команду —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="form-field"><span>Команда 2 *</span><select required value={team2Id} onChange={e=>setTeam2Id(e.target.value)}><option value="">— Выберите команду —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="form-field"><span>Турнир (необязательно)</span><select value={tournamentId} onChange={e=>setTournamentId(e.target.value)}><option value="">— Без турнира —</option>{tournaments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="form-field"><span>Карта</span><select value={map} onChange={e=>setMap(e.target.value)}><option value="">— Не выбрана —</option>{maps.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}</select></label>
        <label className="form-field"><span>Вероятность победы команды 1 (%) *</span><input required type="number" min="0" max="100" value={prob1} onChange={e=>setProb1(e.target.value)}/></label>
        <label className="form-field"><span>Вероятность победы команды 2 (%) *</span><input required type="number" min="0" max="100" value={prob2} onChange={e=>setProb2(e.target.value)}/></label>
      </div>
      {error && <div className="error"><CircleAlert size={16}/>{error}</div>}
      <div className="modal-actions"><button className="primary" type="submit" disabled={busy || !teams.length}>{busy?'Симуляция…':'Провести симуляцию'}</button></div>
    </form>
  </div>;
}

function RatingMatchesTable({rows,onComplete}) {
  const [busyId,setBusyId] = useState('');
  const [error,setError] = useState('');
  const [view,setView] = useState('upcoming');
  const [details,setDetails] = useState(null);
  async function complete(match,winnerId) {
    const winner = winnerId===match.player1Id ? match.player1 : match.player2;
    if (!window.confirm('Зафиксировать победу игрока '+winner+'? Рейтинги и статистика будут изменены.')) return;
    setBusyId(match.id); setError('');
    try {
      const response = await fetch('/api/rating-matches/'+encodeURIComponent(match.id)+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winnerId})});
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || 'Не удалось завершить рейтинговый матч.');
      await onComplete?.();
      return true;
    } catch(e) { setError(e.message); return false; }
    finally { setBusyId(''); }
  }
  const upcoming = rows.filter(match=>!match.completed).sort((a,b)=>String(a.scheduledAt||'').localeCompare(String(b.scheduledAt||'')));
  const history = rows.filter(match=>Boolean(match.completed)).sort((a,b)=>String(b.scheduledAt||'').localeCompare(String(a.scheduledAt||'')));
  const displayed = (view==='upcoming'?upcoming:history).slice(0,20);
  const factionDotClass = value => {
    const v=String(value||'').toLowerCase();
    if(v.includes('союз')||v.includes('soviet'))return 'faction-red';
    if(v.includes('альянс')||v.includes('allied')||v.includes('allies'))return 'faction-blue';
    if(v.includes('импер')||v.includes('empire'))return 'faction-yellow';
    return 'faction-neutral';
  };
  const formatDate = value => value ? new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  return <div className="rating-matches-table-panel">
    <div className="rating-match-view-tabs">
      <button className={view==='upcoming'?'selected':''} onClick={()=>setView('upcoming')}>Ближайшие матчи <span>{upcoming.length}</span></button>
      <button className={view==='history'?'selected':''} onClick={()=>setView('history')}>История результатов <span>{history.length}</span></button>
    </div>
    {error && <div className="error"><CircleAlert size={16}/>{error}</div>}
    {!displayed.length ? <div className="empty-state">{view==='upcoming'?'Предстоящих рейтинговых матчей нет. Используйте «Найти соперника» или «Провести 20 матчей».':'Завершённых рейтинговых матчей пока нет.'}</div> :
      <div className="table-wrap"><table className="data-table ranked-matches-data-table">
        <thead><tr><th>Время</th><th>Игрок 1</th><th>Игрок 2</th><th>Карта</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>{displayed.map(match=><tr key={match.id}>
          <td className="ranked-match-date">{formatDate(match.scheduledAt)}</td>
          <td><div className="ranked-match-player"><span className={'player-faction-dot '+factionDotClass(match.player1Faction)}>●</span><strong>{match.player1||'Неизвестен'}</strong></div><small className="ranked-match-team">{match.player1Team||'Без команды'}</small></td>
          <td><div className="ranked-match-player"><span className={'player-faction-dot '+factionDotClass(match.player2Faction)}>●</span><strong>{match.player2||'Неизвестен'}</strong></div><small className="ranked-match-team">{match.player2Team||'Без команды'}</small></td>
          <td>{match.map||'—'}</td>
          <td><span className={match.completed?'match-status-completed':'match-status-pending'}>{match.completed?'Завершён':'Ожидается'}</span>{match.completed&&match.winner?<small className="ranked-match-winner">Победил {match.winner}</small>:null}</td>
          <td><div className="ranked-match-row-actions">
            <button type="button" className="ranked-secondary" onClick={()=>setDetails(match)}>Подробнее</button>
            {!match.completed&&<><button type="button" className="ranked-secondary" disabled={Boolean(busyId)} onClick={()=>complete(match,match.player1Id)}>{busyId===match.id?'Сохранение…':'Победил '+(match.player1||'игрок 1')}</button><button type="button" className="ranked-secondary" disabled={Boolean(busyId)} onClick={()=>complete(match,match.player2Id)}>{busyId===match.id?'Сохранение…':'Победил '+(match.player2||'игрок 2')}</button></>}
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    {(view==='upcoming'?upcoming:history).length>20&&<p className="muted ranked-match-count-note">Показаны первые 20 из {(view==='upcoming'?upcoming:history).length} матчей.</p>}
    {details&&<div className="modal-backdrop" onClick={()=>setDetails(null)}><section className="crud-modal ranked-match-details" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Подробности рейтингового матча">
      <div className="modal-head"><h2>Рейтинговый матч</h2><button type="button" className="icon-btn" onClick={()=>setDetails(null)}><X size={17}/></button></div>
      <div className="ranked-match-detail-versus">
        <div><span className={'player-faction-dot '+factionDotClass(details.player1Faction)}>●</span><h3>{details.player1||'Неизвестен'}</h3><p>{details.player1Team||'Без команды'}</p><span>RP: {details.player1RP??0} · MMR: {details.player1MMR??0}</span><p><FactionName value={details.player1Faction}/></p></div>
        <strong className="ranked-match-vs">VS</strong>
        <div><span className={'player-faction-dot '+factionDotClass(details.player2Faction)}>●</span><h3>{details.player2||'Неизвестен'}</h3><p>{details.player2Team||'Без команды'}</p><span>RP: {details.player2RP??0} · MMR: {details.player2MMR??0}</span><p><FactionName value={details.player2Faction}/></p></div>
      </div>
      <div className="currency-detail-grid"><div><span>Дата и время</span><strong>{formatDate(details.scheduledAt)}</strong></div><div><span>Карта</span><strong>{details.map||'—'}</strong></div><div><span>Статус</span><strong>{details.completed?'Завершён':'Ожидается'}</strong></div><div><span>Победитель</span><strong>{details.winner||'Не определён'}</strong></div></div>
      {!details.completed&&<div className="modal-actions"><button className="primary" onClick={async()=>{if(await complete(details,details.player1Id))setDetails(null);}}>Победа {details.player1}</button><button className="primary" onClick={async()=>{if(await complete(details,details.player2Id))setDetails(null);}}>Победа {details.player2}</button></div>}
    </section></div>}
  </div>;
}

function FactionStatsPanel({rows}) {
  const [players,setPlayers] = useState([]);
  const [ratingMatches,setRatingMatches] = useState([]);
  useEffect(() => {
    let active=true;
    fetch('/api/players').then(async response=>{const body=await response.json();if(!response.ok)throw new Error('Не удалось загрузить игроков.');if(active)setPlayers(Array.isArray(body)?body:[]);})
      .catch(()=>{if(active)setPlayers([]);});
    return ()=>{active=false;};
  },[]);
  useEffect(() => {
    let active=true;
    fetch('/api/rating-matches').then(async response=>{const body=await response.json();if(!response.ok)throw new Error('Не удалось загрузить историю рейтинговых матчей.');if(active)setRatingMatches(Array.isArray(body)?body:[]);})
      .catch(()=>{if(active)setRatingMatches([]);});
    return ()=>{active=false;};
  },[]);
  const totalWins=rows.reduce((sum,row)=>sum+Number(row.wins||0),0);
  const totalLosses=rows.reduce((sum,row)=>sum+Number(row.losses||0),0);
  const factions=rows.map(row=>{
    const wins=Number(row.wins||0),losses=Number(row.losses||0),games=wins+losses;
    return {...row,games,winRate:games?Math.round(wins/games*100):0,share:totalWins?Math.round(wins/totalWins*100):0};
  }).sort((a,b)=>b.wins-a.wins);
  const normalizeFaction = value => {
    const v=String(value||'').trim().toLowerCase();
    if(v.includes('альянс')||v.includes('allied')||v.includes('allies'))return 'Альянс';
    if(v.includes('союз')||v.includes('soviet'))return 'Союз';
    if(v.includes('импер')||v.includes('empire'))return 'Империя';
    return '';
  };
  const factionOrder = {'Альянс':0,'Империя':1,'Союз':2};
  const playerById = new Map(players.map(player=>[player.id,player]));
  const matchupMap = new Map();
  ratingMatches.filter(match=>Boolean(match.completed)&&match.winnerId).forEach(match=>{
    const p1=playerById.get(match.player1Id),p2=playerById.get(match.player2Id);
    const f1=normalizeFaction(p1?.faction),f2=normalizeFaction(p2?.faction);
    if(!f1||!f2||f1===f2)return;
    const [first,second]=[f1,f2].sort((x,y)=>factionOrder[x]-factionOrder[y]);
    const key=first+'|'+second;
    if(!matchupMap.has(key))matchupMap.set(key,{first,second,matches:0,firstWins:0,secondWins:0});
    const item=matchupMap.get(key);item.matches++;
    const winnerFaction=match.winnerId===p1?.id?f1:match.winnerId===p2?.id?f2:'';
    if(winnerFaction===first)item.firstWins++;
    else if(winnerFaction===second)item.secondWins++;
    else item.matches--;
  });
  const matchups=[...matchupMap.values()].filter(item=>item.matches>0).sort((a,b)=>factionOrder[a.first]-factionOrder[b.first]||factionOrder[a.second]-factionOrder[b.second]);
  if(!rows.length) return <div className="empty-state">Статистика фракций пока отсутствует в базе.</div>;
  return <div className="faction-dashboard">
    <div className="faction-overview-grid">
      <div className="map-stat-card"><span>Всего матчей по статистике</span><strong>{totalWins}</strong></div>
      <div className="map-stat-card"><span>Побед по фракциям</span><div className="faction-summary-lines">{factions.map(row=><div key={row.faction}><FactionName value={row.faction}/><strong>{row.wins||0}</strong></div>)}</div></div>
      <div className="map-stat-card"><span>Поражений по фракциям</span><div className="faction-summary-lines">{factions.map(row=><div key={row.faction}><FactionName value={row.faction}/><strong>{row.losses||0}</strong></div>)}</div></div>
    </div>
    <div className="faction-comparison">{factions.map((faction,index)=>{
      const top=players.filter(player=>player.faction===faction.faction).sort((a,b)=>Number(b.rpPoints||0)-Number(a.rpPoints||0)).slice(0,3);
      return <section className="faction-card" key={faction.faction}><div className="faction-card-head"><div><span className="faction-index">0{index+1}</span><h3><FactionName value={faction.faction}/></h3></div><strong>{faction.winRate}% <small>побед</small></strong></div>
        <div className="faction-meter"><span style={{width:faction.winRate+'%'}}/></div>
        <div className="faction-metrics"><div><span>Победы</span><strong>{faction.wins||0}</strong></div><div><span>Поражения</span><strong>{faction.losses||0}</strong></div><div><span>Доля побед</span><strong>{faction.share}%</strong></div><div><span>Средний RP</span><strong>{faction.averageRP??0}</strong></div></div>
        <h4>Лучшие игроки по RP</h4>
        {top.length ? top.map((player,i)=><div className="faction-player" key={player.id}><span>{i+1}</span><strong>{player.nickname}</strong><small>{player.rpPoints??0} RP</small></div>) : <p className="muted">Игроки этой фракции не найдены.</p>}
      </section>;
    })}</div>
    <section className="faction-detail-table panel">
      <h3>Лучшие игроки фракций</h3>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Фракция</th><th>Игрок</th><th>Команда</th><th>RP</th><th>Звание</th></tr></thead><tbody>
        {factions.map(faction=>players.filter(player=>String(player.faction||'').toLowerCase()===String(faction.faction||'').toLowerCase()).sort((a,b)=>Number(b.rpPoints||0)-Number(a.rpPoints||0)).slice(0,1).map(player=><tr key={faction.faction}><td><FactionName value={faction.faction}/></td><td>{player.nickname}</td><td>{player.teamName||'—'}</td><td>{player.rpPoints??0}</td><td>{player.rankName||'—'}</td></tr>))}
      </tbody></table></div>
    </section>
    <section className="faction-detail-table panel">
      <h3>Исход встреч фракций</h3>
      <p className="muted">Результаты рассчитаны по завершённым рейтинговым матчам и текущим фракциям игроков. Если игрок менял фракцию, историческая принадлежность может отличаться.</p>
      {matchups.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Пара фракций</th><th>Матчи</th><th>Победы первой</th><th>Победы второй</th><th>Винрейт (первая/вторая)</th></tr></thead><tbody>{matchups.map(item=>{const decided=item.firstWins+item.secondWins;return <tr key={item.first+'|'+item.second}><td><FactionName value={item.first}/> vs <FactionName value={item.second}/></td><td>{item.matches}</td><td>{item.firstWins}</td><td>{item.secondWins}</td><td>{decided?Math.round(item.firstWins/decided*100):0}% / {decided?Math.round(item.secondWins/decided*100):0}%</td></tr>;})}</tbody></table></div> : <p className="muted">Нет завершённых рейтинговых матчей с известными фракциями обоих участников.</p>}
    </section>
    <p className="muted">Суммарные показатели взяты из статистики игроков; очные встречи рассчитаны из сохранённых результатов матчей.</p>
  </div>;
}

function MapStatsPanel({rows}) {
  const [catalogMaps,setCatalogMaps] = useState([]);
  const [matchRows,setMatchRows] = useState([]);
  const [rosterPlayers,setRosterPlayers] = useState([]);
  useEffect(() => {
    let active=true;
    fetch('/api/maps').then(async response=>{const body=await response.json();if(!response.ok)throw new Error('Не удалось загрузить каталог карт.');if(active)setCatalogMaps(Array.isArray(body)?body:[]);})
      .catch(()=>{if(active)setCatalogMaps([]);});
    return ()=>{active=false;};
  },[]);
  useEffect(() => {
    let active=true;
    fetch('/api/players').then(async response=>{const body=await response.json();if(!response.ok)throw new Error('Не удалось загрузить игроков.');if(active)setRosterPlayers(Array.isArray(body)?body:[]);})
      .catch(()=>{if(active)setRosterPlayers([]);});
    return ()=>{active=false;};
  },[]);
  useEffect(() => {
    let active=true;
    fetch('/api/matches').then(async response=>{const body=await response.json();if(!response.ok)throw new Error('Не удалось загрузить результаты матчей.');if(active)setMatchRows(Array.isArray(body)?body:[]);})
      .catch(()=>{if(active)setMatchRows([]);});
    return ()=>{active=false;};
  },[]);
  const mapNames = [...new Set([...catalogMaps.map(map=>map.name),...rows.map(row => row.map || row.mapName),...matchRows.map(match=>match.map)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  const [selectedMap,setSelectedMap] = useState('');
  useEffect(() => {
    if (!mapNames.includes(selectedMap)) setSelectedMap(mapNames[0] || '');
  }, [mapNames.join('|')]);
  const selectedRows = rows.filter(row => (row.map || row.mapName) === selectedMap);
  const totals = selectedRows.reduce((acc,row) => {
    acc.wins += Number(row.wins || 0);
    acc.losses += Number(row.losses || 0);
    return acc;
  },{wins:0,losses:0});
  const players = selectedRows.filter(row=>row.playerName).reduce((acc,row)=>{
    const key=row.playerId || row.playerName;
    if(!acc.has(key)) acc.set(key,{name:row.playerName,team:row.teamName||'—',wins:0,losses:0});
    const item=acc.get(key); item.wins+=Number(row.wins||0); item.losses+=Number(row.losses||0);
    return acc;
  },new Map());
  const bestWins=[...players.values()].sort((a,b)=>b.wins-a.wins || a.losses-b.losses).slice(0,3);
  const mostLosses=[...players.values()].sort((a,b)=>b.losses-a.losses || a.wins-b.wins).slice(0,5);
  const playerFaction = new Map(rosterPlayers.map(player=>[player.id,player.faction]));
  const factionStats = selectedRows.reduce((acc,row)=>{
    const faction=playerFaction.get(row.playerId);
    if(!faction)return acc;
    const key=String(faction);
    if(!acc.has(key))acc.set(key,{faction:key,wins:0,losses:0});
    const item=acc.get(key);item.wins+=Number(row.wins||0);item.losses+=Number(row.losses||0);
    return acc;
  },new Map());
  const factionRows=[...factionStats.values()].sort((a,b)=>b.wins-a.wins);
  const completedMapMatches=matchRows.filter(match=>Boolean(match.completed) && String(match.map||'')===selectedMap);
  const homeWins=completedMapMatches.filter(match=>Number(match.homeScore)>Number(match.awayScore)).length;
  const awayWins=completedMapMatches.filter(match=>Number(match.awayScore)>Number(match.homeScore)).length;
  const totalGames=totals.wins;
  if(!mapNames.length) return <div className="empty-state">Каталог карт пуст. Добавьте карты в разделе «Карты».</div>;
  return <div className="map-stats-dashboard">
    <div className="map-stats-toolbar"><label className="form-field"><span>Выберите карту</span><select value={selectedMap} onChange={e=>setSelectedMap(e.target.value)}>{mapNames.map(name=><option key={name} value={name}>{name}</option>)}</select></label></div>
    <div className="map-stat-cards">
      <div className="map-stat-card"><span>Карта</span><strong>{selectedMap || '—'}</strong></div>
      <div className="map-stat-card"><span>Всего матчей</span><strong>{totalGames}</strong></div>
      <div className="map-stat-card"><span>Победы / поражения в MapStat</span><strong>{totals.wins} / {totals.losses}</strong></div>
      <div className="map-stat-card"><span>Игроков со статистикой</span><strong>{players.size}</strong></div>
    </div>
    <div className="map-stats-columns">
      <section className="map-stats-list"><h3>Топ-3 победителей</h3>{bestWins.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Игрок</th><th>Команда</th><th>Побед</th></tr></thead><tbody>{bestWins.map(player=><tr key={player.name}><td>{player.name}</td><td>{player.team}</td><td>{player.wins}</td></tr>)}</tbody></table></div> : <p className="muted">Нет статистики игроков по этой карте.</p>}</section>
      <section className="map-stats-list"><h3>Топ-3 проигрывающих</h3>{mostLosses.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Игрок</th><th>Команда</th><th>Поражений</th></tr></thead><tbody>{mostLosses.map(player=><tr key={player.name}><td>{player.name}</td><td>{player.team}</td><td>{player.losses}</td></tr>)}</tbody></table></div> : <p className="muted">Нет статистики игроков по этой карте.</p>}</section>
    </div>
    <section className="map-stats-list map-faction-efficiency">
      <h3>Эффективность фракций на карте</h3>
      {factionRows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Фракция</th><th>Победы</th><th>Поражения</th><th>Винрейт</th></tr></thead><tbody>{factionRows.map(row=>{const games=row.wins+row.losses;return <tr key={row.faction}><td><FactionName value={row.faction}/></td><td>{row.wins}</td><td>{row.losses}</td><td>{games?Math.round(row.wins/games*100):0}%</td></tr>;})}</tbody></table></div> : <p className="muted">Для этой карты нет записей MapStat, привязанных к игрокам с известной фракцией.</p>}
      <p className="muted">Фракция берётся из текущего профиля игрока; если игрок менял фракцию, исторические значения могут отличаться.</p>
    </section>
  </div>;
}

function PlayerCabinet({players,onFindMatch}) {
  const [query,setQuery] = useState('');
  const [selectedId,setSelectedId] = useState('');
  const [ratingMatches,setRatingMatches] = useState([]);
  const [matchesError,setMatchesError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/rating-matches').then(async response => {
      const rows = await response.json();
      if (!response.ok) throw new Error(rows.error || 'Не удалось загрузить матчи игрока.');
      if (active) setRatingMatches(Array.isArray(rows) ? rows : []);
    }).catch(error => { if (active) setMatchesError(error.message); });
    return () => { active = false; };
  }, []);
  const filtered = players.filter(p => String(p.nickname || '').toLowerCase().includes(query.trim().toLowerCase()));
  const player = filtered.find(p => p.id === selectedId) || filtered[0] || null;
  useEffect(() => {
    if (!filtered.some(p => p.id === selectedId)) setSelectedId(filtered[0]?.id || '');
  }, [players, query]);
  if (!players.length) return <div className="empty-state">Игроки не найдены. Сначала добавьте игроков в разделе «Список игроков».</div>;
  const ratedGames = Number(player?.ratingWins || 0) + Number(player?.ratingLosses || 0);
  const winRate = ratedGames ? Math.round(Number(player.ratingWins || 0) / ratedGames * 100) : 0;
  return <div className="player-cabinet">
    <div className="cabinet-find-match"><button className="primary" onClick={async()=>{await onFindMatch?.();try{const response=await fetch('/api/rating-matches');const rows=await response.json();if(response.ok)setRatingMatches(Array.isArray(rows)?rows:[]);}catch(e){setMatchesError(e.message||'Не удалось обновить историю матчей.');}}}><Search size={16}/>Найти матч</button><p className="muted">Подбор создаёт матч для основного игрока и до 20 дополнительных пар других игроков.</p></div>
    <div className="cabinet-picker">
      <label className="form-field"><span>Найти игрока</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Введите ник игрока…"/></label>
      <label className="form-field"><span>Профиль игрока</span><select value={player?.id || ''} onChange={e=>setSelectedId(e.target.value)}>{filtered.map(p=><option key={p.id} value={p.id}>{p.nickname} — {p.teamName || 'Без команды'}</option>)}</select></label>
    </div>
    {!player ? <div className="empty-state">По этому запросу игроков нет.</div> : <>
      <div className="cabinet-profile">
        <div className="cabinet-identity"><ImageCell src={player.rankImageUrl} alt={player.rankName} type="rank"/><div><h3>{player.nickname}</h3><p>{player.teamName || 'Без команды'} · <FactionName value={player.faction}/></p><span>{player.rankName || 'Звание не назначено'}{player.position ? ' · '+player.position : ''}</span></div></div>
        <div className="cabinet-stats">
          <div><span>RP</span><strong>{player.rpPoints ?? 0}</strong></div>
          <div><span>MMR</span><strong>{player.ratingPoints ?? 0}</strong></div>
          <div><span>Пиковый RP</span><strong>{player.rpPeak ?? 0}</strong></div>
          <div><span>Опыт</span><strong>{player.experience ?? 0}</strong></div>
          <div><span>Рейтинговые игры</span><strong>{ratedGames}</strong></div>
          <div><span>Победы</span><strong>{player.ratingWins ?? 0}</strong></div>
          <div><span>Поражения</span><strong>{player.ratingLosses ?? 0}</strong></div>
          <div><span>Процент побед</span><strong>{winRate}%</strong></div>
          <div><span>Победы в матчах</span><strong>{player.matchWins ?? 0}</strong></div>
        </div>
      </div>
      <div className="cabinet-details"><div><span>Лучшая карта</span><strong>{player.bestMap || '—'}</strong></div><div><span>Худшая карта</span><strong>{player.worstMap || '—'}</strong></div><div><span>Капитан команды</span><strong>{player.isTeamCaptain ? 'Да' : 'Нет'}</strong></div></div>
      {(() => {
        const playerMatches = ratingMatches.filter(match => match.player1Id === player.id || match.player2Id === player.id);
        const upcoming = playerMatches.filter(match => !match.completed).sort((a,b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
        const history = playerMatches.filter(match => match.completed).sort((a,b) => String(b.scheduledAt).localeCompare(String(a.scheduledAt))).slice(0,10);
        return <div className="cabinet-match-sections">
          <section className="cabinet-match-card"><div className="cabinet-match-head"><h3>Предстоящие матчи</h3><span>{upcoming.length}</span></div>
            {!upcoming.length ? <p className="muted">Предстоящих рейтинговых матчей нет.</p> : upcoming.slice(0,5).map(match => <div className="cabinet-match-row" key={match.id}><div><strong>{match.player1 || 'Игрок'} vs {match.player2 || 'Игрок'}</strong><small>{match.map || 'Карта не выбрана'}</small></div><time>{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : 'Время не указано'}</time></div>)}
          </section>
          <section className="cabinet-match-card"><div className="cabinet-match-head"><h3>История матчей</h3><span>{history.length}</span></div>
            {!history.length ? <p className="muted">Завершённых рейтинговых матчей пока нет.</p> : history.map(match => <div className="cabinet-match-row" key={match.id}><div><strong>{match.player1 || 'Игрок'} vs {match.player2 || 'Игрок'}</strong><small>{match.map || 'Карта не выбрана'}</small></div><span className={match.winnerId === player.id ? 'match-result win' : 'match-result loss'}>{match.winnerId === player.id ? 'Победа' : 'Поражение'}</span></div>)}
          </section>
          {matchesError && <p className="muted">{matchesError}</p>}
        </div>;
      })()}
      <p className="muted cabinet-note">Профиль и матчи загружаются из локальной базы. Доступны только данные, которые уже сохранены в приложении.</p>
    </>}
  </div>;
}

function ShowcaseLinksPanel({showcases,onChanged}) {
  const [showcaseId,setShowcaseId] = useState('');
  const [achievements,setAchievements] = useState([]);
  const [selected,setSelected] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    if (!showcases.some(s => s.id === showcaseId)) setShowcaseId(showcases[0]?.id || '');
  }, [showcases]);
  useEffect(() => {
    let active = true;
    if (!showcaseId) { setAchievements([]); setSelected([]); return () => { active = false; }; }
    fetch('/api/achievement-showcase/'+encodeURIComponent(showcaseId)+'/achievements')
      .then(async r => { const body=await r.json(); if(!r.ok) throw new Error(body.error || 'Не удалось загрузить связи достижений.'); return body; })
      .then(rows => { if(active) { setAchievements(rows); setSelected(rows.filter(x=>x.selected).map(x=>x.id)); setError(''); } })
      .catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [showcaseId]);
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/achievement-showcase/'+encodeURIComponent(showcaseId)+'/achievements',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({achievementIds:selected})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || 'Не удалось сохранить связи.');
      await onChanged();
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="showcase-links">
    <h3>Состав витрины достижений</h3>
    {!showcases.length ? <p className="muted">Сначала создайте витрину выше, затем выберите достижения, которые будут в неё входить.</p> : <>
      <label className="form-field"><span>Витрина</span><select value={showcaseId} onChange={e=>setShowcaseId(e.target.value)}>{showcases.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="achievement-checklist">{achievements.map(a=><label key={a.id} className="achievement-option"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,a.id]:old.filter(id=>id!==a.id))}/><span>{a.name}</span><small>{a.teamName || a.playerName || a.tournamentName || 'Общее достижение'}</small></label>)}</div>
      {!achievements.length && <p className="muted">Достижений пока нет. Добавьте их во вкладке «Достижения».</p>}
      <div className="modal-actions"><button className="primary" type="button" disabled={busy} onClick={save}>{busy?'Сохранение…':'Сохранить состав витрины'}</button></div>
    </>}
    {error && <div className="error"><CircleAlert size={16}/>{error}</div>}
  </div>;
}

function sortValueForColumn(row,column,index) {
  const [label,render] = column;
  if (label === 'Место') return row.rpPoints ?? row.points ?? row.ratingPoints ?? index;
  if (typeof render === 'string') return row[render];
  let value;
  try { value = typeof render === 'function' ? render(row,index) : undefined; } catch { value = undefined; }
  if (value == null || typeof value !== 'object') return value;
  const aliases = {
    'Логотип':['name'], 'Изображение':['name','title'], 'Эмблема':['name'],
    'Команда':['name','teamName'], 'Игрок':['nickname','playerName'], 'Звание':['rankName'],
    'Место':['rpPoints','points','ratingPoints'], 'Сыграно игр':['wins','losses'],
    'Команда 1':['homeTeam'], 'Команда 2':['awayTeam'], 'Турнир':['tournamentName','name'],
    'Победитель':['winner','winnerName'], 'Дата':['scheduledAt','createdAt'],
    'Создан':['createdAt'], 'Создана':['createdAt'], 'Карта':['map','mapName'],
    'Завершён':['completed'], 'Фракция':['faction'], 'Игроков':['players'],
    'Обычные победы':['wins'], 'Рейтинговые победы':['ratingWins'],
    'Рейтинговые поражения':['ratingLosses'], 'Средний RP':['averageRP'],
    'Максимальный пиковый RP':['peakRP']
  };
  const fields = aliases[label] || [];
  if (label === 'Сыграно игр') return Number(row.wins || 0) + Number(row.losses || 0);
  if (label === 'Место') return row.rpPoints ?? row.points ?? row.ratingPoints ?? index;
  for (const field of fields) if (row[field] !== undefined && row[field] !== null) return row[field];
  return label;
}
function compareSortValues(a,b) {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1;
  if (b == null || b === '') return -1;
  const an = typeof a === 'number' ? a : (String(a).trim() !== '' ? Number(a) : NaN);
  const bn = typeof b === 'number' ? b : (String(b).trim() !== '' ? Number(b) : NaN);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  const ad = typeof a === 'string' ? Date.parse(a) : NaN;
  const bd = typeof b === 'string' ? Date.parse(b) : NaN;
  if (Number.isFinite(ad) && Number.isFinite(bd)) return ad - bd;
  return String(a).localeCompare(String(b),'ru',{numeric:true,sensitivity:'base'});
}


function SettingsPanel() {
  const [players,setPlayers] = useState([]);
  const [playerId,setPlayerId] = useState('');
  const [busy,setBusy] = useState(true);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  useEffect(() => {
    fetch('/api/settings/main-player').then(async r => {
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Не удалось загрузить настройки.');
      setPlayers(result.players || []);
      setPlayerId(result.player?.id || '');
    }).catch(e => setError(e.message)).finally(() => setBusy(false));
  }, []);
  async function save() {
    setBusy(true); setMessage(''); setError('');
    try {
      const r = await fetch('/api/settings/main-player',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId})});
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Не удалось сохранить настройки.');
      setMessage('Основной игрок сохранён: '+result.player.nickname);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="panel settings-panel">
    <div className="panel-head"><div><h2>Основной игрок</h2><p className="muted">Для кого подбирать соперника в рейтинговой лиге.</p></div></div>
    {busy && !players.length ? <p className="muted">Загрузка игроков…</p> : <div className="settings-form">
      <label htmlFor="main-player-select">Игрок</label>
      <select id="main-player-select" value={playerId} onChange={e=>setPlayerId(e.target.value)} disabled={busy}>
        <option value="">Выберите игрока</option>{players.map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}
      </select>
      <button className="primary" onClick={save} disabled={busy || !playerId}>Сохранить</button>
    </div>}
    <p className="muted">По умолчанию используется GGanz, если он есть в базе. Выбор сохраняется в SQL-базе.</p>
    {message && <div className="success-message">{message}</div>}
    {error && <div className="error">{error}</div>}
  </section>;
}

function FactionName({value}) {
  const normalized = String(value || '').trim().toLowerCase();
  const factionClass = normalized.includes('союз') || normalized.includes('soviet') ? 'faction-red'
    : normalized.includes('альянс') || normalized.includes('allied') || normalized.includes('allies') ? 'faction-blue'
    : normalized.includes('импер') || normalized.includes('empire') ? 'faction-yellow' : 'faction-neutral';
  return <span className={'faction-name '+factionClass}>{value || 'Не указана'}</span>;
}

function ImageCell({src,alt,type='team'}) {
  const [failed,setFailed] = useState(!src);
  useEffect(() => { setFailed(!src); }, [src]);
  const label = String(alt || '').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || (type==='rank'?'★':type==='league'?'L':'?');
  return <span className={'image-cell image-'+type} title={alt || ''}>
    {!failed && src ? <img src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)}/> : <span className="image-fallback">{label}</span>}
  </span>;
}

function configKeyLabel(key) {
  const labels = {match_win:'Правила начисления за победу',main_player_id:'Основной игрок для рейтинговой лиги'};
  if(labels[key]) return labels[key];
  return String(key||'Параметр').replace(/[_-]+/g,' ').replace(/([a-zа-я])([A-ZА-Я])/g,'$1 $2').replace(/^./,char=>char.toLocaleUpperCase('ru'));
}
function configValueType(value) {
  if(value===null || value===undefined || value==='') return 'Пустое';
  const raw=String(value).trim();
  if((raw.startsWith('{')&&raw.endsWith('}'))||(raw.startsWith('[')&&raw.endsWith(']'))) {
    try { JSON.parse(raw); return 'JSON'; } catch {}
  }
  if(raw==='true'||raw==='false') return 'Логический';
  if(Number.isFinite(Number(raw))&&raw!=='') return 'Числовой';
  return 'Текстовый';
}
function emptyMessage(page, subtab) {
  if (page==='info' && subtab==='Информация') return 'Новостей пока нет — таблица News в исходной базе пустая.';
  if (page==='info' && subtab==='Медали') return 'Медалей пока нет — таблица Medal в исходной базе пустая.';
  if (page==='info' && subtab==='Достижения') return 'Достижения не найдены.';
  if (page==='info' && subtab==='Посты победителей') return 'Постов победителей пока нет.';
  if (page==='info' && subtab==='Витрина достижений') return 'Витрина достижений пока пуста.';
  if (page==='simulator') return 'История симуляций не найдена.';
  return 'В этой таблице пока нет записей.';
}
function Toolbar({search,setSearch,sort,setSort,showSort=false}) {
  return <div className="toolbar"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск…"/></div>{showSort&&<select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Сортировка"><option value="points">Сортировка: по очкам</option><option value="wins">Сортировка: по победам</option><option value="level">Сортировка: по уровню</option></select>}</div>;
}
function DataTable({rows,columns,empty,onEdit,onDelete,canEdit,canDelete,onComplete,canComplete,sortColumn,sortDirection,onSort,podium=false}) {
  const sortedRows = useMemo(() => {
    if (sortColumn == null || !columns?.[sortColumn]) return rows || [];
    const column = columns[sortColumn];
    return [...(rows || [])].sort((a,b) => {
      const result = compareSortValues(sortValueForColumn(a,column,0),sortValueForColumn(b,column,0));
      return sortDirection === 'desc' ? -result : result;
    });
  }, [rows,columns,sortColumn,sortDirection]);
  if (!columns?.length) return <div className="empty-state">Этот экран пока не подключён.</div>;
  if (!sortedRows.length) return <div className="empty-state">{empty}</div>;
  return <div className="table-wrap"><table><thead><tr>{columns.map(([label],i)=><th key={i}><button type="button" className="sortable-header" onClick={()=>onSort?.(i)} title={'Сортировать: '+label}>{label}<span aria-hidden="true">{sortColumn===i?(sortDirection==='asc'?' ↑':' ↓'):' ↕'}</span></button></th>)}{(onEdit || onDelete || onComplete) && <th>Действия</th>}</tr></thead><tbody>{sortedRows.map((r,i)=><tr key={r.id||i} className={podium && (r._podiumRank ?? i)<3 ? 'podium p'+(r._podiumRank ?? i) : undefined}>{columns.map(([label,render],j)=><td key={j}>{typeof render==='function'?fmt(render(r,i)):fmt(r[render])}</td>)}{(onEdit || onDelete || onComplete) && <td><div className="row-actions">{onEdit && (!canEdit || canEdit(r)) && <button className="icon-btn" title="Редактировать" onClick={() => onEdit(r)}><Pencil size={15}/></button>}{onDelete && (!canDelete || canDelete(r)) && <button className="icon-btn danger-btn" title="Удалить" onClick={() => onDelete(r)}><Trash2 size={15}/></button>}{onComplete && !r.completed && <button className="icon-btn complete-btn" title={canComplete && !canComplete(r)?'Сначала укажите две команды и неравный счёт':'Завершить матч'} disabled={Boolean(canComplete && !canComplete(r))} onClick={() => onComplete(r)}><CheckCircle2 size={15}/></button>}{onEdit && canEdit && !canEdit(r) && <span className="locked-row">Зафиксирован</span>}</div></td>}</tr>)}</tbody></table></div>;
}
function columnsFor(page, subtab) {
  const map = {
    teams:[['Логотип',r=><ImageCell src={r.logoUrl} alt={r.name} type="team"/>],['Команда','name'],['Очки','points'],['Победы','wins'],['Поражения','losses'],['Уровень','level'],['Лучшая карта','bestMap'],['Худшая карта','worstMap']],
    players:[['Игрок','nickname'],['Фракция',r=><FactionName value={r.faction}/>],['Команда','teamName'],['Опыт','experience'],['Победы в матчах','matchWins'],['RP','rpPoints'],['Пиковый RP','rpPeak'],['Звание',r=><span className="rank-cell"><ImageCell src={r.rankImageUrl} alt={r.rankName} type="rank"/>{fmt(r.rankName)}</span>]],
    tournaments:[['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="league"/>],['Турнир','name'],['Тип','type'],['Сезон',r=>r.seasonName || r.seasonNumber],['Победитель',r=>r.winnerTeamName || r.winnerName],['Создан','createdAt']],
    matches:[['Турнир','tournamentName'],['Команда 1','homeTeam'],['Счёт',r=>fmt(r.homeScore)+' : '+fmt(r.awayScore)],['Команда 2','awayTeam'],['Победитель','winnerName'],['Карта','map'],['Раунд','round'],['Завершён',r=>bool(r.completed)]],
    seasons:[['Сезон','name'],['Начало','startDate'],['Конец','endDate'],['Активен',r=>bool(r.isActive)]],
    maps:subtab==='Статистика карт'?[['Карта',r=>r.map||r.mapName],['Команда','teamName'],['Игрок','playerName'],['Победы','wins'],['Поражения','losses']]:[['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="map"/>],['Карта','name'],['Игроков','playersCount'],['Описание','description']],
    config:[['Параметр',r=>configKeyLabel(r.key)],['Тип',r=>configValueType(r.value)],['Значение','value'],['Описание','description']],
    ranks:[['Эмблема',r=><ImageCell src={r.imageUrl} alt={r.name} type="rank"/>],['Звание','name'],['Описание','description'],['Победы для получения','requiredWins'],['Опыт для получения','requiredXP']],
    simulator:[['Дата','createdAt'],['Турнир',r=>{try{return JSON.parse(r.input).tournamentName || '—';}catch{return '—';}}],['Команды',r=>{try{const x=JSON.parse(r.input);return (x.team1 || '?')+' — '+(x.team2 || '?');}catch{return r.input;}}],['Карта',r=>{try{return JSON.parse(r.result).map || '—';}catch{return '—';}}],['Победитель',r=>{try{return JSON.parse(r.result).winner || '—';}catch{return r.result;}}]]
  };
  return map[page] || [];
}
createRoot(document.getElementById('root')).render(<App/>);
