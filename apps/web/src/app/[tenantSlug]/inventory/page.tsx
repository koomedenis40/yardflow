'use client';

import { useParams } from 'next/navigation';
import { InventoryWorkspace } from '@/components/ops/inventory-workspace';

export default function InventoryPage() {
  const tenantSlug = useParams().tenantSlug as string;
  return <InventoryWorkspace tenantSlug={tenantSlug} />;
}
