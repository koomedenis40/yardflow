'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Icon } from '@/components/ui/icon';

export default function LoginPage() {
  const { login, session, isLoading } = useAuth();
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('Password123!');
  const [tenantSlug, setTenantSlug] = useState('demo-yard');
  const [showPassword, setShowPassword] = useState(false);
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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      <div className="login-card">

        {/* ── Left: form panel ── */}
        <div className="login-panel">
          <div className="login-panel__brand">
            <span className="login-panel__logo">
              <Icon icon={Package} size={18} strokeWidth={2} />
            </span>
            <span className="login-panel__brand-name">YardFlow</span>
          </div>

          <h1 className="login-panel__title">Welcome back</h1>
          <p className="login-panel__lead">Sign in to your yard dashboard</p>

          <form className="login-form" onSubmit={onSubmit}>
            <label className="login-field">
              <span>Email</span>
              <input
                className="login-field__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="owner@youryard.com"
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-field__wrap">
                <input
                  className="login-field__input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="login-field__eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <Icon icon={showPassword ? EyeOff : Eye} size={16} />
                </button>
              </div>
            </label>

            <label className="login-field">
              <span>Yard</span>
              <input
                className="login-field__input"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="your-yard-slug"
              />
            </label>

            {error && <p className="field-error">{error}</p>}

            <button type="submit" disabled={submitting} className="login-submit">
              {submitting ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        </div>

        {/* ── Right: visual panel ── */}
        <div className="login-visual" aria-hidden>
          <div className="login-visual__grid" />
          <div className="login-visual__glow login-visual__glow--top" />
          <div className="login-visual__glow login-visual__glow--bottom" />
          <div className="login-visual__content">
            <p className="login-visual__eyebrow">Scrap yard operations</p>
            <h2 className="login-visual__headline">
              Every tonne<br />tracked in<br />real time
            </h2>
            <div className="login-visual__chips">
              <div className="login-visual__chip">
                <span className="login-visual__chip-value">KES 248K</span>
                <span className="login-visual__chip-label">today&apos;s intake</span>
              </div>
              <div className="login-visual__chip">
                <span className="login-visual__chip-value">43.2 t</span>
                <span className="login-visual__chip-label">stock on hand</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
