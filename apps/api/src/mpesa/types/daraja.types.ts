export interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface DarajaStkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface DarajaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface DarajaCallbackItem {
  Name: string;
  Value?: string | number;
}

export interface DarajaCallbackMetadata {
  Item: DarajaCallbackItem[];
}

export interface DarajaCallbackStkCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: DarajaCallbackMetadata;
}

export interface DarajaCallbackBody {
  stkCallback: DarajaCallbackStkCallback;
}

export interface DarajaStkCallback {
  Body: DarajaCallbackBody;
}
