import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeKenyanPhone, toSafaricomPhone } from '../src/mpesa/utils/phone.utils';
import { DarajaAuthService } from '../src/mpesa/services/daraja-auth.service';
import { MpesaPaymentIntentService } from '../src/mpesa/services/mpesa-payment-intent.service';

// ─── Phone utils ───────────────────────────────────────────────────────────

describe('normalizeKenyanPhone', () => {
  it('normalises 07XXXXXXXX to +254XXXXXXXX', () => {
    expect(normalizeKenyanPhone('0712345678')).toBe('+254712345678');
  });

  it('normalises 2547XXXXXXXX to +254XXXXXXXX', () => {
    expect(normalizeKenyanPhone('254712345678')).toBe('+254712345678');
  });

  it('leaves +2547XXXXXXXX unchanged', () => {
    expect(normalizeKenyanPhone('+254712345678')).toBe('+254712345678');
  });

  it('throws on invalid input', () => {
    expect(() => normalizeKenyanPhone('12345')).toThrow();
  });

  it('throws on non-Kenyan number', () => {
    expect(() => normalizeKenyanPhone('+1-800-123-4567')).toThrow();
  });
});

describe('toSafaricomPhone', () => {
  it('strips leading + from E.164 number', () => {
    expect(toSafaricomPhone('+254712345678')).toBe('254712345678');
  });

  it('returns unchanged when no leading +', () => {
    expect(toSafaricomPhone('254712345678')).toBe('254712345678');
  });
});

// ─── DarajaAuthService ─────────────────────────────────────────────────────

describe('DarajaAuthService', () => {
  function makeService(fetchImpl: () => Promise<unknown>) {
    const config = {
      get: (key: string, def?: unknown) => {
        const map: Record<string, unknown> = {
          DARAJA_ENV: 'sandbox',
          DARAJA_BASE_URL: 'https://sandbox.safaricom.co.ke',
          DARAJA_CONSUMER_KEY: 'testkey',
          DARAJA_CONSUMER_SECRET: 'testsecret',
          DARAJA_TOKEN_TTL_BUFFER: 60,
        };
        return map[key] ?? def;
      },
    } as never;
    const svc = new DarajaAuthService(config);
    // Replace internal fetch with mock
    (svc as unknown as { fetchToken: () => Promise<string> }).fetchToken =
      fetchImpl as unknown as () => Promise<string>;
    return svc;
  }

  it('fetches token when cache is empty', async () => {
    let calls = 0;
    const svc = makeService(async () => {
      calls++;
      return 'token-abc';
    });
    const token = await svc.getAccessToken();
    expect(token).toBe('token-abc');
    expect(calls).toBe(1);
  });

  it('returns cached token on second call without re-fetching', async () => {
    let calls = 0;
    const svc = makeService(async () => {
      calls++;
      return 'token-xyz';
    });
    // Prime the cache by calling fetchToken directly
    await svc.getAccessToken();
    // Manually inject a non-expired cache entry
    (svc as unknown as { tokenCache: Map<string, { accessToken: string; expiresAt: number }> })
      .tokenCache.set('mpesa_token:sandbox', {
        accessToken: 'cached-token',
        expiresAt: Date.now() + 3600_000,
      });
    const token = await svc.getAccessToken();
    expect(token).toBe('cached-token');
    // fetchToken called only for the first getAccessToken
    expect(calls).toBe(1);
  });

  it('re-fetches when cache is expired', async () => {
    let calls = 0;
    const svc = makeService(async () => {
      calls++;
      return 'fresh-token';
    });
    // Inject an expired cache entry
    (svc as unknown as { tokenCache: Map<string, { accessToken: string; expiresAt: number }> })
      .tokenCache.set('mpesa_token:sandbox', {
        accessToken: 'stale-token',
        expiresAt: Date.now() - 1000,
      });
    const token = await svc.getAccessToken();
    expect(token).toBe('fresh-token');
    expect(calls).toBe(1);
  });
});

// ─── MpesaPaymentIntentService ─────────────────────────────────────────────

function makeUser(overrides?: Partial<{ tenantId: string; userId: string }>) {
  return {
    tenantId: overrides?.tenantId ?? 'tenant-1',
    userId: overrides?.userId ?? 'user-1',
    permissions: ['buyer_payment:create', 'payment:view'],
  } as never;
}

function makeStkService(stkResponse?: object) {
  return {
    sendStkPush: jest.fn().mockResolvedValue(
      stkResponse ?? {
        CheckoutRequestID: 'ws_CO_123',
        MerchantRequestID: 'mr_456',
        ResponseCode: '0',
        ResponseDescription: 'Success',
        CustomerMessage: 'Success',
      },
    ),
  } as never;
}

function makeConfig(overrides?: Record<string, unknown>) {
  const defaults: Record<string, unknown> = {
    DARAJA_CALLBACK_BASE_URL: 'https://example.com/v1',
    ...overrides,
  };
  return {
    get: (key: string, def?: unknown) => defaults[key] ?? def,
  } as never;
}

describe('MpesaPaymentIntentService', () => {
  const validDto = {
    buyerId: '00000000-0000-0000-0000-000000000001',
    amountKes: 500,
    phone: '0712345678',
    idempotencyKey: 'idem-key-001',
  };

  it('throws NotFoundException when buyer does not belong to tenant', async () => {
    const prisma = {
      buyer: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never;
    const svc = new MpesaPaymentIntentService(
      prisma,
      makeStkService(),
      makeConfig(),
    );
    await expect(
      svc.initiateStkPush(makeUser(), validDto),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when buyer balance is zero', async () => {
    const prisma = {
      buyer: {
        findFirst: jest.fn().mockResolvedValue({ id: validDto.buyerId, name: 'Alice', balanceKes: 0 }),
      },
    } as never;
    const svc = new MpesaPaymentIntentService(
      prisma,
      makeStkService(),
      makeConfig(),
    );
    await expect(
      svc.initiateStkPush(makeUser(), validDto),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws BUYER_OVERPAYMENT_NOT_ALLOWED when ceil(amount) > floor(balance)', async () => {
    const prisma = {
      buyer: {
        findFirst: jest.fn().mockResolvedValue({
          id: validDto.buyerId,
          name: 'Alice',
          balanceKes: 499.5,
        }),
      },
    } as never;
    const svc = new MpesaPaymentIntentService(
      prisma,
      makeStkService(),
      makeConfig(),
    );
    await expect(
      svc.initiateStkPush(makeUser(), { ...validDto, amountKes: 499.5 }),
    ).rejects.toThrow('BUYER_OVERPAYMENT_NOT_ALLOWED');
  });

  it('throws BadRequestException on invalid phone number', async () => {
    const prisma = {
      buyer: {
        findFirst: jest.fn().mockResolvedValue({
          id: validDto.buyerId,
          name: 'Alice',
          balanceKes: 1000,
        }),
      },
    } as never;
    const svc = new MpesaPaymentIntentService(
      prisma,
      makeStkService(),
      makeConfig(),
    );
    await expect(
      svc.initiateStkPush(makeUser(), { ...validDto, phone: 'bad-phone' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates intent, calls STK, and returns accepted status', async () => {
    const createdIntent = {
      id: 'intent-1',
      status: 'pending',
      checkoutRequestId: null,
    };
    const prisma = {
      buyer: {
        findFirst: jest.fn().mockResolvedValue({
          id: validDto.buyerId,
          name: 'Alice',
          balanceKes: 1000,
        }),
      },
      mpesaPaymentIntent: {
        create: jest.fn().mockResolvedValue(createdIntent),
        update: jest.fn().mockResolvedValue({}),
      },
    } as never;
    const svc = new MpesaPaymentIntentService(
      prisma,
      makeStkService(),
      makeConfig(),
    );
    const result = await svc.initiateStkPush(makeUser(), validDto);
    expect(result.status).toBe('accepted');
    expect(result.checkoutRequestId).toBe('ws_CO_123');
    expect(prisma.mpesaPaymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'accepted', checkoutRequestId: 'ws_CO_123' }),
      }),
    );
  });

  it('marks intent failed and throws when STK Push errors', async () => {
    const createdIntent = { id: 'intent-2', status: 'pending' };
    const prisma = {
      buyer: {
        findFirst: jest.fn().mockResolvedValue({
          id: validDto.buyerId,
          name: 'Alice',
          balanceKes: 1000,
        }),
      },
      mpesaPaymentIntent: {
        create: jest.fn().mockResolvedValue(createdIntent),
        update: jest.fn().mockResolvedValue({}),
      },
    } as never;
    const failingStkService = {
      sendStkPush: jest.fn().mockRejectedValue(new Error('Daraja down')),
    } as never;
    const svc = new MpesaPaymentIntentService(prisma, failingStkService, makeConfig());
    await expect(svc.initiateStkPush(makeUser(), validDto)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.mpesaPaymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('returns existing intent on duplicate idempotency key', async () => {
    const existing = {
      id: 'intent-orig',
      status: 'accepted' as const,
      checkoutRequestId: 'ws_CO_existing',
    };
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '0.0.0',
    });
    const prisma = {
      buyer: {
        findFirst: jest.fn().mockResolvedValue({
          id: validDto.buyerId,
          name: 'Alice',
          balanceKes: 1000,
        }),
      },
      mpesaPaymentIntent: {
        create: jest.fn().mockRejectedValue(err),
        findUnique: jest.fn().mockResolvedValue(existing),
      },
    } as never;
    const svc = new MpesaPaymentIntentService(prisma, makeStkService(), makeConfig());
    const result = await svc.initiateStkPush(makeUser(), validDto);
    expect(result.intentId).toBe('intent-orig');
    expect(result.status).toBe('accepted');
  });

  it('getIntentStatus throws NotFoundException when intent not in tenant', async () => {
    const prisma = {
      mpesaPaymentIntent: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never;
    const svc = new MpesaPaymentIntentService(prisma, makeStkService(), makeConfig());
    await expect(svc.getIntentStatus(makeUser(), 'no-such-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('logCallback stores raw payload and resolves tenantId from DB', async () => {
    const rawPayload = {
      Body: { stkCallback: { CheckoutRequestID: 'ws_CO_999', ResultCode: 0, ResultDesc: 'OK' } },
    };
    const prisma = {
      mpesaPaymentIntent: {
        findFirst: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
      mpesaCallbackLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as never;
    const svc = new MpesaPaymentIntentService(prisma, makeStkService(), makeConfig());
    await svc.logCallback(rawPayload);
    expect(prisma.mpesaCallbackLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          checkoutRequestId: 'ws_CO_999',
          rawPayload,
        }),
      }),
    );
  });

  it('logCallback stores null tenantId when checkoutRequestId not found in DB', async () => {
    const rawPayload = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_unknown' } } };
    const prisma = {
      mpesaPaymentIntent: { findFirst: jest.fn().mockResolvedValue(null) },
      mpesaCallbackLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;
    const svc = new MpesaPaymentIntentService(prisma, makeStkService(), makeConfig());
    await svc.logCallback(rawPayload);
    expect(prisma.mpesaCallbackLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: null }),
      }),
    );
  });
});
