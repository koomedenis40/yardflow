# YardFlow — Product Requirements Document (PRD)

# 1. Product Overview

## Product Name

YardFlow

## Product Type

Multi-tenant scrap yard operations and stock management platform.

## Core Purpose

YardFlow enables scrap dealers to:

* record scrap purchases
* track stock by kilograms
* monitor supplier and buyer balances
* manage partial payments and advances
* process Mpesa payments
* print receipts using handheld POS devices
* monitor profit margins
* generate operational reports

The system is designed primarily for small-to-medium scrap yards operating in Kenya and other African markets.

---

# 2. Core Business Problem

Most scrap dealers currently operate using:

* notebooks
* manual calculations
* WhatsApp
* memory-based stock tracking

This causes:

* stock confusion
* payment disputes
* supplier debt confusion
* inaccurate profits
* missing operational records
* fraud risk
* inability to scale

YardFlow solves this by creating a reliable operational ledger system.

---

# 3. Product Goals

## Primary Goals

1. Track all incoming scrap
2. Track all outgoing scrap
3. Track stock balances by category
4. Track partial supplier payments
5. Track buyer balances
6. Integrate Mpesa payments
7. Generate printable receipts
8. Produce operational and profit reports

## Secondary Goals

1. Enable multi-yard support in future
2. Support handheld POS devices
3. Support SaaS billing
4. Build immutable operational records

---

# 4. User Types

## 4.1 Yard Owner

Full access to:

* reports
* billing
* purchases
* sales
* stock
* users
* settings

## 4.2 Clerk/Cashier

Limited access to:

* record purchases
* record sales
* print receipts
* process payments

## 4.3 Admin (Platform Owner)

Controls:

* subscriptions
* tenant management
* dealer billing
* platform monitoring

---

# 5. Multi-Tenant Architecture

The platform MUST support multiple scrap dealers.

Every tenant MUST have isolated:

* purchases
* sales
* suppliers
* buyers
* stock
* users
* reports

All major tables MUST include:

```txt
tenant_id
```

---

# 6. Core Scrap Categories

Default categories:

* Light Steel
* Heavy Steel
* Gumboots
* Plastics
* Cast Iron
* Books
* Soft Aluminium
* Hard Aluminium
* Dawa
* Brass
* Big Batteries
* Small Batteries

Users MUST be able to:

* add new categories
* edit categories
* deactivate categories

---

# 7. Core Modules

# 7.1 Authentication Module

## Features

* login
* logout
* password reset
* role-based access

## Roles

* owner
* cashier
* admin

---

# 7.2 Supplier Management Module

## Features

* create supplier
* edit supplier
* view supplier history
* supplier balances
* supplier payment history

## Supplier Fields

* full name
* phone number
* ID number
* location
* notes

---

# 7.3 Buyer Management Module

## Features

* create buyer
* edit buyer
* buyer balances
* purchase history

---

# 7.4 Scrap Category Module

## Features

* create category
* edit category
* set default buying price
* set default selling price
* activate/deactivate category

---

# 7.5 Purchase Module

Tracks incoming scrap.

## Purchase Fields

* supplier
* category
* weight_kg
* buying_price_per_kg
* total_value
* amount_paid
* balance_remaining
* payment_status
* created_by
* created_at

## Payment Status Values

* unpaid
* partial
* paid

## Business Rules

* purchases increase stock
* negative weights not allowed
* purchases cannot be deleted
* corrections must be separate records

---

# 7.6 Supplier Payment Module

Tracks supplier payments.

## Features

* advance payment
* balance payment
* payment history
* Mpesa payouts
* manual payments

## Payment Fields

* purchase_id
* amount
* payment_method
* mpesa_reference
* created_by
* created_at

## Business Rules

* payment records immutable
* balances auto-update
* overpayments blocked

---

# 7.7 Sales Module

Tracks outgoing scrap.

## Sales Fields

* buyer
* category
* weight_kg
* selling_price_per_kg
* total_sale_value
* amount_received
* balance_remaining
* payment_status

## Business Rules

* stock reduces after sale
* cannot sell above available stock
* sales immutable
* corrections handled separately

---

# 7.8 Buyer Payment Module

Tracks incoming buyer payments.

## Features

* partial payment
* full payment
* payment history
* Mpesa collection
* manual payment

---

# 7.9 Inventory Module

Tracks stock balances.

## Formula

```txt
Current Stock =
Total Purchased
- Total Sold
+ Adjustments
```

## Inventory Features

* stock per category
* stock valuation
* low stock alerts
* stock movement history

---

# 7.10 Receipt Module

## Receipt Types

1. Purchase receipt
2. Supplier payment receipt
3. Sales receipt
4. Buyer payment receipt

## Features

* thermal printing
* CS30 handheld POS support
* PDF download
* reprint support

---

# 7.11 Mpesa Integration Module

## Integrations

Safaricom Daraja API

## Features

* B2C supplier payouts
* STK Push collections
* transaction status tracking
* automatic payment reconciliation

## Stored Fields

* transaction ID
* response code
* amount
* phone number
* timestamps

---

# 7.12 Reports Module

## Reports

* daily purchases
* daily sales
* monthly intake
* stock valuation
* supplier balances
* buyer balances
* profit reports
* category performance

---

# 7.13 Billing Module

## Billing Model

Monthly billing based on intake kilograms.

## Suggested Pricing

* 0–999kg → KES 999
* 1,000–10,000kg → KES 1,588
* 10,001–50,000kg → KES 3,500
* 50,000kg+ → custom

## Billing Formula

```txt
Monthly Intake =
Total Purchased Kilograms
for current billing period
```

## Billing Features

* subscription tracking
* STK Push payments
* account suspension
* invoices
* payment reminders

---

# 8. Immutable Ledger Architecture

The system MUST use immutable operational records.

## Forbidden

* deleting purchases
* overwriting payments
* editing stock directly

## Required

Use event-based records:

* PURCHASE_CREATED
* PAYMENT_ADDED
* SALE_CREATED
* STOCK_ADJUSTMENT
* PURCHASE_CORRECTION

---

# 9. Suggested Database Tables

## Core Tables

* tenants
* users
* suppliers
* buyers
* scrap_categories
* purchases
* purchase_payments
* sales
* sales_payments
* stock_adjustments
* receipts
* mpesa_transactions
* subscriptions
* billing_cycles
* audit_logs

---

# 10. Suggested Tech Stack

## Backend

* NestJS
* Prisma
* PostgreSQL

## Web Frontend

* Next.js
* Tailwind CSS

## Mobile/POS

* React Native
* Android support required

## Infrastructure

* Docker
* Railway / DigitalOcean / Hetzner

---

# 11. Security Requirements

## Required

* role permissions
* audit logs
* immutable financial records
* encrypted passwords
* request validation
* rate limiting

---

# 12. Performance Requirements

System should support:

* 100+ concurrent dealers
* 1M+ transaction records
* receipt printing under 3 seconds

---

# 13. MVP Scope

## MVP Includes

* authentication
* suppliers
* buyers
* purchases
* supplier payments
* sales
* buyer payments
* stock tracking
* receipts
* Mpesa integration
* reports
* billing

## MVP Excludes

* marketplace
* AI pricing
* transport logistics
* public listings
* accounting integrations

---

# 14. Future Expansion

## Phase 2

* multiple yards
* offline mode
* SMS notifications
* WhatsApp receipts

## Phase 3

* analytics dashboard
* fraud detection
* OCR receipts
* advanced accounting

---

# 15. Core Product Philosophy

YardFlow is not an accounting system.

YardFlow is:

* an operational tracking platform
* a stock movement ledger
* a payment tracking system
* a trusted record infrastructure for scrap dealers

---

# 16. UI / UX Direction

**Primary:** Mobile / POS for cashiers (buy, sell, pay, stock, receipt).

**Secondary:** Web dashboard for owners (review, reports, settings) and Super Admin (tenants, billing, health).

| Principle | Detail |
|-----------|--------|
| Mobile-first | Large touch targets; bottom navigation on POS; minimal taps to receipt |
| Web polish | Light, high-contrast layout; card KPIs; clean tables — suitable for owner review |
| Not accounting UI | Operational numbers (kg, KES balances) not GL charts |
| Source of truth | [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) · [docs/UI_DIRECTION.md](./docs/UI_DIRECTION.md) |

**MVP web (M2):** Tenant dashboard, suppliers, buyers, purchases, sales, inventory, categories.

**Deferred:** Full POS app, Super Admin UI, charts/analytics, dark mode.
