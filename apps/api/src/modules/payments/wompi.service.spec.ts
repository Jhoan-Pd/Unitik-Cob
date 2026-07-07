import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { WompiEvent, WompiService } from './wompi.service';

describe('WompiService (verificación de firma)', () => {
  let service: WompiService;
  const SECRET = 'test_events_secret';

  const buildEvent = (checksum?: string): WompiEvent => {
    const transaction = {
      id: 'txn-123',
      status: 'APPROVED' as const,
      amount_in_cents: 6000000,
      reference: 'FCT-2026-07-CLI-111',
      payment_method_type: 'NEQUI',
    };
    const timestamp = 1751800000;
    const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
    const valid = createHash('sha256')
      .update(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${SECRET}`)
      .digest('hex');
    return {
      event: 'transaction.updated',
      data: { transaction },
      timestamp,
      signature: { checksum: checksum ?? valid, properties },
    };
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WompiService,
        {
          provide: ConfigService,
          useValue: { get: (key: string, fallback: string) => (key === 'WOMPI_EVENTS_SECRET' ? SECRET : fallback) },
        },
      ],
    }).compile();
    service = moduleRef.get(WompiService);
  });

  it('accepts a correctly signed event', () => {
    expect(service.verifySignature(buildEvent())).toBe(true);
  });

  it('rejects a tampered checksum (comprobante falso digital)', () => {
    expect(service.verifySignature(buildEvent('deadbeef'.repeat(8)))).toBe(false);
  });

  it('rejects when the amount was altered after signing', () => {
    const event = buildEvent();
    event.data.transaction.amount_in_cents = 100;
    expect(service.verifySignature(event)).toBe(false);
  });
});
