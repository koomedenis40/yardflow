import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DarajaStkPushRequest,
  DarajaStkPushResponse,
} from '../types/daraja.types';
import { DarajaAuthService } from './daraja-auth.service';
import { toSafaricomPhone } from '../utils/phone.utils';

@Injectable()
export class DarajaStkService {
  constructor(
    private readonly config: ConfigService,
    private readonly auth: DarajaAuthService,
  ) {}

  async sendStkPush(params: {
    amountKes: number;
    normalizedPhone: string;
    accountReference: string;
    transactionDesc: string;
    callbackUrl: string;
  }): Promise<DarajaStkPushResponse> {
    const baseUrl = this.config.get<string>(
      'DARAJA_BASE_URL',
      'https://sandbox.safaricom.co.ke',
    );
    const shortcode = this.config.get<string>('DARAJA_SHORTCODE', '174379');
    const passkey = this.config.get<string>('DARAJA_PASSKEY', '');
    const transactionType = this.config.get<string>(
      'DARAJA_TRANSACTION_TYPE',
      'CustomerPayBillOnline',
    );

    const timestamp = this.getNairobiTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64',
    );
    const safaricomPhone = toSafaricomPhone(params.normalizedPhone);
    const ceiled = Math.ceil(params.amountKes);

    const payload: DarajaStkPushRequest = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: ceiled,
      PartyA: safaricomPhone,
      PartyB: shortcode,
      PhoneNumber: safaricomPhone,
      CallBackURL: params.callbackUrl,
      AccountReference: params.accountReference,
      TransactionDesc: params.transactionDesc,
    };

    const token = await this.auth.getAccessToken();
    const response = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`STK Push failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<DarajaStkPushResponse>;
  }

  private getNairobiTimestamp(): string {
    const now = new Date();
    const nairobi = new Date(
      now.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${nairobi.getFullYear()}` +
      `${pad(nairobi.getMonth() + 1)}` +
      `${pad(nairobi.getDate())}` +
      `${pad(nairobi.getHours())}` +
      `${pad(nairobi.getMinutes())}` +
      `${pad(nairobi.getSeconds())}`
    );
  }
}
