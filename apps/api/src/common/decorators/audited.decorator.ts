import { SetMetadata } from '@nestjs/common';

export const AUDITED_KEY = 'audited';

export interface AuditedOptions {
  /** Domain entity affected, e.g. "User", "SystemConfig", "Payment". */
  entity: string;
  /** Overrides the action inferred from the HTTP method (CREATE/UPDATE/DELETE). */
  action?: string;
  /** Skip storing the response body (e.g. login responses carrying tokens). */
  omitResponse?: boolean;
}

/**
 * Marks a mutating route for the global audit interceptor.
 * Traceability policy — ISO/IEC 38500: Conformance + Responsibility.
 */
export const Audited = (options: AuditedOptions) => SetMetadata(AUDITED_KEY, options);
