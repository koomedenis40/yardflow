# Cursor Prompt — Create YardFlow Rules Documentation

You are a senior full-stack software architect.

The project is YardFlow, a multi-tenant scrap yard operations system.

Before writing application code, read the existing PRD and ARCHITECTURE_REVIEW.md. Then create the following source-of-truth documentation files in the docs/ folder:

1. docs/SYSTEM_RULES.md
2. docs/TRANSACTION_FLOWS.md
3. docs/DATABASE_CONTRACTS.md
4. docs/PERMISSION_MATRIX.md
5. docs/EVENT_ARCHITECTURE.md

Use the content and intent below as the baseline.

Important instructions:

- Do not generate implementation code yet.
- Do not create app scaffolding yet.
- Do not simplify the ledger model.
- Preserve tenant isolation from day one.
- Preserve append-only operational records.
- Treat stock integrity as the highest-priority rule.
- Treat M-Pesa as asynchronous and idempotent.
- Treat receipts as views of saved ledger records.
- Treat billing as monthly intake-based billing.
- Use Africa/Nairobi as display timezone.
- Use kilograms as the only operational stock unit.
- Use weighted average COGS for profit reporting.
- Use supplier credit pool + FIFO allocation for advance payments.
- Use queue-only POS offline behavior for MVP.

After creating the files, produce a short report showing:

1. Files created
2. Key rules captured
3. Any contradictions found between PRD and Architecture Review
4. Recommended next step toward M1 Foundation
