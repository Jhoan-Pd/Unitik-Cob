import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterOSAPI } from 'node-routeros';
import { decryptSecret } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface Connection {
  pppoeUser: string;
  address: string;
  uptime: string;
}

/**
 * MikroTik RouterOS integration (RouterBoard) — the 7 methods mandated by
 * the master specification, now backed by node-routeros.
 *
 * MOCK mode (default until the Cumbitara RouterBoard is reachable, Phase 4):
 * operations are simulated so every flow stays testable end-to-end.
 *
 * Governance (Network access control policy — ISO/IEC 38500 Responsibility):
 * - Ephemeral sessions: one connection per operation, closed in `finally`.
 * - Credentials stored AES-256-GCM; decrypted only in memory per call.
 */
@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** True while no real RouterBoard is wired (Iterations 2-7). */
  isMockMode(): boolean {
    return this.configService.get<string>('MIKROTIK_MOCK', 'true') !== 'false';
  }

  /** Enables the PPPoE user on the RouterBoard (reconnection). */
  async enableClient(deviceId: string, pppoeUser: string): Promise<void> {
    await this.execute(deviceId, `enable PPPoE "${pppoeUser}"`, async (api) => {
      const secret = await this.findSecretId(api, pppoeUser);
      await api.write('/ppp/secret/set', [`=.id=${secret}`, '=disabled=no']);
      // Drop any stale active session so the CPE re-authenticates immediately
      const active = await api.write('/ppp/active/print', [`?name=${pppoeUser}`]);
      for (const session of active) {
        await api.write('/ppp/active/remove', [`=.id=${session['.id']}`]);
      }
    });
  }

  /** Disables the PPPoE user (suspension for non-payment). */
  async disableClient(deviceId: string, pppoeUser: string): Promise<void> {
    await this.execute(deviceId, `disable PPPoE "${pppoeUser}"`, async (api) => {
      const secret = await this.findSecretId(api, pppoeUser);
      await api.write('/ppp/secret/set', [`=.id=${secret}`, '=disabled=yes']);
      const active = await api.write('/ppp/active/print', [`?name=${pppoeUser}`]);
      for (const session of active) {
        await api.write('/ppp/active/remove', [`=.id=${session['.id']}`]);
      }
    });
  }

  /** Creates a PPPoE user (installation). */
  async createPppoeUser(
    deviceId: string,
    user: string,
    pass: string,
    profile: string,
  ): Promise<void> {
    await this.execute(deviceId, `create PPPoE "${user}" profile "${profile}"`, async (api) => {
      await api.write('/ppp/secret/add', [
        `=name=${user}`,
        `=password=${pass}`,
        `=profile=${profile}`,
        '=service=pppoe',
      ]);
    });
  }

  /** Removes a PPPoE user (cancellation). */
  async removePppoeUser(deviceId: string, user: string): Promise<void> {
    await this.execute(deviceId, `remove PPPoE "${user}"`, async (api) => {
      const secret = await this.findSecretId(api, user);
      await api.write('/ppp/secret/remove', [`=.id=${secret}`]);
    });
  }

  /** Changes the user's profile (plan change → bandwidth change). */
  async changeUserProfile(deviceId: string, user: string, newProfile: string): Promise<void> {
    await this.execute(deviceId, `set PPPoE "${user}" profile "${newProfile}"`, async (api) => {
      const secret = await this.findSecretId(api, user);
      await api.write('/ppp/secret/set', [`=.id=${secret}`, `=profile=${newProfile}`]);
    });
  }

  /** Lists active PPPoE connections (monitoring). */
  async getActiveConnections(deviceId: string): Promise<Connection[]> {
    if (this.isMockMode()) {
      await this.simulate(deviceId, 'read active PPPoE connections');
      return [];
    }
    return this.withSession(deviceId, async (api) => {
      const rows = await api.write('/ppp/active/print');
      return rows.map((row) => ({
        pppoeUser: String(row.name ?? ''),
        address: String(row.address ?? ''),
        uptime: String(row.uptime ?? ''),
      }));
    });
  }

  /** Connectivity test; also refreshes NetworkDevice.lastPing on success. */
  async ping(deviceId: string): Promise<boolean> {
    try {
      await this.execute(deviceId, 'ping', async (api) => {
        await api.write('/system/identity/print');
      });
      await this.prisma.networkDevice.update({
        where: { id: deviceId },
        data: { lastPing: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  // --- internals -----------------------------------------------------------

  private async execute(
    deviceId: string,
    description: string,
    operation: (api: RouterOSAPI) => Promise<void>,
  ): Promise<void> {
    if (this.isMockMode()) {
      await this.simulate(deviceId, description);
      return;
    }
    await this.withSession(deviceId, operation);
  }

  /** Ephemeral RouterOS session (policy: no persistent connections). */
  private async withSession<T>(
    deviceId: string,
    operation: (api: RouterOSAPI) => Promise<T>,
  ): Promise<T> {
    const device = await this.prisma.networkDevice.findUnique({ where: { id: deviceId } });
    if (!device || !device.isActive) {
      throw new NotFoundException('Dispositivo de red no encontrado o inactivo');
    }

    const api = new RouterOSAPI({
      host: device.ipAddress,
      port: device.apiPort,
      user: device.apiUsername,
      password: decryptSecret(device.apiPasswordEnc),
      timeout: 10,
    });

    await api.connect();
    try {
      return await operation(api);
    } finally {
      await api.close().catch(() => undefined); // session always closed
    }
  }

  private async findSecretId(api: RouterOSAPI, name: string): Promise<string> {
    const secrets = await api.write('/ppp/secret/print', [`?name=${name}`]);
    const id = secrets[0]?.['.id'];
    if (!id) throw new NotFoundException(`Usuario PPPoE "${name}" no existe en la RouterBoard`);
    return String(id);
  }

  private async simulate(deviceId: string, operation: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.logger.log(`[MOCK RouterOS] device=${deviceId} :: ${operation} :: session closed`);
  }
}
