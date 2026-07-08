import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PaymentReconnectionPolicy } from '../governance/payment-reconnection.policy';
import { PaymentValidatedEvent } from '../payments/events/payment-validated.event';
import { JwtPayload } from '../auth/auth.types';

/**
 * Real-time in-app notifications for the staff panel (Socket.io).
 * Clients join a room named after their role; domain events are broadcast
 * to staff rooms so the admin panel updates simultáneamente (requisito del
 * panel administrador). Handshake auth: JWT access token.
 */
@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('missing token');

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'change-me-access-secret'),
      });
      await client.join(payload.role); // room per role: ADMIN, CASHIER...
      this.logger.log(`WS conectado: ${payload.email} (${payload.role})`);
    } catch {
      client.disconnect(true); // unauthenticated sockets are dropped
    }
  }

  /** Broadcast to every staff role room. */
  emitToStaff(event: string, payload: unknown): void {
    this.server.to('ADMIN').to('CASHIER').to('TECHNICIAN').emit(event, payload);
  }

  @OnEvent(PaymentReconnectionPolicy.PAYMENT_VALIDATED_EVENT)
  onPaymentValidated(event: PaymentValidatedEvent): void {
    this.emitToStaff('payment.validated', {
      paymentId: event.paymentId,
      clientId: event.clientId,
      at: event.validatedAt,
      message: 'Pago validado: reconexión encolada',
    });
  }
}
