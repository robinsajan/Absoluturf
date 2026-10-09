import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, Users, Wallet, ArrowUpRight, Check } from 'lucide-react';
import Brand from '../components/Brand';
export default function LandingPage() {
  return <main className="landing"><nav className="landing-nav"><Brand/><Link href="/login" className="btn btn-ghost">Sign in <ArrowUpRight size={16}/></Link></nav>
    <section className="landing-hero"><div><span className="player-tag"><i/>Built for your weekly game</span><h1>Your squad.<br/>Your pitch.<br/><span className="accent">Game on.</span></h1><p>Get everyone on the same page. Coordinate matches, fill the playing list and settle the turf bill with AbsoluTurf.</p><Link href="/login?mode=signup" className="btn btn-primary">Get your squad together <ArrowUpRight size={18}/></Link></div><div className="landing-photo"><Image src="/arena.jfif" width={700} height={600} sizes="(max-width: 767px) 100vw, 45vw" priority alt="Football turf under stadium lights"/><div className="landing-caption"><span className="avatar"><Check size={19}/></span><div><strong>One place for matchday.</strong><p>Less chasing. More playing.</p></div></div></div></section>
    <section className="landing-features"><div><span className="eyebrow accent">From group chat to kickoff</span><h2>Keep the game.<br/>Lose the organising.</h2><p className="muted text-sm">Built around the way recurring sports groups play.</p></div><div>{[{icon:Users,title:'A clubhouse for your squad',text:'Create groups, invite your teammates and manage membership approvals.'},{icon:CalendarDays,title:'Know who is playing',text:'Collect attendance votes, add guests and coordinate a waiting list when the pitch is full.'},{icon:Wallet,title:'Make every share clear',text:'Track player and guest shares. Submit transfers for organiser verification and see what is left to settle.'}].map(({icon:Icon,title,text})=><article className="landing-feature" key={title}><h3><Icon size={22}/>{title}</h3><p>{text}</p></article>)}</div></section>
    <footer className="landing-footer"><span>AbsoluTurf · Your squad. Your game.</span><Link href="/login" className="text-link">Go to your clubhouse <ArrowUpRight size={15}/></Link></footer>
  </main>;
}

