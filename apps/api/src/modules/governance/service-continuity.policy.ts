import { Injectable } from '@nestjs/common';

/**
 * Policy 4 — Service continuity.
 * ISO/IEC 38500 principles: Strategy + Performance.
 *
 * Rules:
 * - Critical operations (reconnect, suspend, notify) go through BullMQ queues.
 * - Exponential retries: 5 attempts at 1, 5, 15, 30 and 60 minutes.
 * - If the RouterBoard is down, actions stay queued until connectivity returns.
 * - Redis persists queues (AOF) so pending work survives restarts.
 * - Daily PostgreSQL backup at 02:00 America/Bogota.
 */
@Injectable()
export class ServiceContinuityPolicy {
  static readonly POLICY_REF = 'ISO/IEC 38500 - Estrategia/Desempeño';

  /** Retry delays in milliseconds: 1, 5, 15, 30, 60 minutes. */
  retryDelaysMs(): number[] {
    return [1, 5, 15, 30, 60].map((minutes) => minutes * 60_000);
  }

  maxAttempts(): number {
    return this.retryDelaysMs().length;
  }

  /**
   * BullMQ job options implementing this policy. The 'custom' backoff type
   * is resolved by the worker's backoffStrategy (see ReconnectionProcessor),
   * which reads retryDelaysMs() — single source of truth.
   */
  criticalJobOptions(): {
    attempts: number;
    backoff: { type: 'custom' };
    removeOnComplete: boolean;
    removeOnFail: boolean;
  } {
    return {
      attempts: this.maxAttempts(),
      backoff: { type: 'custom' },
      removeOnComplete: false, // keep history for traceability
      removeOnFail: false,
    };
  }

  /** Worker-side backoff strategy: attempt N waits retryDelaysMs()[N-1]. */
  backoffDelayForAttempt(attemptsMade: number): number {
    const delays = this.retryDelaysMs();
    const index = Math.min(Math.max(attemptsMade, 1), delays.length) - 1;
    return delays[index];
  }

  /** Hour (America/Bogota) of the automated daily database backup. */
  backupHourLocal(): number {
    return 2;
  }
}
