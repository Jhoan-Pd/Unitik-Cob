import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NetworkModule } from './modules/network/network.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PlansModule } from './modules/plans/plans.module';
import { PromisesModule } from './modules/promises/promises.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    GovernanceModule, // 4 políticas ISO/IEC 38500 (global)
    AuditModule, // interceptor global de trazabilidad
    QueuesModule, // BullMQ (política de continuidad)
    SystemConfigModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    PlansModule,
    SubscriptionsModule,
    InvoicesModule,
    PromisesModule,
    NetworkModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [
    // Autenticación y RBAC globales: toda ruta exige JWT salvo @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
