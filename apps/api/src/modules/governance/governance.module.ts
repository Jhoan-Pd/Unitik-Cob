import { Global, Module } from '@nestjs/common';
import { NetworkAccessControlPolicy } from './network-access-control.policy';
import { PaymentReconnectionPolicy } from './payment-reconnection.policy';
import { ServiceContinuityPolicy } from './service-continuity.policy';
import { TraceabilityPolicy } from './traceability.policy';

/**
 * IT Governance module — ISO/IEC 38500.
 * Exposes the 4 formal policies as injectable providers so every domain
 * module consumes governance rules instead of re-implementing them.
 * Global: policies are cross-cutting by definition.
 */
@Global()
@Module({
  providers: [
    PaymentReconnectionPolicy,
    NetworkAccessControlPolicy,
    TraceabilityPolicy,
    ServiceContinuityPolicy,
  ],
  exports: [
    PaymentReconnectionPolicy,
    NetworkAccessControlPolicy,
    TraceabilityPolicy,
    ServiceContinuityPolicy,
  ],
})
export class GovernanceModule {}
