import { PrismaClient, Role, ServiceType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Initial plans taken verbatim from the project document (Annex B / manager interview).
const PLANS: Array<{
  name: string;
  description: string;
  serviceType: ServiceType;
  speedMbps: number;
  monthlyPrice: number;
}> = [
  { name: 'Plan 1 Fibra', description: 'Fibra Óptica 20 Megas', serviceType: 'FIBER', speedMbps: 20, monthlyPrice: 50000 },
  { name: 'Plan 2 Fibra', description: 'Fibra Óptica 30 Megas', serviceType: 'FIBER', speedMbps: 30, monthlyPrice: 60000 },
  { name: 'Plan 3 Fibra', description: 'Fibra Óptica 40 Megas', serviceType: 'FIBER', speedMbps: 40, monthlyPrice: 70000 },
  { name: 'Plan 4 Fibra', description: 'Fibra Óptica 100 Megas', serviceType: 'FIBER', speedMbps: 100, monthlyPrice: 100000 },
  { name: 'Plan 1 Radio', description: 'Radio Enlace 12 Megas', serviceType: 'RADIO', speedMbps: 12, monthlyPrice: 50000 },
  { name: 'Plan 2 Radio', description: 'Radio Enlace 15 Megas', serviceType: 'RADIO', speedMbps: 15, monthlyPrice: 60000 },
];

// Mandatory system configuration (golden rule #3: nothing hardcoded in business logic).
const SYSTEM_CONFIG: Array<{ key: string; value: string; description: string }> = [
  { key: 'interest_rate_percent', value: '2.5', description: 'Porcentaje de interés por mora' },
  { key: 'grace_period_days', value: '7', description: 'Días de gracia tras vencimiento' },
  { key: 'max_promise_days', value: '15', description: 'Máximo de días para promesa de pago' },
  { key: 'cut_off_day_start', value: '1', description: 'Inicio del rango de fechas de corte' },
  { key: 'cut_off_day_end', value: '10', description: 'Fin del rango de fechas de corte' },
  { key: 'double_payment_after_days', value: '30', description: 'Días de mora para aplicar doble mensualidad' },
  { key: 'installation_fee_default', value: '50000', description: 'Costo de instalación por defecto (COP)' },
  { key: 'tv_service_price', value: '10000', description: 'Precio mensual del servicio de TV adicional (COP)' },
];

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    const existing = await prisma.plan.findFirst({
      where: { name: plan.name, serviceType: plan.serviceType },
    });
    if (!existing) {
      await prisma.plan.create({
        data: { ...plan, installationFee: 50000, tvPrice: 10000 },
      });
    }
  }
  console.log(`✔ Planes sembrados: ${PLANS.length} (4 Fibra + 2 Radio)`);
}

async function seedSystemConfig(): Promise<void> {
  for (const config of SYSTEM_CONFIG) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }
  console.log(`✔ Configuración del sistema sembrada: ${SYSTEM_CONFIG.length} parámetros`);
}

async function seedAdminUser(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@unitik.com.co';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      documentId: '0000000000',
      firstName: 'Administrador',
      lastName: 'UNITIK',
      email,
      phone: '3000000000',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`✔ Usuario ADMIN de prueba: ${email}`);
}

async function main(): Promise<void> {
  await seedPlans();
  await seedSystemConfig();
  await seedAdminUser();
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
