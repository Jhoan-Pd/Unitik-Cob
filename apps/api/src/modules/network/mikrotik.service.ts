import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Connection {
  pppoeUser: string;
  address: string;
  uptime: string;
}

/**
 * MikroTik RouterOS integration (RouterBoard).
 *
 * Iteration 2 (architectural prototype): runs in MOCK mode — operations are
 * simulated so the end-to-end flow payment → validation → queue → reconnection
 * can be exercised without touching real infrastructure.
 * Iteration 5 replaces the mock branch with node-routeros calls, keeping this
 * exact interface (methods mandated by the master specification).
 *
 * Governance (Network access control policy):
 * - Sessions are ephemeral: one connection per operation, closed afterwards.
 * - Credentials arrive AES-256-GCM encrypted and are decrypted only in memory.
 */
@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  constructor(private readonly configService: ConfigService) {}

  /** True while no real RouterBoard is wired (Iterations 2-4). */
  isMockMode(): boolean {
    return this.configService.get<string>('MIKROTIK_MOCK', 'true') !== 'false';
  }

  /** Enables the PPPoE user on the RouterBoard (reconnection). */
  async enableClient(deviceId: string, pppoeUser: string): Promise<void> {
    await this.execute(deviceId, `enable PPPoE secret "${pppoeUser}" + remove active kill`);
  }

  /** Disables the PPPoE user (suspension for non-payment). */
  async disableClient(deviceId: string, pppoeUser: string): Promise<void> {
    await this.execute(deviceId, `disable PPPoE secret "${pppoeUser}"`);
  }

  /** Creates a PPPoE user (installation). */
  async createPppoeUser(
    deviceId: string,
    user: string,
    _pass: string,
    profile: string,
  ): Promise<void> {
    await this.execute(deviceId, `create PPPoE secret "${user}" profile "${profile}"`);
  }

  /** Removes a PPPoE user (cancellation). */
  async removePppoeUser(deviceId: string, user: string): Promise<void> {
    await this.execute(deviceId, `remove PPPoE secret "${user}"`);
  }

  /** Changes the user's profile (plan change → bandwidth change). */
  async changeUserProfile(deviceId: string, user: string, newProfile: string): Promise<void> {
    await this.execute(deviceId, `set PPPoE secret "${user}" profile "${newProfile}"`);
  }

  /** Lists active PPPoE connections (monitoring). */
  async getActiveConnections(deviceId: string): Promise<Connection[]> {
    await this.execute(deviceId, 'read active PPPoE connections');
    return []; // mock: empty; real data in Iteration 5
  }

  /** Connectivity test against the device. */
  async ping(deviceId: string): Promise<boolean> {
    await this.execute(deviceId, 'ping');
    return true;
  }

  private async execute(deviceId: string, operation: string): Promise<void> {
    if (this.isMockMode()) {
      // Simulated RouterOS round-trip (~50 ms) with an ephemeral session
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.logger.log(`[MOCK RouterOS] device=${deviceId} :: ${operation} :: session closed`);
      return;
    }
    // Iteration 5: real node-routeros implementation
    throw new Error('Real RouterOS driver not implemented yet (Iteration 5)');
  }
}
