-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- CreateEnum
CREATE TYPE "CorrectableType" AS ENUM ('PURCHASE', 'SALE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'PURCHASE_CORRECTION', 'SALE_CORRECTION', 'STOCK_ADJUSTMENT');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "balance_kes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "balance_kes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "weight_kg" DECIMAL(12,3) NOT NULL,
    "price_per_kg" DECIMAL(14,2) NOT NULL,
    "total_value_kes" DECIMAL(14,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "correction_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "weight_kg" DECIMAL(12,3) NOT NULL,
    "price_per_kg" DECIMAL(14,2) NOT NULL,
    "total_value_kes" DECIMAL(14,2) NOT NULL,
    "cost_per_kg_at_sale" DECIMAL(14,2) NOT NULL,
    "total_cost_kes" DECIMAL(14,2) NOT NULL,
    "gross_profit_kes" DECIMAL(14,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "correction_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "weight_kg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "average_cost_per_kg" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("tenant_id","category_id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "weight_delta_kg" DECIMAL(12,3) NOT NULL,
    "value_delta_kes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference_type" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_type" "CorrectableType" NOT NULL,
    "target_id" UUID NOT NULL,
    "weight_delta_kg" DECIMAL(12,3) NOT NULL,
    "value_delta_kes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "weight_delta_kg" DECIMAL(12,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_id" UUID,
    "reference_type" TEXT,
    "reference_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_phone_idx" ON "suppliers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "buyers_tenant_id_idx" ON "buyers"("tenant_id");

-- CreateIndex
CREATE INDEX "buyers_tenant_id_phone_idx" ON "buyers"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_tenant_id_idempotency_key_key" ON "purchases"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "purchases_tenant_id_created_at_idx" ON "purchases"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "purchases_tenant_id_supplier_id_idx" ON "purchases"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_tenant_id_idempotency_key_key" ON "sales"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sales_tenant_id_created_at_idx" ON "sales"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sales_tenant_id_buyer_id_idx" ON "sales"("tenant_id", "buyer_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_category_id_idx" ON "stock_movements"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_created_at_idx" ON "stock_movements"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "corrections_tenant_id_created_at_idx" ON "corrections"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_adjustments_tenant_id_created_at_idx" ON "stock_adjustments"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ledger_events_tenant_id_created_at_idx" ON "ledger_events"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scrap_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scrap_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scrap_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scrap_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scrap_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
