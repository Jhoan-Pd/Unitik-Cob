import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Policy 2 — Network access control.
 * ISO/IEC 38500 principles: Responsibility + Human behaviour.
 *
 * Rules:
 * - Only ADMIN and TECHNICIAN may operate NetworkDevice / NetworkAccess.
 * - MikroTik credentials are stored AES-256-GCM encrypted, never plaintext.
 * - RouterOS API sessions close after each operation (no persistent sessions).
 * - Rate limit: max 20 network actions per user per minute.
 * - Every network action is audited with ipAddress and userAgent.
 */
@Injectable()
export class NetworkAccessControlPolicy {
  static readonly POLICY_REF = 'ISO/IEC 38500 - Responsabilidad/Comportamiento humano';

  private readonly networkOperatorRoles: Role[] = [Role.ADMIN, Role.TECHNICIAN];

  canOperateNetwork(role: Role): boolean {
    return this.networkOperatorRoles.includes(role);
  }

  /** Maximum network actions allowed per user per minute. */
  maxNetworkActionsPerMinute(): number {
    return 20;
  }

  /** Cipher required for device credentials at rest. */
  credentialCipher(): string {
    return 'aes-256-gcm';
  }

  /** Sessions against RouterOS must be closed after every operation. */
  requiresEphemeralSessions(): boolean {
    return true;
  }
}
