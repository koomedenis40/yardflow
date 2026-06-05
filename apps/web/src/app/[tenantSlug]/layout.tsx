import { TenantShell } from '@/components/tenant-shell';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <TenantShell tenantSlug={tenantSlug}>{children}</TenantShell>;
}
