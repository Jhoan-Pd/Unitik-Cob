import { PaymentMethod, Role } from '@prisma/client';
import { NetworkAccessControlPolicy } from './network-access-control.policy';
import { PaymentReconnectionPolicy } from './payment-reconnection.policy';
import { ServiceContinuityPolicy } from './service-continuity.policy';
import { TraceabilityPolicy } from './traceability.policy';

describe('Governance policies (ISO/IEC 38500)', () => {
  describe('PaymentReconnectionPolicy (Desempeño + Conformidad)', () => {
    const policy = new PaymentReconnectionPolicy();

    it('only ADMIN and CASHIER validate payments manually', () => {
      expect(policy.canValidateManually(Role.ADMIN)).toBe(true);
      expect(policy.canValidateManually(Role.CASHIER)).toBe(true);
      expect(policy.canValidateManually(Role.TECHNICIAN)).toBe(false);
      expect(policy.canValidateManually(Role.CLIENT)).toBe(false);
    });

    it('gateway payments are auto-validated; Nequi/transfer require proof', () => {
      expect(policy.isAutoValidated(PaymentMethod.ONLINE_GATEWAY)).toBe(true);
      expect(policy.isAutoValidated(PaymentMethod.NEQUI)).toBe(false);
      expect(policy.requiresProof(PaymentMethod.NEQUI)).toBe(true);
      expect(policy.requiresProof(PaymentMethod.BANK_TRANSFER)).toBe(true);
      expect(policy.requiresProof(PaymentMethod.CASH)).toBe(false);
    });

    it('reconnection SLA is 5 minutes (experimental indicator)', () => {
      expect(policy.reconnectionSlaMinutes()).toBe(5);
    });
  });

  describe('NetworkAccessControlPolicy (Responsabilidad + Comportamiento humano)', () => {
    const policy = new NetworkAccessControlPolicy();

    it('only ADMIN and TECHNICIAN operate the network', () => {
      expect(policy.canOperateNetwork(Role.ADMIN)).toBe(true);
      expect(policy.canOperateNetwork(Role.TECHNICIAN)).toBe(true);
      expect(policy.canOperateNetwork(Role.CASHIER)).toBe(false);
      expect(policy.canOperateNetwork(Role.CLIENT)).toBe(false);
    });

    it('rate limit is 20 actions/minute and sessions are ephemeral', () => {
      expect(policy.maxNetworkActionsPerMinute()).toBe(20);
      expect(policy.requiresEphemeralSessions()).toBe(true);
      expect(policy.credentialCipher()).toBe('aes-256-gcm');
    });
  });

  describe('TraceabilityPolicy (Conformidad + Responsabilidad)', () => {
    const policy = new TraceabilityPolicy();

    it('covers every critical entity of the domain', () => {
      for (const entity of ['Client', 'Invoice', 'Payment', 'Subscription', 'NetworkAccess', 'User', 'Plan']) {
        expect(policy.isCriticalEntity(entity)).toBe(true);
      }
      expect(policy.isCriticalEntity('Notification')).toBe(false);
    });

    it('maps entities to ISO/IEC 38500 principle references', () => {
      expect(policy.policyRefFor('Payment')).toContain('Desempeño');
      expect(policy.policyRefFor('NetworkAccess')).toContain('Responsabilidad');
      expect(policy.policyRefFor('Unknown')).toBe(TraceabilityPolicy.POLICY_REF);
    });

    it('target traceability is at least 95 % and secrets are never stored', () => {
      expect(policy.traceabilityTargetPercent()).toBeGreaterThanOrEqual(95);
      expect(policy.sensitiveKeys()).toEqual(
        expect.arrayContaining(['passwordHash', 'apiPasswordEnc', 'refreshToken']),
      );
    });
  });

  describe('ServiceContinuityPolicy (Estrategia + Desempeño)', () => {
    const policy = new ServiceContinuityPolicy();

    it('retries 5 times at 1, 5, 15, 30 and 60 minutes', () => {
      expect(policy.retryDelaysMs()).toEqual([60_000, 300_000, 900_000, 1_800_000, 3_600_000]);
      expect(policy.maxAttempts()).toBe(5);
    });

    it('critical jobs keep history for traceability', () => {
      const options = policy.criticalJobOptions();
      expect(options.attempts).toBe(5);
      expect(options.removeOnComplete).toBe(false);
      expect(options.removeOnFail).toBe(false);
    });

    it('daily backup runs at 02:00 America/Bogota', () => {
      expect(policy.backupHourLocal()).toBe(2);
    });
  });
});
