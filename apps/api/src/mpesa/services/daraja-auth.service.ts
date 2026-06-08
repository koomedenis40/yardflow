import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DarajaTokenResponse } from '../types/daraja.types';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class DarajaAuthService {
  private readonly logger = new Logger(DarajaAuthService.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  constructor(private readonly config: ConfigService) {}

  async getAccessToken(): Promise<string> {
    const env = this.config.get<string>('DARAJA_ENV', 'sandbox');
    const cacheKey = `mpesa_token:${env}`;
    const now = Date.now();

    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      this.logger.log('token_from_cache');
      return cached.accessToken;
    }

    const token = await this.fetchToken();
    this.logger.log('token_fetched');
    return token;
  }

  private async fetchToken(): Promise<string> {
    const baseUrl = this.config.get<string>(
      'DARAJA_BASE_URL',
      'https://sandbox.safaricom.co.ke',
    );
    const consumerKey = this.config.get<string>('DARAJA_CONSUMER_KEY', '');
    const consumerSecret = this.config.get<string>(
      'DARAJA_CONSUMER_SECRET',
      '',
    );
    const ttlBuffer = this.config.get<number>('DARAJA_TOKEN_TTL_BUFFER', 60);
    const env = this.config.get<string>('DARAJA_ENV', 'sandbox');

    const credentials = Buffer.from(
      `${consumerKey}:${consumerSecret}`,
    ).toString('base64');

    const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      throw new Error(`Daraja OAuth failed: ${response.status}`);
    }

    const data = (await response.json()) as DarajaTokenResponse;
    const expiresIn = parseInt(data.expires_in, 10);
    const expiresAt = Date.now() + (expiresIn - ttlBuffer) * 1000;

    const cacheKey = `mpesa_token:${env}`;
    this.tokenCache.set(cacheKey, {
      accessToken: data.access_token,
      expiresAt,
    });

    return data.access_token;
  }
}
