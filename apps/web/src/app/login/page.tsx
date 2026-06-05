'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Icon } from '@/components/ui/icon';
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
        <div className="login-panel__brand">
          <span className="login-panel__logo">
            <Icon icon={Package} size={20} strokeWidth={2} />
          </span>
          <span className="sidebar__logo">YardFlow</span>
        </div>
        <h1 className="login-panel__title">Log in to YardFlow</h1>
        <p className="login-panel__lead">Operational ledger for scrap yards</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              className="login-field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input
              className="login-field__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="login-field">
            <span>Yard slug</span>
            <input
              className="login-field__input"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
            />
          </label>
          {error && <p className="field-error">{error}</p>}
          <Button variant="primary" disabled={submitting} type="submit" style={{ width: '100%', marginTop: 8 }}>
            {submitting ? 'Signing in…' : (
              <>
                Continue
                <Icon icon={ArrowRight} size={16} />
              </>
            )}
          </Button>
        </form>
      </div>
      <div className="login-visual" aria-hidden>
        <div className="login-visual__grid" />
        <div className="login-visual__accent" />
        <div className="login-visual__shape login-visual__shape--1" />
        <div className="login-visual__shape login-visual__shape--2" />
        <div className="login-visual__shape login-visual__shape--3" />
        <p className="login-visual__tag">
          Industrial operations · Calm control · High-trust ledger
        </p>
      </div>
    </div>
  );
}
