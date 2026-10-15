import { FormEvent, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function AuthPage() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const error = mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    setMessage(error ?? (mode === 'sign-up' ? 'Check your inbox to confirm your email.' : ''));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base-bg px-4 py-10 text-text-primary">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand/15 text-brand"><ShieldCheck /></div>
          <div><p className="text-lg font-semibold">Togetherly</p><p className="text-sm text-text-secondary">Workforce intelligence</p></div>
        </div>
        <h1 className="text-2xl font-semibold">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-sm text-text-secondary">{mode === 'sign-in' ? 'Sign in to your secure workspace.' : 'Start with a secure workspace account.'}</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-border bg-base-bg px-3 py-2.5 outline-none focus:border-brand" autoComplete="email" /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-border bg-base-bg px-3 py-2.5 outline-none focus:border-brand" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></label>
          {message && <p className="rounded-lg border border-border bg-base-bg px-3 py-2 text-sm text-text-secondary" role="status">{message}</p>}
          {!configured && <p className="text-sm text-warning">Supabase is not configured in this preview.</p>}
          <button disabled={busy || !configured} className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-semibold text-base-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}<ArrowRight size={17} /></button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); }} className="mt-6 text-sm text-brand hover:underline">{mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button>
      </section>
    </main>
  );
}
