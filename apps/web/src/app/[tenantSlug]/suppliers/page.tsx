'use client';

import { useParams } from 'next/navigation';
import { PartyWorkspace } from '@/components/ops/party-workspace';

export default function SuppliersPage() {
  const tenantSlug = useParams().tenantSlug as string;
  return <PartyWorkspace mode="supplier" tenantSlug={tenantSlug} />;
}
