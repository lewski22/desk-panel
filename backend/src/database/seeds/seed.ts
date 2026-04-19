import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  const ownerOrg = await prisma.organization.upsert({
    where:  { slug: 'reserti-owner' },
    update: {},
    create: { name: 'Reserti Owner', slug: 'reserti-owner', plan: 'enterprise', isActive: true },
  });

  const demoOrg = await prisma.organization.upsert({
    where:  { slug: 'demo-corp' },
    update: {},
    create: { name: 'Demo Corp', slug: 'demo-corp', plan: 'pro', isActive: true, limitDesks: 20, limitUsers: 50 },
  });

  const users = [
    { email: 'owner@reserti.pl',      role: 'OWNER'        as const, org: null,    firstName: 'Owner',      lastName: 'Account'   },
    { email: 'superadmin@reserti.pl', role: 'SUPER_ADMIN'  as const, org: demoOrg, firstName: 'Super',      lastName: 'Admin'     },
    { email: 'admin@demo-corp.pl',    role: 'OFFICE_ADMIN' as const, org: demoOrg, firstName: 'Office',     lastName: 'Admin'     },
    { email: 'staff@demo-corp.pl',    role: 'STAFF'        as const, org: demoOrg, firstName: 'Staff',      lastName: 'Member'    },
    { email: 'user@demo-corp.pl',     role: 'END_USER'     as const, org: demoOrg, firstName: 'End',        lastName: 'User'      },
  ];

  for (const u of users) {
    const pw = u.role === 'OWNER' ? 'Owner1234!' : 'Admin1234!';
    const finalPw = u.role === 'STAFF' ? 'Staff1234!' : u.role === 'END_USER' ? 'User1234!' : pw;
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: {
        email: u.email, passwordHash: await bcrypt.hash(finalPw, 12),
        firstName: u.firstName, lastName: u.lastName, role: u.role,
        isActive: true, organizationId: u.org?.id ?? null,
      },
    });
  }

  const location = await prisma.location.upsert({
    where:  { id: 'seed-location-01' },
    update: {},
    create: { id: 'seed-location-01', organizationId: demoOrg.id, name: 'Biuro Główne', city: 'Warszawa', address: 'ul. Przykładowa 1', timezone: 'Europe/Warsaw' },
  }).catch(async () =>
    prisma.location.findFirst({ where: { organizationId: demoOrg.id } })
  );

  if (location) {
    for (let i = 1; i <= 5; i++) {
      await prisma.desk.upsert({
        where:  { locationId_code: { locationId: location.id, code: `A${i}` } },
        update: {},
        create: { locationId: location.id, name: `Biurko A${i}`, code: `A${i}`, floor: '1', zone: 'Open Space', posX: i * 15, posY: 30 },
      });
    }
  }
  console.log('✅ Seed complete');
}

main().then(()=>prisma.$disconnect()).catch(e=>{console.error(e);prisma.$disconnect();process.exit(1)});
