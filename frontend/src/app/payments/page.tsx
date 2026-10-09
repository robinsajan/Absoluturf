'use client';
import Select from '../../components/Select';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, CheckCheck, Clock, Copy, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useStore, api } from '../../store/useStore';
import Dialog from '../../components/Dialog';
import { money, matchDate } from '../../lib/format';
type PaymentStatus = 'pending' | 'verification_pending' | 'verified';
interface Payment { match_id:number; user_id:number; player_name:string; group_name:string; turf_name:string; match_date:string; upi_id:string|null; organizer_name:string; splits:number; total_due:number; amount_paid:number; transfer_due:number; status:PaymentStatus; }
interface Ledger { payments:Payment[]; summary:{total_due:number; verified:number; outstanding:number; verification_pending:number}; }
const labels = {pending:'To pay',verification_pending:'Awaiting verification',verified:'Verified'};
export default function PaymentsPage() {
  const { user, groups } = useStore();
  const [scope, setScope] = useState<'mine'|'managed'>('mine');
  const [filter, setFilter] = useState('all');
  const [ledger,setLedger] = useState<Ledger|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [selected,setSelected] = useState<Payment|null>(null);
  const [copied,setCopied] = useState(false);
  const admin = groups.some(g=>g.role==='Admin');
  const load = useCallback(async () => {
    try { const r=await api.get('/payments',{params:{scope}}); setLedger(r.data); setError(''); }
    catch { setError('Could not load the payment ledger. Please retry.'); }
    finally { setLoading(false); }
  },[scope]);
  useEffect(()=>{
    let active = true;
    api.get('/payments',{params:{scope}}).then(r=>{if(active){setLedger(r.data);setError('');}})
      .catch(()=>{if(active)setError('Could not load the payment ledger. Please retry.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[scope]);
  if (!user) return null;
  const submit = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await api.post(scope==='mine' ? `/matches/${selected.match_id}/pay` : `/matches/${selected.match_id}/verify_payment/${selected.user_id}`);
      setSelected(null);
      setNotice(scope==='mine' ? 'Payment submitted. Your group admin will verify the transfer.' : 'Payment verified. The player has been notified.');
      await load();
    } catch (e:unknown) {
      const response=e as {response?:{data?:{error?:string}}};
      setError(response.response?.data?.error || 'Could not update this payment.');
    } finally {setBusy(false);}
  };
  const rows=ledger?.payments.filter(p=>filter==='all'||p.status===filter)||[];
  return <div>
    <div className="page-intro"><div><span className="eyebrow accent">Squad finances</span><h1>Every share, accounted for.</h1><p>Your matches, guest shares and payment confirmations.</p></div><button className="icon-button" aria-label="Refresh payments" disabled={loading} onClick={()=>{setLoading(true);load();}}><RefreshCw size={19}/></button></div>
    {notice && <div className="inline-message" role="status">{notice}</div>}
    {error && !selected && <div className="inline-message error" role="alert">{error} <button className="text-link" onClick={()=>{setLoading(true);load();}}>Retry</button></div>}
    <div className="metric-grid">
      {[{label:'Total shares',value:ledger?.summary.total_due,icon:Wallet},{label:'Verified',value:ledger?.summary.verified,icon:CheckCheck},{label:'To settle',value:ledger?.summary.outstanding,icon:Clock},{label:'Awaiting review',value:ledger?.summary.verification_pending,icon:ShieldCheck}].map(({label,value,icon:Icon},i)=><div className="metric" key={label}><div className="metric-top">{label}<Icon size={16}/></div><div className="metric-value">{loading ? '—' : i===3 ? value||0 : money(value||0)}</div><small>{i===2 ? 'Unpaid and awaiting verification' : scope==='mine' ? 'Your match shares' : 'Across groups you manage'}</small></div>)}
    </div>
    <div className="filter-row"><div className="segmented" role="group" aria-label="Payment scope"><button className={scope==='mine'?'active':''} onClick={()=>{setLoading(true);setScope('mine');setNotice('');}}>My payments</button>{admin&&<button className={scope==='managed'?'active':''} onClick={()=>{setLoading(true);setScope('managed');setNotice('');}}>Manage squad payments</button>}</div><Select className="input" aria-label="Filter payment status" value={filter} onValueChange={value=>setFilter(value)}><option value="all">All statuses</option><option value="pending">To pay</option><option value="verification_pending">Awaiting verification</option><option value="verified">Verified</option></Select></div>
    {loading ? <div className="ledger" aria-label="Loading payments"><div className="skeleton"/><div className="skeleton"/></div> : rows.length ? <div className="ledger">{rows.map(p=><article className="payment-row" key={`${p.match_id}-${p.user_id}`}><div><h3>{p.turf_name}</h3><p>{p.group_name} · {matchDate(p.match_date)}</p><p>{scope==='managed'?p.player_name:'Your share'}{p.splits>1?` + ${p.splits-1} guest(s)`:''}</p><Link className="text-link" href={`/matches?id=${p.match_id}`}>Matchroom <ArrowUpRight size={14}/></Link></div><div><div className="payment-amount">{money(p.total_due)}</div><span className={`badge ${p.status==='verified'?'badge-green':p.status==='pending'?'badge-yellow':'badge-gray'}`}>{labels[p.status]}</span></div>
      {p.status!=='verified' && <div className="payment-actions"><p>{scope==='mine' ? p.status==='pending'?'Pay your organiser directly, then submit for verification.':'Your transfer is awaiting group admin verification.' : p.status==='verification_pending'?'Check the bank or UPI transfer before verifying.':'This player has not submitted a payment yet.'}</p>{scope==='mine' && p.status==='pending' ? <button className="btn btn-primary" onClick={()=>{setSelected(p);setError('');setCopied(false);}}>Payment details <ArrowUpRight size={15}/></button> : scope==='managed'&&p.status==='verification_pending' ? <button className="btn btn-primary" onClick={()=>{setSelected(p);setError('');}}>Verify payment <CheckCheck size={15}/></button>:null}</div>}
    </article>)}</div> : <div className="empty-state"><Wallet size={34}/><h3>{filter==='all'?'No payments here yet':'No payments with this status'}</h3><p>{filter==='all'?'Your shares appear once a paid match is confirmed by the organiser.':'Choose another filter to view your ledger.'}</p><Link href="/matches" className="btn btn-secondary">Explore matches <ArrowUpRight size={16}/></Link></div>}
    {selected && <Dialog title={scope==='mine'?'Settle your match share':'Verify this transfer'} onClose={()=>{if(!busy){setSelected(null);setError('');}}}><p>{selected.turf_name} · {scope==='managed'?selected.player_name:selected.organizer_name}</p><div className="metric-value">{money(scope === 'mine' ? selected.transfer_due : selected.total_due)}</div>{scope === 'mine' && selected.amount_paid > 0 && <p>Previously recorded: {money(selected.amount_paid)}. Full share: {money(selected.total_due)}.</p>}<p>{selected.splits} player share(s), including confirmed guests.</p>{scope==='mine'?<>{selected.upi_id?<div className="upi-box"><div><span className="eyebrow muted">Organiser UPI ID</span><strong>{selected.upi_id}</strong></div><button className="icon-button" aria-label="Copy organiser UPI ID" onClick={async()=>{try{await navigator.clipboard.writeText(selected.upi_id!);setCopied(true);}catch{setError('Could not copy. Please copy the UPI ID manually.');}}}>{copied?<CheckCheck size={18}/>:<Copy size={18}/>}</button></div>:<div className="inline-message">Ask {selected.organizer_name} for payment details before submitting.</div>}<p>Transfer the amount using your banking or UPI app. Only select “I have paid” after the transfer succeeds.</p></>:<p>Confirm that you received {money(selected.total_due)} from {selected.player_name}. This marks the share as verified and notifies the player.</p>}{error&&<div className="inline-message error" role="alert">{error}</div>}<div className="dialog-actions"><button className="btn btn-ghost" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={submit}>{busy?'Saving…':scope==='mine'?'I have paid':'Confirm received'}</button></div></Dialog>}
  </div>;
}


