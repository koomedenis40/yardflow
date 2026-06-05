-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank', 'mobile_money_manual', 'other_manual');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('pending', 'confirmed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "PaymentSourceType" AS ENUM ('supplier_payment', 'buyer_payment', 'supplier_credit_pool');

-- CreateEnum
CREATE TYPE "PaymentAllocationTargetType" AS ENUM ('purchase', 'sale');

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "credit_balance_kes" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "amount_kes" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "amount_kes" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" "PaymentSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "target_type" "PaymentAllocationTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "allocated_amount_kes" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_tenant_id_idempotency_key_key" ON "supplier_payments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_payments_tenant_id_supplier_id_idx" ON "supplier_payments"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_payments_tenant_id_created_at_idx" ON "supplier_payments"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_payments_tenant_id_idempotency_key_key" ON "buyer_payments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "buyer_payments_tenant_id_buyer_id_idx" ON "buyer_payments"("tenant_id", "buyer_id");

-- CreateIndex
CREATE INDEX "buyer_payments_tenant_id_created_at_idx" ON "buyer_payments"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_target_type_target_id_idx" ON "payment_allocations"("tenant_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_source_type_source_id_idx" ON "payment_allocations"("tenant_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_created_at_idx" ON "payment_allocations"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
