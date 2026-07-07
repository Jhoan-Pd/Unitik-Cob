import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { NetworkAccessControlPolicy } from '../../modules/governance/network-access-control.policy';

/**
 * Network action rate limiter (Policy 2 — ISO/IEC 38500 Human behaviour):
 * max N network actions per user per minute, from the governance policy.
 * In-memory sliding window — enough for a single-process deployment.
 */
@Injectable()
export class NetworkRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, number[]>();

  constructor(private readonly policy: NetworkAccessControlPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) return true; // authentication is enforced by JwtAuthGuard

    const limit = this.policy.maxNetworkActionsPerMinute();
    const now = Date.now();
    const recent = (this.windows.get(user.id) ?? []).filter((t) => now - t < 60_000);

    if (recent.length >= limit) {
      throw new HttpException(
        `Límite de ${limit} acciones de red por minuto alcanzado. Espere un momento.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.windows.set(user.id, recent);
    return true;
  }
}
