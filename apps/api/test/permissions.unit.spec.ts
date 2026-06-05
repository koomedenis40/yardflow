import {
  CASHIER_PERMISSIONS,
  OWNER_PERMISSIONS,
  PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
  hasPermission,
} from '@yardflow/types';

describe('permissions', () => {
  it('owner has report:view and audit:view', () => {
    expect(OWNER_PERMISSIONS).toContain(PERMISSIONS.REPORT_VIEW);
    expect(OWNER_PERMISSIONS).toContain(PERMISSIONS.AUDIT_VIEW);
  });

  it('cashier lacks owner-only permissions', () => {
    expect(CASHIER_PERMISSIONS).not.toContain(PERMISSIONS.REPORT_VIEW);
    expect(CASHIER_PERMISSIONS).not.toContain(PERMISSIONS.AUDIT_VIEW);
  });

  it('hasPermission enforces all required', () => {
    expect(hasPermission(OWNER_PERMISSIONS, [PERMISSIONS.REPORT_VIEW, PERMISSIONS.AUDIT_VIEW])).toBe(
      true,
    );
    expect(hasPermission(CASHIER_PERMISSIONS, PERMISSIONS.REPORT_VIEW)).toBe(false);
  });

  it('platform admin has tenant create', () => {
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain(PERMISSIONS.PLATFORM_TENANT_CREATE);
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain(PERMISSIONS.PLATFORM_TENANT_VIEW);
  });
});
