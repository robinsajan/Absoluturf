'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import Brand, { Pitch } from '../../components/Brand';
export default function LoginPage() { return <Suspense fallback={<div className="boot-skeleton"><div className="skeleton"/></div>}><LoginContent/></Suspense>; }
function LoginContent() {
  const params = useSearchParams();
  const [isLogin,setIsLogin] = useState(params.get('mode')!=='signup');
  const [name,setName] = useState(''); const [email,setEmail] = useState(''); const [phone,setPhone] = useState(''); const [password,setPassword] = useState('');
  const {login,signup,user,error,clearError,loading} = useStore();
  const router = useRouter();
  const requested = params.get('redirect') || '/dashboard';
  const redirect = requested.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/login') ? requested : '/dashboard';
  useEffect(()=>{ if(user) router.replace(redirect); },[user,router,redirect]);
  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); clearError();
    const ok=isLogin?await login(email.trim(),password):await signup(name.trim(),email.trim(),phone.trim(),password);
    if(ok) router.replace(redirect);
  };
  return <div className="auth-page"><section className="auth-story"><Brand/><div><span className="eyebrow accent">Welcome to the clubhouse</span><h1>Good games.<br/>Great squads.<br/><span className="accent">All together.</span></h1><p>Your next fixture, your playing list and your match shares. Everything your weekly game needs.</p></div><Pitch className="welcome-pitch"/><Link href="/" className="text-link">Back to AbsoluTurf</Link></section>
    <section className="auth-form-wrap"><div className="auth-form"><span className="eyebrow accent">{isLogin?'Ready for matchday?':'Make it a regular game'}</span><h2>{isLogin?'Welcome back':'Join the clubhouse'}</h2><p>{isLogin?'Sign in to see what your squad is planning.':'Create your account and bring your squad together.'}</p>
    <form onSubmit={submit}>{!isLogin&&<><div className="form-field"><label htmlFor="name">Full name</label><input id="name" className="input" autoComplete="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></div><div className="form-field"><label htmlFor="phone">Phone number</label><input id="phone" className="input" type="tel" autoComplete="tel" required pattern="[+]?[0-9]{10,15}" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10–15 digits, with optional +"/></div></>}
      <div className="form-field"><label htmlFor="email">Email address</label><input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete={isLogin?'current-password':'new-password'} required minLength={isLogin?1:8} value={password} onChange={e=>setPassword(e.target.value)} placeholder={isLogin?'Your password':'At least 8 characters'}/></div>
      {error&&<div className="inline-message error" role="alert">{error}</div>}<button className="btn btn-primary" disabled={loading} type="submit">{loading?'Please wait…':isLogin?'Sign in':'Create account'}<ArrowRight size={16}/></button>
    </form><p className="auth-switch">{isLogin?'New to AbsoluTurf?':'Already have an account?'} <button className="text-link" onClick={()=>{setIsLogin(!isLogin);clearError();setPassword('');}}>{isLogin?'Create an account':'Sign in'}</button></p></div></section>
  </div>;
}

