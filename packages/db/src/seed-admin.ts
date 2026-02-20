import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (isProduction && !configuredPassword) {
    throw new Error('ADMIN_PASSWORD is required in production');
  }
  const password = configuredPassword || 'admin123456';
  if (!configuredPassword) {
    // eslint-disable-next-line no-console
    console.warn('[seed-admin] ADMIN_PASSWORD missing, using development fallback password');
  }
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded admin user: ${username}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
