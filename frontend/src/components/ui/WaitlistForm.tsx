import { useState } from 'react';

export function WaitlistForm({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    try {
      const res = await fetch('/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const existing = JSON.parse(localStorage.getItem('eugene_waitlist') || '[]');
        existing.push({ email, ts: new Date().toISOString() });
        localStorage.setItem('eugene_waitlist', JSON.stringify(existing));
        setSubmitted(true);
      }
    } catch {
      const existing = JSON.parse(localStorage.getItem('eugene_waitlist') || '[]');
      existing.push({ email, ts: new Date().toISOString() });
      localStorage.setItem('eugene_waitlist', JSON.stringify(existing));
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <p className={`text-sm font-medium ${dark ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        You're on the list. We'll notify you when paid tiers launch.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-slate-400 dark:focus:ring-slate-400"
      />
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        Join waitlist
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
