import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MpesaIntentStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '@yardflow/types';
import { PrismaService } from '../../prisma/prisma.service';
import { DarajaStkService } from './daraja-stk.service';
import { normalizeKenyanPhone } from '../utils/phone.utils';
import type { StkPushDto } from '../dto/stk-push.dto';
import { stkPushSchema } from '../dto/stk-push.dto';

@Injectable()
export class MpesaPaymentIntentService {
  private readonly logger = new Logger(MpesaPaymentIntentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stkService: DarajaStkService,
    private readonly config: ConfigService,
  ) {}

  async initiateStkPush(
    user: AuthUser,
    body: unknown,
  ): Promise<{ intentId: string; status: MpesaIntentStatus; checkoutRequestId: string | null }> {
    const dto = stkPushSchema.safeParse(body);
    if (!dto.success) {
      throw new BadRequestException(dto.error.flatten());
    }
    const data: StkPushDto = dto.data;

    // Validate buyer belongs to tenant
    const buyer = await this.prisma.buyer.findFirst({
      where: { id: data.buyerId, tenantId: user.tenantId! },
    });
    if (!buyer) throw new NotFoundException('Buyer not found');

    const balanceKes = Number(buyer.balanceKes);
    if (balanceKes <= 0) {
      throw new UnprocessableEntityException('Buyer has no outstanding balance');
    }

    // Ceiling-safe overpayment check
    const ceiled = Math.ceil(data.amountKes);
    if (ceiled > Math.floor(balanceKes)) {
      throw new UnprocessableEntityException('BUYER_OVERPAYMENT_NOT_ALLOWED');
    }

    // Normalize phone
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeKenyanPhone(data.phone);
    } catch {
      throw new BadRequestException('Invalid phone number format');
    }

    const callbackBaseUrl = this.config.get<string>(
      'DARAJA_CALLBACK_BASE_URL',
      '',
    );
    const callbackUrl = `${callbackBaseUrl}/mpesa/stk-callback`;
    const accountReference = data.accountReference ?? buyer.name.slice(0, 12);
    const transactionDesc = data.transactionDesc ?? 'YardFlow payment';

    // Create pending intent (idempotency via unique constraint)
    let intent: Prisma.MpesaPaymentIntentGetPayload<object>;
    try {
      intent = await this.prisma.mpesaPaymentIntent.create({
        data: {
          tenantId: user.tenantId!,
          direction: 'collection',
          channel: 'stk_push',
          amountKes: data.amountKes,
          phoneNumber: normalizedPhone,
          status: 'pending',
          idempotencyKey: data.idempotencyKey,
          buyerId: data.buyerId,
          accountReference,
          transactionDesc,
          initiatedBy: user.userId,
        },
      });
    } catch (err: unknown) {
      // Unique constraint violation = duplicate idempotency key → return existing
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.mpesaPaymentIntent.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: user.tenantId!,
              idempotencyKey: data.idempotencyKey,
            },
          },
        });
        if (!existing) throw err;
        return {
          intentId: existing.id,
          status: existing.status,
          checkoutRequestId: existing.checkoutRequestId,
        };
      }
      throw err;
    }

    // Send STK Push
    try {
      const stkResponse = await this.stkService.sendStkPush({
        amountKes: data.amountKes,
        normalizedPhone,
        accountReference,
        transactionDesc,
        callbackUrl,
      });

      await this.prisma.mpesaPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'accepted',
          checkoutRequestId: stkResponse.CheckoutRequestID,
          merchantRequestId: stkResponse.MerchantRequestID,
          acceptedAt: new Date(),
        },
      });

      return {
        intentId: intent.id,
        status: 'accepted',
        checkoutRequestId: stkResponse.CheckoutRequestID,
      };
    } catch (err: unknown) {
      await this.prisma.mpesaPaymentIntent.update({
        where: { id: intent.id },
        data: { status: 'failed', resultDesc: String(err) },
      });
      throw new UnprocessableEntityException('STK Push initiation failed');
    }
  }

  async getIntentStatus(
    user: AuthUser,
    intentId: string,
  ): Promise<{
    intentId: string;
    status: MpesaIntentStatus;
    amountKes: string;
    phoneNumber: string;
    checkoutRequestId: string | null;
    mpesaReceiptNumber: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const intent = await this.prisma.mpesaPaymentIntent.findFirst({
      where: { id: intentId, tenantId: user.tenantId },
    });
    if (!intent) throw new NotFoundException('Intent not found');

    return {
      intentId: intent.id,
      status: intent.status,
      amountKes: intent.amountKes.toString(),
      phoneNumber: intent.phoneNumber,
      checkoutRequestId: intent.checkoutRequestId,
      mpesaReceiptNumber: intent.mpesaReceiptNumber,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
    };
  }

  async logCallback(rawPayload: unknown): Promise<void> {
    // Extract checkoutRequestId without trusting it
    let checkoutRequestId: string | null = null;
    try {
      const body = rawPayload as {
        Body?: { stkCallback?: { CheckoutRequestID?: string } };
      };
      checkoutRequestId = body?.Body?.stkCallback?.CheckoutRequestID ?? null;
    } catch {
      // ignore parse errors — store raw regardless
    }

    // Resolve tenantId from DB (never from client payload)
    let tenantId: string | null = null;
    if (checkoutRequestId) {
      const intent = await this.prisma.mpesaPaymentIntent.findFirst({
        where: { checkoutRequestId },
        select: { tenantId: true },
      });
      tenantId = intent?.tenantId ?? null;
    }

    await this.prisma.mpesaCallbackLog.create({
      data: {
        tenantId,
        checkoutRequestId,
        rawPayload: rawPayload as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `stk_callback_logged checkout=${checkoutRequestId ?? 'unknown'}`,
    );
  }
}
