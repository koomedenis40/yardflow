'use client';

import { useParams } from 'next/navigation';
import { BalancesWorkspace } from '@/components/ops/balances-workspace';

export default function BalancesPage() {
  const tenantSlug = useParams().tenantSlug as string;
  return <BalancesWorkspace tenantSlug={tenantSlug} />;
}
