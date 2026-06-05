// Shared scalar/value aliases mirroring DATABASE_CONTRACTS.md numeric contracts.

export type UUID = string;

/** ISO-8601 timestamp string (stored UTC; displayed Africa/Nairobi). */
export type ISODateString = string;

/** KES monetary value. DB: NUMERIC(14,2). Never a float intermediate in the ledger. */
export type Money = number;

/** Weight in kilograms. DB: NUMERIC(12,3). Kilograms are the only operational unit. */
export type WeightKg = number;
