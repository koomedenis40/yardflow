-- CreateEnum
CREATE TYPE "MpesaDirection" AS ENUM ('collection', 'disbursement');

-- CreateEnum
CREATE TYPE "MpesaChannel" AS ENUM ('stk_push', 'b2c');

-- CreateEnum
CREATE TYPE "MpesaIntentStatus" AS ENUM ('pending', 'accepted', 'success', 'failed', 'cancelled', 'timeout', 'reversed');

-- CreateEnum
CREATE TYPE "MpesaEnvironment" AS ENUM ('sandbox', 'production');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'mpesa_stk';
ALTER TYPE "PaymentMethod" ADD VALUE 'mpesa_b2c';

-- CreateTable
CREATE TABLE "tenant_mpesa_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "environment" "MpesaEnvironment" NOT NULL,
    "shortcode" TEXT NOT NULL,
    "passkey" TEXT NOT NULL,
    "consumer_key" TEXT NOT NULL,
    "consumer_secret" TEXT NOT NULL,
    "callback_base_url" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL DEFAULT 'CustomerPayBillOnline',
    "b2c_shortcode" TEXT,
    "initiator_name" TEXT,
    "security_credential" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_mpesa_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mpesa_payment_intents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "direction" "MpesaDirection" NOT NULL,
    "channel" "MpesaChannel" NOT NULL,
    "amount_kes" DECIMAL(14,2) NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "MpesaIntentStatus" NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "checkout_request_id" TEXT,
    "merchant_request_id" TEXT,
    "mpesa_receipt_number" TEXT,
    "result_code" INTEGER,
    "result_desc" TEXT,
    "buyer_id" UUID,
    "supplier_id" UUID,
    "buyer_payment_id" UUID,
    "supplier_payment_id" UUID,
    "account_reference" TEXT,
    "transaction_desc" TEXT,
    "initiated_by" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mpesa_payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mpesa_callback_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "checkout_request_id" TEXT,
    "raw_payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mpesa_callback_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_mpesa_configs_tenant_id_key" ON "tenant_mpesa_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "mpesa_payment_intents_tenant_id_status_idx" ON "mpesa_payment_intents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "mpesa_payment_intents_tenant_id_buyer_id_idx" ON "mpesa_payment_intents"("tenant_id", "buyer_id");

-- CreateIndex
CREATE INDEX "mpesa_payment_intents_tenant_id_supplier_id_idx" ON "mpesa_payment_intents"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "mpesa_payment_intents_checkout_request_id_idx" ON "mpesa_payment_intents"("checkout_request_id");

-- CreateIndex
CREATE INDEX "mpesa_payment_intents_tenant_id_created_at_idx" ON "mpesa_payment_intents"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_payment_intents_tenant_id_idempotency_key_key" ON "mpesa_payment_intents"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "mpesa_callback_logs_checkout_request_id_idx" ON "mpesa_callback_logs"("checkout_request_id");

-- CreateIndex
CREATE INDEX "mpesa_callback_logs_created_at_idx" ON "mpesa_callback_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "tenant_mpesa_configs" ADD CONSTRAINT "tenant_mpesa_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_payment_intents" ADD CONSTRAINT "mpesa_payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_payment_intents" ADD CONSTRAINT "mpesa_payment_intents_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_payment_intents" ADD CONSTRAINT "mpesa_payment_intents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mpesa_callback_logs" ADD CONSTRAINT "mpesa_callback_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
