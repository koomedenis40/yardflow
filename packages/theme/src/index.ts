/**
 * YardFlow design tokens — single source of truth for web and mobile.
 * Mirrors the CSS custom properties in apps/web/src/app/globals.css.
 * Mobile (apps/pos) consumes these directly as StyleSheet values.
 */

// ─── Colors ─────────────────────────────────────────────────────────────────

export const colors = {
  // Canvas / surfaces
  canvas: '#f7f8fa',
  surface: '#ffffff',

  // Text
  text: '#161616',
  muted: '#8d9196',

  // Borders / dividers
  border: '#e8eaed',

  // Operational green — purchases, stock, primary confirm
  green: {
    900: '#0e4f3a',   // featured KPI background
    800: '#146b4d',   // primary button default
    700: '#17835c',   // primary button hover
    100: '#e8f5ef',   // active nav bg, success badge bg
    50:  '#f4faf7',   // sidebar wash
  },

  // Operational blue — sales, info, focus
  blue: {
    700: '#0043ce',   // sale actions, info primary
    600: '#0f62fe',   // focus ring, login CTA
    100: '#edf5ff',   // active nav (sales), info badge bg
    50:  '#f6faff',   // subtle info panels
  },

  // Operational red — destructive, failed, oversell
  red: {
    700: '#da1e28',   // destructive button, error text
    100: '#fff1f1',   // failed badge background
  },

  // Warning amber — pending, partial, low stock
  amber: {
    bg:   '#fcf4d6',
    text: '#8a6800',
  },

  // Neutrals
  neutral: {
    0:   '#ffffff',
    50:  '#f7f8fa',   // app canvas (same as canvas)
    100: '#f2f4f6',   // sidebar tint, table header bg
    200: '#e8eaed',   // dividers (same as border)
    400: '#8d9196',   // muted text (same as muted)
    700: '#393939',   // secondary text
    900: '#161616',   // primary text (same as text)
  },
} as const;

// Semantic aliases for convenience
export const palette = {
  // Backgrounds
  canvasBg:       colors.canvas,
  surfaceBg:      colors.surface,
  sidebarBg:      colors.green[50],

  // Text
  textPrimary:    colors.text,
  textMuted:      colors.muted,
  textSecondary:  colors.neutral[700],

  // Borders
  borderDefault:  colors.border,

  // Primary actions (purchase/confirm)
  primaryBg:      colors.green[800],
  primaryHover:   colors.green[700],
  primaryText:    '#ffffff',
  featuredBg:     colors.green[900],

  // Secondary actions (sale/info)
  secondaryBg:    colors.blue[700],
  secondaryText:  '#ffffff',

  // Focus ring
  focusRing:      colors.blue[600],

  // Destructive
  dangerBg:       colors.red[700],
  dangerText:     '#ffffff',

  // Status badges
  paidBg:         colors.green[100],
  paidText:       colors.green[900],
  partialBg:      colors.amber.bg,
  partialText:    colors.amber.text,
  unpaidBg:       colors.neutral[100],
  unpaidText:     colors.muted,
  errorBg:        colors.red[100],
  errorText:      colors.red[700],

  // Semantic deltas
  deltaIn:        colors.green[800],
  deltaOut:       colors.red[700],
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// 4px base grid

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

// ─── Typography ────────────────────────────────────��─────────────────────────

export const fontSize = {
  display:  32,   // login headline
  h1:       24,   // page title
  h2:       18,   // panel title
  h3:       15,   // section label, drawer heading
  body:     14,   // body, table cells
  bodySm:   13,   // secondary meta
  caption:  12,   // KPI label, table header
  kpi:      28,   // KPI value
  kpiLg:    36,   // hero KPI (total stock)
} as const;

export const fontWeight = {
  regular: '400',
  medium:  '500',
  semibold: '600',
  bold:    '700',
} as const;

export const lineHeight = {
  tight:   1.1,
  snug:    1.25,
  normal:  1.5,
  relaxed: 1.6,
} as const;

export const letterSpacing = {
  tight:    -0.02,  // headings
  normal:    0,
  wide:      0.04,  // tags
  wider:     0.06,  // table headers, KPI labels
  widest:    0.08,  // section labels
} as const;

// Mobile: inputs minimum 16px to prevent iOS zoom
export const mobileFontSize = {
  input:   16,
  body:    14,
  caption: 12,
  kpi:     28,
} as const;

// ─── Border radius ───────���───────────────────────────────────────────────────

export const radius = {
  sm: 8,
  md: 12,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadows = {
  subtle:   '0 4px 16px rgba(22, 22, 22, 0.06)',
  elevated: '0 8px 28px rgba(22, 22, 22, 0.10)',
} as const;

// ─── Layout ────���─────────────────────────────────────────────────────────────

export const layout = {
  sidebarWidth:  252,
  headerHeight:   72,
  drawerWidth:   480,
  pageMaxWidth:  1440,
  touchTarget:    48,   // mobile minimum tap target (dp)
} as const;

// ─── Re-exports (convenience) ─────────���──────────────────────────────────────

export type ColorToken = keyof typeof palette;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof fontSize;
