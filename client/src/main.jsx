import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Coins, Award, Info, Map, CalendarDays, ChartNoAxesColumn, Layers, FlaskConical, ContactRound, UsersRound, Swords, Trophy, Search, RefreshCw, House, ChevronRight, CircleAlert } from 'lucide-react';
import './style.css';

const nav = [
  ['Валюта', Coins, 'config'], ['Звания', Award, 'ranks'], ['Информация', Info, 'info'], ['Карты', Map, 'maps'],
  ['Матчи', CalendarDays, 'matches'], ['Рейтинг', ChartNoAxesColumn, 'rating'], ['Рейтинговая лига', Layers, 'league'],
  ['Сезоны', CalendarDays, 'seasons'], ['Симулятор', FlaskConical, 'simulator'], ['Список игроков', ContactRound, 'players'],
  ['Список команд', UsersRound, 'teams'], ['Ставки', Coins, 'bets'], ['Турниры', Swords, 'tournaments']
];
const apiFor = { teams:'/api/teams', players:'/api/players', tournaments:'/api/tournaments', matches:'/api/matches', league:'/api/leagues', seasons:'/api/seasons', maps:'/api/maps', config:'/api/config' };
const fmt = v => v == null || v === '' ? '—' : v;

function App() {
  const [page, setPage] = useState('home');
  const [subtab, setSubtab] = useState('Информация о лигах');
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('points');

  async function load(target=page) {
    const endpoint = target === 'rating' ? '/api/teams' : (target === 'league' && subtab === 'Лучшие игроки' ? '/api/players' : apiFor[target]);
    if (!endpoint) { setData([]); return; }
    setLoading(true); setError('');
    try { const [r,s] = await Promise.all([fetch(endpoint), fetch('/api/summary')]); if(!r.ok) throw new Error('Сервер вернул ошибку '+r.status); setData(await r.json()); if(s.ok) setSummary(await s.json()); }
    catch(e) { setError('Не удалось получить данные от сервера. Проверьте, что запущен npm run dev.'); setData([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { fetch('/api/summary').then(r=>r.json()).then(setSummary).catch(()=>{}); }, []);
  useEffect(() => { if(page==='rating') setSubtab('Рейтинг Команд'); else if(page==='league') setSubtab('Информация о лигах'); load(page); setSearch(''); }, [page]);
  useEffect(() => { if(page==='league' && subtab==='Лучшие игроки') load('league'); }, [subtab]);

  const filtered = useMemo(() => {
    const q=search.trim().toLowerCase(); let list=data.filter(x=>!q || Object.values(x).some(v=>String(v??'').toLowerCase().includes(q)));
    if(page==='teams') list.sort((a,b)=>Number(b[sort]||0)-Number(a[sort]||0));
    if(page==='players') list.sort((a,b)=>Number(b.rpPoints||0)-Number(a.rpPoints||0));
    return list;
  },[data,search,page,sort]);

  const title = nav.find(x=>x[2]===page)?.[0] || (page==='home'?'Главная':'Раздел');
  const leagueTabs = ['Информация о лигах','Рейтинговые матчи','Лучшие игроки','Кабинет игрока','Статистика фракций'];
  const homeCards = [
    ['Команды','Управление командами, игроками и их статистикой','teams',UsersRound],
    ['Матчи','Расписание матчей, результаты и жеребьёвка','matches',CalendarDays],
    ['Турниры','Управление турнирами и их настройками','tournaments',Trophy],
    ['Звания','Система званий и опыта игроков','ranks',Award]
  ];
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand" onClick={()=>setPage('home')}>Red Alert Tournament<br/>Manager</div><nav>{nav.map(([label,Icon,id])=><button key={id} className={'nav-item '+(page===id?'active':'')} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="sidebar-foot">Независимая версия · 0.1</div></aside>
    <main className="main"><header className="topbar"><span className="crumb"><House size={15}/> <ChevronRight size={14}/> {title}</span><button className="icon-btn" title="Обновить данные" onClick={()=>load()}><RefreshCw size={17}/></button></header>
      <div className="content">
        {page==='home' ? <><div className="hero"><h1>Red Alert Tournament Manager</h1><p>Система для организации турниров по Red Alert 3</p></div>
          {summary && <div className="stats-grid">{[['Команды',summary.teams],['Игроки',summary.players],['Матчи',summary.matches],['Турниры',summary.tournaments]].map(([l,n])=><div className="stat-card" key={l}><span>{l}</span><strong>{n}</strong></div>)}</div>}
          <div className="home-grid">{homeCards.map(([name,desc,id,Icon])=><article className="home-card" key={id}><h2><Icon size={22}/>{name}</h2><p>{desc}</p><button className="primary" onClick={()=>setPage(id)}>Перейти</button></article>)}</div>
        </> : page==='league' ? <><h1 className="page-title">Рейтинговая лига</h1><div className="tabs">{leagueTabs.map(t=><button className={subtab===t?'selected':''} key={t} onClick={()=>setSubtab(t)}>{t}</button>)}</div><section className="panel"><h2>{subtab}</h2>{subtab==='Информация о лигах' ? <><p className="muted">Лиги в порядке возрастания: Бронзовая, Серебряная, Золотая, Алмазная, Сапфировая, Изумрудная, Обсидиановая, Бриллиантовая.</p><DataTable rows={filtered} columns={[
            ['#',(_,i)=>i+1],['Лига',r=>r.name],['Минимум очков',r=>r.requiredPoints],['Описание',r=>r.description]
          ]} empty="Лиги не найдены"/></> : subtab==='Лучшие игроки' ? <p className="muted">Загрузка таблицы лучших игроков будет подключена на следующем этапе.</p> : subtab==='Рейтинговые матчи' ? <p className="muted">Рейтинговые матчи доступны в разделе «Матчи» после выбора соответствующей вкладки.</p> : <p className="muted">Этот экран подготовлен как часть структуры. Полная логика будет добавлена поэтапно.</p>}</section></>
        : page==='rating' ? <><h1 className="page-title">Рейтинг</h1><div className="tabs">{['Рейтинг Команд','Рейтинг Игроков','Рейтинг Альянс','Рейтинг Союз','Рейтинг Империя'].map(t=><button key={t} className={subtab===t?'selected':''} onClick={()=>setSubtab(t)}>{t}</button>)}</div><section className="panel"><h2>{subtab}</h2><p className="muted">{subtab==='Рейтинг Команд'?'Очки и MMR показываются на основе сохранённых данных.': 'Рейтинг игроков и фракций будет уточнён на следующем этапе.'}</p><Toolbar search={search} setSearch={setSearch} sort={sort} setSort={setSort} showSort={subtab==='Рейтинг Команд'}/>{subtab==='Рейтинг Команд' ? <DataTable rows={filtered} columns={[
            ['Место',(_,i)=>i+1],['Команда',r=><span className="team-name">{r.logoUrl&&<img src={r.logoUrl} onError={e=>e.currentTarget.style.display='none'} alt=""/>}{r.name}</span>],['Сыграно игр',r=>(r.wins||0)+(r.losses||0)],['Очки',r=>r.points],['MMR',r=>(r.points||0)*2],['Победы',r=>r.wins],['Поражения',r=>r.losses],['Уровень',r=>r.level]
          ]} empty="Команды не найдены" highlight/> : <div className="empty-state">Этот рейтинг подключим после сверки правил начисления очков в базе.</div>}</section></>
        : <><h1 className="page-title">{title}</h1><section className="panel"><div className="panel-head"><div><h2>{title}</h2><p className="muted">Данные загружены из SQL-резервной копии Adaptive.ai</p></div><Toolbar search={search} setSearch={setSearch}/></div>{error&&<div className="error"><CircleAlert size={18}/>{error}</div>}{loading?<p className="muted">Загрузка…</p>:<DataTable rows={filtered} columns={columnsFor(page)} empty="В этой таблице пока нет записей."/>}</section></>}
        {error&&page!=='home'&&page!=='rating'&&page!=='league'&&<div className="error"><CircleAlert size={18}/>{error}</div>}
        <footer>Red Alert Tournament Manager <span>· независимая версия</span></footer>
      </div>
    </main>
  </div>;
}
function Toolbar({search,setSearch,sort,setSort,showSort=false}) { return <div className="toolbar"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск…"/></div>{showSort&&<select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Сортировка"><option value="points">Сортировка: по очкам</option><option value="wins">Сортировка: по победам</option><option value="level">Сортировка: по уровню</option></select>}</div> }
function DataTable({rows,columns,empty,highlight=false}) { if(!rows?.length)return <div className="empty-state">{empty}</div>; return <div className="table-wrap"><table><thead><tr>{columns.map(([label],i)=><th key={i}>{label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr className={highlight&&i<3?'podium p'+i:''} key={r.id||i}>{columns.map(([label,render],j)=><td key={j}>{typeof render==='function'?render(r,i):fmt(r[render])}</td>)}</tr>)}</tbody></table></div> }
function columnsFor(page){const map={teams:[['Команда','name'],['Очки','points'],['Победы','wins'],['Поражения','losses'],['Уровень','level'],['Лучшая карта','bestMap'],['Худшая карта','worstMap']],players:[['Игрок','nickname'],['Фракция','faction'],['Команда','teamName'],['Опыт','experience'],['Победы','wins'],['RP','rpPoints'],['Пиковый RP','rpPeak']],tournaments:[['Турнир','name'],['Тип','type'],['Сезон','seasonNumber'],['Победитель','winnerName'],['Создан','createdAt']],matches:[['Турнир','tournamentName'],['Команда 1','homeTeam'],['Счёт','homeScore'],['Команда 2','awayTeam'],['Карта','map'],['Раунд','round'],['Завершён','completed']],seasons:[['Сезон','name'],['Начало','startDate'],['Конец','endDate'],['Активен',r=>r.isActive?'Да':'Нет']],maps:[['Карта','name'],['Игроков','playersCount'],['Описание','description']],config:[['Параметр','key'],['Значение','value'],['Описание','description']]};return map[page]||[['Информация','name']];}

createRoot(document.getElementById('root')).render(<App/>);
