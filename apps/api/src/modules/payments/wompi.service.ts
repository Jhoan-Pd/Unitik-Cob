import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Relevant subset of the Wompi event payload. */
export interface WompiEvent {
  event: string; // "transaction.updated"
  data: {
    transaction: {
      id: string;
      status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
      amount_in_cents: number;
      reference: string; // we send the invoiceNumber as reference
      payment_method_type: string;
    };
  };
  timestamp: number;
  signature: {
    checksum: string;
    properties: string[];
  };
}

/**
 * Wompi Colombia webhook verification (Policy 1: gateway payments are the
 * ONLY auto-validated path). Checksum per Wompi docs:
 * SHA256(concat(property values in order) + timestamp + events_secret).
 */
@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);

  constructor(private readonly configService: ConfigService) {}

  verifySignature(event: WompiEvent): boolean {
    const secret = this.configService.get<string>('WOMPI_EVENTS_SECRET', '');
    if (!secret) {
      this.logger.warn('WOMPI_EVENTS_SECRET no configurado: se rechazan todos los webhooks');
      return false;
    }

    const concatenated = event.signature.properties
      .map((property) => this.resolveProperty(event, property))
      .join('');
    const expected = createHash('sha256')
      .update(`${concatenated}${event.timestamp}${secret}`)
      .digest('hex');
    return expected === event.signature.checksum;
  }

  /** Resolves dot-paths like "transaction.id" against event.data. */
  private resolveProperty(event: WompiEvent, path: string): string {
    let value: unknown = event.data;
    for (const key of path.split('.')) {
      if (value !== null && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return '';
      }
    }
    return String(value ?? '');
  }
}
