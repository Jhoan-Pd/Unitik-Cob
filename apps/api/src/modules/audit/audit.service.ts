import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityPolicy } from '../governance/traceability.policy';

export interface AuditEntry {
  userId?: string;
  action: string; // CREATE | UPDATE | DELETE | LOGIN | LOGOUT | RECONNECT | SUSPEND ...
  entity: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
  policyRef?: string;
}

/**
 * Append-only audit writer (Traceability policy).
 * There is intentionally NO update/delete method: audit records are immutable.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityPolicy,
  ) {}

  /**
   * Persists an audit record. Never throws: a failing audit write is logged
   * loudly but must not break the business operation (availability), and the
   * gap becomes visible in the TRACEABILITY_PERCENT experimental metric.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldValues: this.sanitize(entry.oldValues),
          newValues: this.sanitize(entry.newValues),
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          policyRef: entry.policyRef ?? this.traceability.policyRefFor(entry.entity),
        },
      });
    } catch (error) {
      this.logger.error(
        `AUDIT WRITE FAILED for ${entry.action} ${entry.entity}${entry.entityId ? `/${entry.entityId}` : ''}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Removes sensitive keys (passwords, tokens) before persisting values. */
  private sanitize(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    const sensitive = this.traceability.sensitiveKeys();

    const clean = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(clean);
      if (input !== null && typeof input === 'object') {
        return Object.fromEntries(
          Object.entries(input as Record<string, unknown>)
            .filter(([key]) => !sensitive.includes(key))
            .map(([key, val]) => [key, clean(val)]),
        );
      }
      return input;
    };

    return clean(JSON.parse(JSON.stringify(value))) as Prisma.InputJsonValue;
  }
}
