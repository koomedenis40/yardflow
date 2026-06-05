/** Permission strings from docs/PERMISSION_MATRIX.md */
export const PERMISSIONS = {
  PLATFORM_TENANT_CREATE: 'platform:tenant:create',
  PLATFORM_TENANT_VIEW: 'platform:tenant:view',
  PLATFORM_TENANT_UPDATE_STATUS: 'platform:tenant:update_status',
  PLATFORM_TENANT_SUSPEND: 'platform:tenant:suspend',
  TENANT_VIEW: 'tenant:view',
  CATEGORY_VIEW: 'category:view',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_UPDATE: 'category:update',
  CATEGORY_DEACTIVATE: 'category:deactivate',
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

/** Yard owner — full operational permissions (M1+ matrix subset for JWT; extended in later milestones). */
export const OWNER_PERMISSIONS: readonly string[] = [
  'tenant:view',
  'category:view',
  'category:create',
  'category:update',
  'category:deactivate',
  'supplier:create',
  'supplier:update',
  'supplier:view',
  'supplier:deactivate',
  'buyer:create',
  'buyer:update',
  'buyer:view',
  'buyer:deactivate',
  'purchase:create',
  'purchase:view',
  'purchase:correct',
  'sale:create',
  'sale:view',
  'sale:correct',
  'supplier_payment:create',
  'buyer_payment:create',
  'payment:view',
  'inventory:view',
  'inventory:adjust',
  'receipt:print',
  'receipt:reprint',
  'report:view',
  'report:export',
  'billing:view',
  'billing:pay',
  'audit:view',
  'settings:update',
  'data:export',
  'user:invite',
  'user:disable',
  'user:change_role',
];

/** Cashier — operational day-to-day; includes category:view for POS/web (M1 decision). */
export const CASHIER_PERMISSIONS: readonly string[] = [
  'category:view',
  'supplier:create',
  'supplier:update',
  'supplier:view',
  'buyer:create',
  'buyer:update',
  'buyer:view',
  'purchase:create',
  'purchase:view',
  'sale:create',
  'sale:view',
  'supplier_payment:create',
  'buyer_payment:create',
  'payment:view',
  'inventory:view',
  'receipt:print',
  'receipt:reprint',
];

export const PLATFORM_ADMIN_PERMISSIONS: readonly string[] = [
  'platform:tenant:create',
  'platform:tenant:view',
  'platform:tenant:update_status',
  'platform:tenant:suspend',
  'audit:view',
  'billing:view',
];

export const hasPermission = (
  userPermissions: readonly string[],
  required: string | readonly string[],
  mode: 'all' | 'any' = 'all',
): boolean => {
  const list = typeof required === 'string' ? [required] : [...required];
  return mode === 'any'
    ? list.some((p) => userPermissions.includes(p))
    : list.every((p) => userPermissions.includes(p));
};

export const permissionsForRole = (
  role: 'owner' | 'cashier' | 'platform_admin',
): readonly string[] => {
  switch (role) {
    case 'owner':
      return OWNER_PERMISSIONS;
    case 'cashier':
      return CASHIER_PERMISSIONS;
    case 'platform_admin':
      return PLATFORM_ADMIN_PERMISSIONS;
  }
};
