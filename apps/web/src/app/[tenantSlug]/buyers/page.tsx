'use client';

import { useParams } from 'next/navigation';
import { PartyWorkspace } from '@/components/ops/party-workspace';

export default function BuyersPage() {
  const tenantSlug = useParams().tenantSlug as string;
  return <PartyWorkspace mode="buyer" tenantSlug={tenantSlug} />;
}
