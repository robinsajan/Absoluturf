'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, Users, History, Wallet, ArrowUpRight, MapPin, Clock, Plus, UserPlus, ArrowRight, Check } from 'lucide-react';
import { useStore, api } from '../../store/useStore';
import { Pitch } from '../../components/Brand';
import { money, matchDate, matchTime } from '../../lib/format';
interface Summary { upcoming_matches: number; confirmed_matches: number; completed_matches: number; active_groups: number; outstanding: number; pending_payments: number; verification_pending: number; }
export default function Dashboard() {
  const { user, matches, groups, notifications } = useStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    api.get('/dashboard').then(r => { if (active) { setSummary(r.data); setError(''); } }).catch(() => { if (active) setError('Could not load your dashboard totals.'); });
    return () => { active = false; };
  }, [matches, groups, reload]);
  if (!user) return null;
  const upcoming = matches.filter(m => m.is_active !== false && !m.is_past && !['Completed','Cancelled'].includes(m.status)).sort((a,b) => `${a.match_date}T${a.match_time}`.localeCompare(`${b.match_date}T${b.match_time}`));
  const hero = upcoming.find(m => m.user_vote === 'Yes') || upcoming[0];
  const activeGroups = groups.filter(g => g.is_member);
  const admin = activeGroups.some(g => g.role === 'Admin');
  const stats = [
    { label:'Match history', value:summary?.completed_matches, detail:'Completed with your squad', icon:History },
    { label:'Your fixtures', value:summary?.confirmed_matches, detail:'Upcoming matches you joined', icon:CalendarDays },
    { label:'Active groups', value:summary?.active_groups, detail:'Your sports communities', icon:Users },
    { label:'To settle', value:summary ? money(summary.outstanding) : undefined, detail:'Includes payments awaiting review', icon:Wallet },
  ];
  return <div className="dashboard">
    <section className="welcome-banner"><div><span className="player-tag"><i />{admin ? 'Squad organiser' : 'Squad member'} · Clubhouse</span><h1>Welcome back, {user.name.split(' ')[0]}</h1><p>{hero ? `Next up: ${hero.turf_name} · ${matchDate(hero.match_date)}` : 'A good game starts with a great squad.'}</p></div><Pitch className="welcome-pitch" /></section>
    <div className="quick-actions">
      <Link className="quick-action" href={admin ? '/matches?create=true' : '/matches'}><Plus size={23} /><span><strong>{admin ? 'Propose a match' : 'Find a match'}</strong><small>{admin ? 'Get your squad together' : 'See your next fixture'}</small></span></Link>
      <Link className="quick-action" href="/groups"><UserPlus size={23} /><span><strong>Your squad</strong><small>Groups, members & invites</small></span></Link>
      <Link className="quick-action" href="/payments"><Wallet size={23} /><span><strong>Settle up</strong><small>Keep the match moving</small></span></Link>
    </div>
    <section><div className="section-heading"><h2>Your season</h2><span className="eyebrow muted">Live from your clubhouse</span></div>{error ? <div className="inline-message error">{error} <button className="text-link" onClick={() => setReload(n => n+1)}>Retry</button></div> : <div className="metric-grid">{stats.map(({label,value,detail,icon:Icon}) => <div className="metric" key={label}><div className="metric-top"><span>{label}</span><Icon size={16} /></div>{value === undefined ? <div className="skeleton" style={{minHeight:45,margin:'12px 0'}} /> : <div className="metric-value">{value}</div>}<small>{detail}</small></div>)}</div>}</section>
    <div className="dashboard-columns"><div className="dashboard-column"><section><div className="section-heading"><h2>Next on the pitch</h2><Link className="text-link" href="/matches">All matches <ArrowRight size={14} /></Link></div>
      {hero ? <article className="featured-match"><Image src="/arena.jfif" width={900} height={360} sizes="(max-width: 767px) 100vw, 60vw" priority className="match-image" alt="Floodlit football pitch" /><div className="featured-body"><div className="flex items-center justify-between gap-2"><span className={`badge ${hero.status === 'Turf Confirmed' ? 'badge-green' : 'badge-yellow'}`}>{hero.status}</span><span className="eyebrow muted">{groups.find(g => g.id === hero.group_id)?.name}</span></div><h3>{hero.turf_name}</h3><div className="match-meta"><span><MapPin size={14} />{hero.location}</span><span><CalendarDays size={14} />{matchDate(hero.match_date)}</span><span><Clock size={14} />{matchTime(hero.match_time)}</span></div><div className="match-capacity"><span>{hero.yes_votes || 0} / {hero.max_players} players confirmed</span><span>{Math.max(0,hero.max_players-(hero.yes_votes || 0))} spots left</span></div><div className="progress-track" role="progressbar" aria-label="Confirmed players" aria-valuemin={0} aria-valuemax={hero.max_players} aria-valuenow={hero.yes_votes || 0}><div className="progress-fill" style={{width:`${Math.min(100,(hero.yes_votes || 0)/hero.max_players*100)}%`}} /></div><div className="match-actions"><span className="text-link">{hero.user_vote === 'Yes' ? <><Check size={15} />You are playing</> : hero.in_substitute_queue ? 'You are on the waiting list' : 'Your squad is waiting for you'}</span><Link href={`/matches?id=${hero.id}`} className="btn btn-primary">Matchroom <ArrowUpRight size={16} /></Link></div></div></article> : <div className="empty-state"><CalendarDays size={34} /><h3>Your next game starts here</h3><p>{admin ? 'Propose a fixture, collect votes and organise your next match.' : 'Join a group to find upcoming matches and get on the pitch.'}</p><Link href={admin ? '/matches?create=true' : '/groups'} className="btn btn-primary"><Plus size={16} />{admin ? 'Propose a match' : 'Find your squad'}</Link></div>}
      <div className="fixture-list">{upcoming.filter(m => m.id !== hero?.id).slice(0,3).map(m => <Link className="fixture-row" key={m.id} href={`/matches?id=${m.id}`}><span className="date-block">{matchDate(m.match_date,{day:'numeric'})}<small>{matchDate(m.match_date,{month:'short'})}</small></span><span><strong>{m.turf_name}</strong><p>{matchTime(m.match_time)} · {m.yes_votes || 0}/{m.max_players} players</p></span><ArrowUpRight size={18} /></Link>)}</div>
    </section></div>
    <div className="dashboard-column"><section><div className="section-heading"><h2>Your groups</h2><Link className="text-link" href="/groups">View all <ArrowRight size={14} /></Link></div>{activeGroups.length ? activeGroups.slice(0,3).map(g => <Link href={`/groups?id=${g.id}`} className="group-row" key={g.id}><span className="group-initial">{g.name[0]}</span><span><strong>{g.name}</strong><small>{g.sport_type} · {g.member_count || 0} members · {g.role}</small></span><ArrowUpRight size={17} /></Link>) : <div className="empty-state compact"><Users size={28} /><h3>Find your people</h3><p>Create a group or join a sports community.</p><Link className="text-link" href="/groups">Explore groups <ArrowRight size={14} /></Link></div>}</section>
    <section className="balance-card"><span className="eyebrow muted">Your match payments</span><div className="metric-value">{summary ? money(summary.outstanding) : '—'}</div><p>{summary?.verification_pending ? `${summary.verification_pending} payment(s) awaiting organiser verification.` : summary?.pending_payments ? `${summary.pending_payments} payment(s) to settle with your organisers.` : 'Keep track of your share and your guests in one place.'}</p><Link className="btn btn-secondary" href="/payments">Open payment ledger <ArrowRight size={15} /></Link></section>
    <section><div className="section-heading"><h2>Clubhouse activity</h2></div><div className="activity-list">{notifications.length ? notifications.slice(0,3).map(n => <div className="activity-item" key={n.id}><span className="activity-dot" /><div><p>{n.message}</p><small>{new Date(n.created_at+'Z').toLocaleDateString('en-IN',{month:'short',day:'numeric'})}</small></div></div>) : <p className="muted text-sm">Match updates will appear here when your squad gets moving.</p>}</div></section>
    </div></div>
  </div>;
}

