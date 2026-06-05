/** Default scrap categories seeded on tenant creation (SYSTEM_RULES Sec 6). */
export const DEFAULT_SCRAP_CATEGORIES = [
  'Light Steel',
  'Heavy Steel',
  'Gumboots',
  'Plastics',
  'Cast Iron',
  'Books',
  'Soft Aluminium',
  'Hard Aluminium',
  'Dawa',
  'Brass',
  'Big Batteries',
  'Small Batteries',
] as const;

export type DefaultScrapCategory = (typeof DEFAULT_SCRAP_CATEGORIES)[number];
