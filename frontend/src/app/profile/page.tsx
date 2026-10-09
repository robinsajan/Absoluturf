'use client';
import Select from '../../components/Select';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, Sun, Shield, CalendarDays, Plus, Trash2, ArrowUpRight, LogOut } from 'lucide-react';
import { useStore, api, Group, Member, Penalty } from '../../store/useStore';
import Dialog from '../../components/Dialog';
import { matchDate } from '../../lib/format';
export default function ProfilePage() {
  const {user,groups,matches,penalties,fetchPenalties,updateProfile,logout,deleteAccount,theme,setTheme,createPenalty,deletePenalty} = useStore();
  const [notice,setNotice] = useState('');
  const [showPenalty,setShowPenalty] = useState(false);
  const [showDelete,setShowDelete] = useState(false);
  const [busy,setBusy] = useState(false);
  const [groupId,setGroupId] = useState('');
  const [memberId,setMemberId] = useState('');
  const [members,setMembers] = useState<Member[]>([]);
  const [type,setType] = useState<Penalty['penalty_type']>('Match Ban');
  const [duration,setDuration] = useState(1);
  const [reason,setReason] = useState('');
  const [memberError,setMemberError] = useState('');
  useEffect(()=>{fetchPenalties();},[fetchPenalties]);
  useEffect(()=>{
    let active=true;
    if(groupId) api.get<Group>(`/groups/${groupId}`).then(r=>{if(active){setMembers((r.data.members || []).filter(m=>m.status==='Approved' && m.id!==user?.id));setMemberError('');}}).catch(()=>{if(active)setMemberError('Could not load group members. Please select the group again.');});
    return ()=>{active=false;};
  },[groupId,user?.id]);
  if(!user)return null;
  const adminGroups=groups.filter(g=>g.role==='Admin');
  const myPenalties=penalties.filter(p=>p.user_id===user.id&&p.remaining_matches>0);
  const managed=penalties.filter(p=>adminGroups.some(g=>g.id===p.group_id)&&p.user_id!==user.id);
  const history=matches.filter(m=>m.status==='Completed'&&m.user_vote==='Yes');
  const save=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setBusy(true);setNotice('');
    const data=new FormData(e.currentTarget);
    const ok=await updateProfile({name:String(data.get('name')),phone:String(data.get('phone')),upi_id:String(data.get('upi_id'))});
    if(ok)setNotice('Profile updated successfully.');
    setBusy(false);
  };
  const apply=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);
    const ok=await createPenalty({group_id:Number(groupId),user_id:Number(memberId),penalty_type:type,remaining_matches:duration,reason});
    if(ok){setShowPenalty(false);await fetchPenalties();setNotice('Penalty applied. The player has been notified.');}
    setBusy(false);
  };
  return <div className="space-y-7"><div className="page-intro"><div><span className="eyebrow accent">Your clubhouse identity</span><h1>Player profile</h1><p>Account details, preferences and your match history.</p></div><button className="icon-button" aria-label="Sign out" onClick={logout}><LogOut size={20}/></button></div>{notice&&<div className="inline-message" role="status">{notice}</div>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><section className="card p-6"><div className="flex items-center gap-4 mb-6"><span className="avatar" style={{width:56,height:56,fontSize:24}}>{user.name[0]}</span><div><h2 className="text-2xl m-0">{user.name}</h2><p className="text-sm muted">{user.email}</p></div></div><form onSubmit={save} key={user.id}><div className="form-field"><label htmlFor="profile-name">Full name</label><input className="input" id="profile-name" name="name" defaultValue={user.name} required maxLength={100}/></div><div className="form-field"><label htmlFor="profile-phone">Phone number</label><input className="input" id="profile-phone" name="phone" defaultValue={user.phone} type="tel" required pattern="[+]?[0-9]{10,15}"/></div><div className="form-field"><label htmlFor="profile-upi">UPI ID for receiving match payments</label><input className="input" id="profile-upi" name="upi_id" defaultValue={user.upi_id || ''} placeholder="name@bank" maxLength={100}/><small className="muted">Shared with players when you organise a match.</small></div><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button></form></section>
    <div className="space-y-6"><section className="card p-6"><div className="section-heading"><h2>Preferences</h2></div><p className="text-sm muted mb-4">Choose how your clubhouse looks.</p><button className="btn btn-secondary" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}Switch to {theme==='dark'?'light':'dark'} mode</button></section>
    <section className="card p-6"><div className="section-heading"><h2>Account</h2></div><p className="text-sm muted mb-4">Member since {new Date(user.created_at).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}.</p><button className="btn btn-danger" onClick={()=>setShowDelete(true)}><Trash2 size={16}/>Deactivate account</button><p className="text-xs muted mt-3">Deactivation closes access to your account and retains past match records.</p></section></div></div>
    {myPenalties.length>0&&<section><div className="section-heading"><h2>Your active penalties</h2></div><div className="ledger">{myPenalties.map(p=><div className="card p-5" key={p.id}><span className="badge badge-red">{p.penalty_type}</span><h3 className="text-lg mt-3">{p.group_name}</h3><p className="text-sm muted">{p.remaining_matches} match(es) remaining · {p.reason || 'No reason provided'}</p></div>)}</div></section>}
    {adminGroups.length>0&&<section className="card p-6"><div className="section-heading"><h2>Squad discipline</h2><button className="btn btn-secondary" onClick={()=>setShowPenalty(true)}><Plus size={16}/>Apply penalty</button></div><p className="muted text-sm mb-5">Match bans and voting restrictions for the groups you manage.</p>{managed.length?managed.map(p=><div className="fixture-row" key={p.id}><Shield size={20} className="accent"/><div><strong>{p.user_name} · {p.penalty_type}</strong><p>{p.group_name} · {p.remaining_matches} match(es) · {p.reason}</p></div><button className="icon-button ml-auto" aria-label={`Remove penalty for ${p.user_name}`} onClick={()=>{if(confirm('Remove this penalty?'))deletePenalty(p.id);}}><Trash2 size={17}/></button></div>):<p className="muted text-sm">No penalties on members in your managed groups.</p>}</section>}
    <section><div className="section-heading"><h2>Your match history</h2></div>{history.length?history.map(m=><Link className="fixture-row" key={m.id} href={`/matches?id=${m.id}`}><CalendarDays size={22} className="accent"/><div><strong>{m.turf_name}</strong><p>{matchDate(m.match_date)} · {m.location}</p></div><ArrowUpRight size={18}/></Link>):<div className="empty-state"><CalendarDays size={30}/><h3>Your season is just getting started</h3><p>Completed matches you played will appear here.</p><Link className="text-link" href="/matches">Find your next fixture <ArrowUpRight size={15}/></Link></div>}</section>
    {showPenalty&&<Dialog title="Apply a penalty" onClose={()=>{if(!busy)setShowPenalty(false);}}><form onSubmit={apply}><div className="form-field"><label htmlFor="penalty-group">Group</label><Select id="penalty-group" className="input" value={groupId} onValueChange={value=>{setGroupId(value);setMemberId('');setMembers([]);}} required><option value="">Select a group</option>{adminGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</Select></div><div className="form-field"><label htmlFor="penalty-player">Player</label><Select id="penalty-player" className="input" value={memberId} onValueChange={value=>setMemberId(value)} required disabled={!members.length}><option value="">{groupId?'Select a player':'Select a group first'}</option>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</Select>{memberError&&<p className="inline-message error">{memberError}</p>}</div><div className="form-field"><label htmlFor="penalty-type">Penalty type</label><Select id="penalty-type" className="input" value={type} onValueChange={value=>setType(value as Penalty['penalty_type'])}><option>Match Ban</option><option>Voting Restriction</option></Select></div><div className="form-field"><label htmlFor="penalty-duration">Number of matches</label><input id="penalty-duration" className="input" type="number" min={1} max={100} value={duration} onChange={e=>setDuration(Number(e.target.value))} required/></div><div className="form-field"><label htmlFor="penalty-reason">Reason</label><textarea id="penalty-reason" className="input" value={reason} onChange={e=>setReason(e.target.value)} required/></div><div className="dialog-actions"><button className="btn btn-ghost" type="button" disabled={busy} onClick={()=>setShowPenalty(false)}>Cancel</button><button className="btn btn-primary" disabled={busy||!memberId}>Apply penalty</button></div></form></Dialog>}
    {showDelete&&<Dialog title="Deactivate your account?" onClose={()=>{if(!busy)setShowDelete(false);}}><p>You will lose access to your groups and matches. Historical records are retained for your squad.</p><div className="dialog-actions"><button className="btn btn-ghost" disabled={busy} onClick={()=>setShowDelete(false)}>Keep account</button><button className="btn btn-danger" disabled={busy} onClick={async()=>{setBusy(true);await deleteAccount();setBusy(false);}}>Deactivate account</button></div></Dialog>}
  </div>;
}

