import { Injectable } from '@nestjs/common';

/**
 * Policy 3 — Information traceability.
 * ISO/IEC 38500 principles: Conformance + Responsibility.
 *
 * Rules:
 * - A global interceptor audits CREATE/UPDATE/DELETE on every critical entity.
 * - Every AuditLog row carries a policyRef to the applicable principle.
 * - Target: >= 95 % of critical operations fully traceable.
 * - Audit records are append-only (never updated nor deleted).
 */
@Injectable()
export class TraceabilityPolicy {
  static readonly POLICY_REF = 'ISO/IEC 38500 - Conformidad/Responsabilidad';

  /** Entities whose mutations MUST be audited (golden rule #1). */
  private readonly criticalEntities = [
    'Client',
    'Invoice',
    'Payment',
    'Subscription',
    'NetworkAccess',
    'NetworkDevice',
    'User',
    'Plan',
    'SystemConfig',
  ];

  isCriticalEntity(entity: string): boolean {
    return this.criticalEntities.includes(entity);
  }

  listCriticalEntities(): string[] {
    return [...this.criticalEntities];
  }

  /** Minimum acceptable traceability percentage (experimental metric). */
  traceabilityTargetPercent(): number {
    return 95;
  }

  /** Maps an entity to the ISO/IEC 38500 principle reference stored in AuditLog. */
  policyRefFor(entity: string): string {
    const byEntity: Record<string, string> = {
      Payment: 'ISO/IEC 38500 - Desempeño/Conformidad',
      Invoice: 'ISO/IEC 38500 - Desempeño/Conformidad',
      NetworkAccess: 'ISO/IEC 38500 - Responsabilidad',
      NetworkDevice: 'ISO/IEC 38500 - Responsabilidad',
      User: 'ISO/IEC 38500 - Responsabilidad/Comportamiento humano',
      SystemConfig: 'ISO/IEC 38500 - Estrategia/Conformidad',
    };
    return byEntity[entity] ?? TraceabilityPolicy.POLICY_REF;
  }

  /** Keys that must never be persisted in audit values. */
  sensitiveKeys(): string[] {
    return [
      'password',
      'passwordHash',
      'accessToken',
      'refreshToken',
      'apiPasswordEnc',
      'pppoePassEnc',
    ];
  }
}
