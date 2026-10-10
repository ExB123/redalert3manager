import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Coins, Award, Info, Map, CalendarDays, ChartNoAxesColumn, Layers, FlaskConical, ContactRound, UsersRound, Swords, Trophy, Search, RefreshCw, House, ChevronRight, CircleAlert, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import './style.css';

const nav = [
  ['Валюта', Coins, 'config'], ['Звания', Award, 'ranks'], ['Информация', Info, 'info'], ['Карты', Map, 'maps'],
  ['Матчи', CalendarDays, 'matches'], ['Рейтинг', ChartNoAxesColumn, 'rating'], ['Рейтинговая лига', Layers, 'league'],
  ['Сезоны', CalendarDays, 'seasons'], ['Симулятор', FlaskConical, 'simulator'], ['Список игроков', ContactRound, 'players'],
  ['Список команд', UsersRound, 'teams'], ['Ставки', Coins, 'bets'], ['Турниры', Swords, 'tournaments']
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
  const [actionMessage, setActionMessage] = useState('');
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
    if (page === 'home' || page === 'bets') { setData([]); setError(''); return; }
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

  useEffect(() => {
    fetch('/api/summary').then(r => r.json()).then(setSummary).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [page, subtab]);
  useEffect(() => { setTableSort({ column: null, direction: 'asc' }); }, [page, subtab]);

  const visibleData = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data.filter(x => !q || Object.values(x).some(v => String(v ?? '').toLowerCase().includes(q)));
    if (page === 'rating' && subtab !== 'Рейтинг Команд') {
      const faction = { 'Рейтинг Альянс':'Альянс', 'Рейтинг Союз':'Союз', 'Рейтинг Империя':'Империя' }[subtab];
      if (faction) rows = rows.filter(r => String(r.faction || '').toLowerCase().includes(faction.toLowerCase()));
      rows.sort((a,b) => Number(b.rpPoints || b.ratingPoints || 0) - Number(a.rpPoints || a.ratingPoints || 0));
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
      ['Место',(_,i)=>i+1],['Команда',r=><span className="team-name"><ImageCell src={r.logoUrl} alt={r.name} type="team"/>{r.name}</span>],
      ['Сыграно игр',r=>(r.wins||0)+(r.losses||0)],['Очки',r=>r.points],['Победы',r=>r.wins],['Поражения',r=>r.losses],['Уровень',r=>r.level]
    ] : [['Место',(_,i)=>i+1],['Игрок','nickname'],['Фракция','faction'],['Команда','teamName'],['RP','rpPoints'],['Пиковый RP','rpPeak'],['Победы','ratingWins'],['Поражения','ratingLosses'],['Звание',r=><span className="rank-cell"><ImageCell src={r.rankImageUrl} alt={r.rankName} type="rank"/>{fmt(r.rankName)}</span>]];
  } else if (page === 'league') {
    sectionTitle = subtab;
    if (subtab === 'Информация о лигах') columns = [['#',(_,i)=>i+1],['Эмблема',r=><ImageCell src={r.imageUrl} alt={r.name} type="league"/>],['Лига','name'],['Минимум очков','requiredPoints'],['Описание','description']];
    else if (subtab === 'Рейтинговые матчи') columns = [['Игрок 1','player1'],['Игрок 2','player2'],['Дата','scheduledAt'],['Карта','map'],['Победитель','winner'],['Завершён',r=>bool(r.completed)]];
    else if (subtab === 'Лучшие игроки') columns = [['Место',(_,i)=>i+1],['Игрок','nickname'],['Фракция','faction'],['Команда','teamName'],['RP','rpPoints'],['Пиковый RP','rpPeak'],['Победы','ratingWins'],['Поражения','ratingLosses'],['Звание',r=><span className="rank-cell"><ImageCell src={r.rankImageUrl} alt={r.rankName} type="rank"/>{fmt(r.rankName)}</span>]];
    else if (subtab === 'Статистика фракций') columns = [['Фракция','faction'],['Игроков','players'],['Обычные победы','wins'],['Рейтинговые победы','ratingWins'],['Рейтинговые поражения','ratingLosses'],['Средний RP','averageRP'],['Максимальный пиковый RP','peakRP']];
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
          {page === 'rating' && <div className="tabs">{ratingTabs.map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div>}
          {page === 'league' && <div className="tabs">{leagueTabs.map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div>}
          {page === 'maps' && <div className="tabs"><button className={subtab==='Карты'?'selected':''} onClick={()=>setSubtab('Карты')}>Карты</button><button className={subtab==='Статистика карт'?'selected':''} onClick={()=>setSubtab('Статистика карт')}>Статистика карт</button></div>}
          {page === 'info' && <div className="tabs">{['Информация','Достижения','Медали','Посты победителей','Витрина достижений'].map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div>}
          <section className="panel">
            <div className="panel-head"><div><h2>{sectionTitle}</h2><p className="muted">Данные читаются из локальной SQL-базы независимой версии.</p></div>
              <div className="panel-tools">
                {crudEntity && <button className="primary" onClick={() => { setActionMessage(''); setCrudDialog({ entity: crudEntity, row: null, fields: crudFields }); }}><Plus size={16}/>Добавить</button>}
                {page !== 'bets' && !(page==='league' && ['Кабинет игрока','Статистика фракций'].includes(subtab)) && <Toolbar search={search} setSearch={setSearch} sort={sort} setSort={setSort} showSort={page==='teams'}/>}
              </div>
            </div>
            {error && <div className="error"><CircleAlert size={18}/>{error}</div>}
            {actionMessage && <div className="success-message">{actionMessage}</div>}
            {page === 'simulator' && (
              <SimulatorPanel onComplete={async winner => {
                setActionMessage('Симуляция завершена. Победитель: ' + winner);
                await load();
              }} />
            )}
            {page === 'league' && subtab === 'Кабинет игрока' ? (
              loading ? <p className="muted">Загрузка игроков…</p> : <PlayerCabinet players={visibleData} />
            ) : specialPlaceholder ? (
              <div className="empty-state">{specialPlaceholder}</div>
            ) : loading ? (
              <p className="muted">Загрузка…</p>
            ) : (
              <DataTable
                rows={visibleData}
                columns={columns}
                empty={emptyMessage(page,subtab)}
                onEdit={crudEntity ? row => { setActionMessage(''); setCrudDialog({ entity: crudEntity, row, fields: crudFields }); } : null}
                onDelete={crudEntity ? deleteRow : null}
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
          </section>
        </>}
        <footer>Red Alert Tournament Manager <span>· независимая версия</span></footer>
      </div>
    </main>
    {crudDialog && <CrudDialog entity={crudDialog.entity} row={crudDialog.row} fields={crudDialog.fields} onClose={() => setCrudDialog(null)} onSaved={async message => { setCrudDialog(null); setActionMessage(message); await load(); }}/>}
  </div>;

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
      {name:'round',label:'Раунд',type:'number'},{name:'map',label:'Карта'},{name:'winnerId',label:'Команда-победитель',type:'remote',endpoint:'/api/teams',valueKey:'id',labelKey:'name'},{name:'nextMatchId',label:'Следующий матч',type:'remote',endpoint:'/api/matches',valueKey:'id',labelKey:'id'},{name:'completed',label:'Матч завершён',type:'select',options:'boolean'}
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

function PlayerCabinet({players}) {
  const [query,setQuery] = useState('');
  const [selectedId,setSelectedId] = useState('');
  const filtered = players.filter(p => String(p.nickname || '').toLowerCase().includes(query.trim().toLowerCase()));
  const player = filtered.find(p => p.id === selectedId) || filtered[0] || null;
  useEffect(() => {
    if (!filtered.some(p => p.id === selectedId)) setSelectedId(filtered[0]?.id || '');
  }, [players, query]);
  if (!players.length) return <div className="empty-state">Игроки не найдены. Сначала добавьте игроков в разделе «Список игроков».</div>;
  const ratedGames = Number(player?.ratingWins || 0) + Number(player?.ratingLosses || 0);
  const winRate = ratedGames ? Math.round(Number(player.ratingWins || 0) / ratedGames * 100) : 0;
  return <div className="player-cabinet">
    <div className="cabinet-picker">
      <label className="form-field"><span>Найти игрока</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Введите ник игрока…"/></label>
      <label className="form-field"><span>Профиль игрока</span><select value={player?.id || ''} onChange={e=>setSelectedId(e.target.value)}>{filtered.map(p=><option key={p.id} value={p.id}>{p.nickname} — {p.teamName || 'Без команды'}</option>)}</select></label>
    </div>
    {!player ? <div className="empty-state">По этому запросу игроков нет.</div> : <>
      <div className="cabinet-profile">
        <div className="cabinet-identity"><ImageCell src={player.rankImageUrl} alt={player.rankName} type="rank"/><div><h3>{player.nickname}</h3><p>{player.teamName || 'Без команды'} · {player.faction || 'Фракция не указана'}</p><span>{player.rankName || 'Звание не назначено'}{player.position ? ' · '+player.position : ''}</span></div></div>
        <div className="cabinet-stats">
          <div><span>RP</span><strong>{player.rpPoints ?? 0}</strong></div>
          <div><span>Пиковый RP</span><strong>{player.rpPeak ?? 0}</strong></div>
          <div><span>Опыт</span><strong>{player.experience ?? 0}</strong></div>
          <div><span>Рейтинговые игры</span><strong>{ratedGames}</strong></div>
          <div><span>Победы</span><strong>{player.ratingWins ?? 0}</strong></div>
          <div><span>Поражения</span><strong>{player.ratingLosses ?? 0}</strong></div>
          <div><span>Процент побед</span><strong>{winRate}%</strong></div>
          <div><span>Всего побед</span><strong>{player.wins ?? 0}</strong></div>
        </div>
      </div>
      <div className="cabinet-details"><div><span>Лучшая карта</span><strong>{player.bestMap || '—'}</strong></div><div><span>Худшая карта</span><strong>{player.worstMap || '—'}</strong></div><div><span>Капитан команды</span><strong>{player.isTeamCaptain ? 'Да' : 'Нет'}</strong></div></div>
      <p className="muted cabinet-note">Это просмотр профиля из локальной базы. Вход по паролю и приватная почта не включены до реализации безопасной авторизации.</p>
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

function ImageCell({src,alt,type='team'}) {
  const [failed,setFailed] = useState(!src);
  useEffect(() => { setFailed(!src); }, [src]);
  const label = String(alt || '').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || (type==='rank'?'★':type==='league'?'L':'?');
  return <span className={'image-cell image-'+type} title={alt || ''}>
    {!failed && src ? <img src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)}/> : <span className="image-fallback">{label}</span>}
  </span>;
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
function DataTable({rows,columns,empty,onEdit,onDelete,sortColumn,sortDirection,onSort}) {
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
  return <div className="table-wrap"><table><thead><tr>{columns.map(([label],i)=><th key={i}><button type="button" className="sortable-header" onClick={()=>onSort?.(i)} title={'Сортировать: '+label}>{label}<span aria-hidden="true">{sortColumn===i?(sortDirection==='asc'?' ↑':' ↓'):' ↕'}</span></button></th>)}{(onEdit || onDelete) && <th>Действия</th>}</tr></thead><tbody>{sortedRows.map((r,i)=><tr key={r.id||i}>{columns.map(([label,render],j)=><td key={j}>{typeof render==='function'?fmt(render(r,i)):fmt(r[render])}</td>)}{(onEdit || onDelete) && <td><div className="row-actions">{onEdit && <button className="icon-btn" title="Редактировать" onClick={() => onEdit(r)}><Pencil size={15}/></button>}{onDelete && <button className="icon-btn danger-btn" title="Удалить" onClick={() => onDelete(r)}><Trash2 size={15}/></button>}</div></td>}</tr>)}</tbody></table></div>;
}
function columnsFor(page, subtab) {
  const map = {
    teams:[['Логотип',r=><ImageCell src={r.logoUrl} alt={r.name} type="team"/>],['Команда','name'],['Очки','points'],['Победы','wins'],['Поражения','losses'],['Уровень','level'],['Лучшая карта','bestMap'],['Худшая карта','worstMap']],
    players:[['Игрок','nickname'],['Фракция','faction'],['Команда','teamName'],['Опыт','experience'],['Победы','wins'],['RP','rpPoints'],['Пиковый RP','rpPeak'],['Звание',r=><span className="rank-cell"><ImageCell src={r.rankImageUrl} alt={r.rankName} type="rank"/>{fmt(r.rankName)}</span>]],
    tournaments:[['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="league"/>],['Турнир','name'],['Тип','type'],['Сезон',r=>r.seasonName || r.seasonNumber],['Победитель',r=>r.winnerTeamName || r.winnerName],['Создан','createdAt']],
    matches:[['Турнир','tournamentName'],['Команда 1','homeTeam'],['Счёт',r=>fmt(r.homeScore)+' : '+fmt(r.awayScore)],['Команда 2','awayTeam'],['Победитель','winnerName'],['Карта','map'],['Раунд','round'],['Завершён',r=>bool(r.completed)]],
    seasons:[['Сезон','name'],['Начало','startDate'],['Конец','endDate'],['Активен',r=>bool(r.isActive)]],
    maps:subtab==='Статистика карт'?[['Карта',r=>r.map||r.mapName],['Команда','teamName'],['Игрок','playerName'],['Победы','wins'],['Поражения','losses']]:[['Изображение',r=><ImageCell src={r.imageUrl} alt={r.name} type="map"/>],['Карта','name'],['Игроков','playersCount'],['Описание','description']],
    config:[['Параметр','key'],['Значение','value'],['Описание','description']],
    ranks:[['Эмблема',r=><ImageCell src={r.imageUrl} alt={r.name} type="rank"/>],['Звание','name'],['Описание','description'],['Победы для получения','requiredWins'],['Опыт для получения','requiredXP']],
    simulator:[['Дата','createdAt'],['Турнир',r=>{try{return JSON.parse(r.input).tournamentName || '—';}catch{return '—';}}],['Команды',r=>{try{const x=JSON.parse(r.input);return (x.team1 || '?')+' — '+(x.team2 || '?');}catch{return r.input;}}],['Карта',r=>{try{return JSON.parse(r.result).map || '—';}catch{return '—';}}],['Победитель',r=>{try{return JSON.parse(r.result).winner || '—';}catch{return r.result;}}]]
  };
  return map[page] || [];
}
createRoot(document.getElementById('root')).render(<App/>);
