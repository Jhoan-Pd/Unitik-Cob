import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditLog, Prisma, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditFilters {
  entity?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
}

/**
 * Audit trail viewer (Policy 3 — dashboard admin con exportación).
 * Read-only by design: audit records are append-only.
 */
@ApiTags('audit')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar auditoría con filtros (fecha, usuario, entidad, acción)' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'take', required: false })
  async find(
    @Query() filters: AuditFilters,
    @Query('take') take?: string,
  ): Promise<Array<AuditLog & { user: { email: string } | null }>> {
    return this.prisma.auditLog.findMany({
      where: this.buildWhere(filters),
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take ?? 100), 500),
    }) as Promise<Array<AuditLog & { user: { email: string } | null }>>;
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auditoria-unitik.csv"')
  @ApiOperation({ summary: 'Exportar auditoría filtrada a CSV (compatible con Excel)' })
  async exportCsv(@Query() filters: AuditFilters): Promise<string> {
    const rows = await this.prisma.auditLog.findMany({
      where: this.buildWhere(filters),
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const header = 'fecha;usuario;accion;entidad;entidadId;ip;politicaISO38500;valoresAnteriores;valoresNuevos';
    const lines = rows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.user?.email ?? 'sistema',
        row.action,
        row.entity,
        row.entityId ?? '',
        row.ipAddress ?? '',
        row.policyRef ?? '',
        JSON.stringify(row.oldValues ?? null),
        JSON.stringify(row.newValues ?? null),
      ]
        .map(escape)
        .join(';'),
    );
    return [header, ...lines].join('\r\n');
  }

  private buildWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
    return {
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };
  }
}
