'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { login, session, isLoading } = useAuth();
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('Password123!');
  const [tenantSlug, setTenantSlug] = useState('demo-yard');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading && session?.user.tenantSlug) {
      setRedirecting(true);
      window.location.href = `/${session.user.tenantSlug}/dashboard`;
    }
  }, [isLoading, session?.user.tenantSlug]);

  if (redirecting || (session && !isLoading)) {
    return <div className="loading-shell">Signing you in…</div>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password, tenantSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <h1 className="login-panel__title">YardFlow</h1>
        <p className="login-panel__lead">Operational ledger for scrap yards</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            <span>Yard slug</span>
            <input
              className="field-input"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
            />
          </label>
          {error && <p className="field-error">{error}</p>}
          <Button variant="primary" disabled={submitting} type="submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
      <div className="login-visual" aria-hidden>
        <div className="login-visual__grid" />
        <p className="login-visual__tag">Industrial · Calm · High-trust</p>
      </div>
    </div>
  );
}
