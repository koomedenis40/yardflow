import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

export class StockInsufficientException extends ConflictException {
  constructor() {
    super({
      code: 'STOCK_INSUFFICIENT',
      message: 'Insufficient stock for this operation',
    });
  }
}

export class CorrectionWouldBreakStockException extends UnprocessableEntityException {
  constructor() {
    super({
      code: 'CORRECTION_WOULD_BREAK_STOCK',
      message: 'Correction would result in negative stock',
    });
  }
}
