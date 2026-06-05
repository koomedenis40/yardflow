'use client';

import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  const { session } = useAuth();
  return (
    <div className="settings-panel">
      <h2>Tenant settings</h2>
      <p className="muted">Operational preferences — more controls in later milestones.</p>
      <dl className="settings-dl">
        <dt>Yard</dt>
        <dd>{session?.user.tenantSlug}</dd>
        <dt>Role</dt>
        <dd>{session?.user.role}</dd>
        <dt>User</dt>
        <dd>{session?.user.fullName}</dd>
        <dt>Email</dt>
        <dd>{session?.user.email}</dd>
      </dl>
    </div>
  );
}
