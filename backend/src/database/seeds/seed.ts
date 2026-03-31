import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Organization ──────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: { name: 'Demo Corp', slug: 'demo-corp' },
  });
  console.log(`✔ Organization: ${org.name}`);

  // ── Location ──────────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: 'seed-location-01' },
    update: {},
    create: {
      id: 'seed-location-01',
      organizationId: org.id,
      name: 'Warsaw HQ',
      address: 'ul. Marszałkowska 1',
      city: 'Warsaw',
      timezone: 'Europe/Warsaw',
    },
  });
  console.log(`✔ Location: ${location.name}`);

  // ── Users ─────────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hash(p, 10);

  // Konto OWNER — operator platformy (bez organizacji)
  await prisma.user.upsert({
    where: { email: 'owner@reserti.pl' },
    update: {},
    create: {
      email:        'owner@reserti.pl',
      passwordHash: await hash('Owner1234!'),
      firstName:    'Platform',
      lastName:     'Owner',
      role:         UserRole.OWNER,
      isActive:     true,
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@reserti.pl' },
    update: {},
    create: {
      email: 'superadmin@reserti.pl',
      passwordHash: await hash('Admin1234!'),
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
    },
  });

  const officeAdmin = await prisma.user.upsert({
    where: { email: 'admin@demo-corp.pl' },
    update: {},
    create: {
      email: 'admin@demo-corp.pl',
      passwordHash: await hash('Admin1234!'),
      firstName: 'Jan',
      lastName: 'Kowalski',
      role: UserRole.OFFICE_ADMIN,
      organizationId: org.id,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@demo-corp.pl' },
    update: {},
    create: {
      email: 'staff@demo-corp.pl',
      passwordHash: await hash('Staff1234!'),
      firstName: 'Anna',
      lastName: 'Nowak',
      role: UserRole.STAFF,
      organizationId: org.id,
    },
  });

  const endUser = await prisma.user.upsert({
    where: { email: 'user@demo-corp.pl' },
    update: {},
    create: {
      email: 'user@demo-corp.pl',
      passwordHash: await hash('User1234!'),
      firstName: 'Piotr',
      lastName: 'Wiśniewski',
      role: UserRole.END_USER,
      organizationId: org.id,
      cardUid: 'AA:BB:CC:DD',
    },
  });
  console.log(`✔ Users: superadmin, admin, staff, end_user`);

  // ── Desks ─────────────────────────────────────────────────
  const desks = await Promise.all(
    ['A-01', 'A-02', 'A-03', 'B-01', 'B-02'].map((code, i) =>
      prisma.desk.upsert({
        where: { locationId_code: { locationId: location.id, code } },
        update: {},
        create: {
          locationId: location.id,
          name: `Desk ${code}`,
          code,
          floor: code.startsWith('A') ? '1' : '2',
          zone: code.startsWith('A') ? 'Open Space' : 'Quiet Zone',
        },
      }),
    ),
  );
  console.log(`✔ Desks: ${desks.map(d => d.code).join(', ')}`);

  // ── Gateway ───────────────────────────────────────────────
  const gateway = await prisma.gateway.upsert({
    where: { id: 'seed-gateway-01' },
    update: {},
    create: {
      id: 'seed-gateway-01',
      locationId: location.id,
      name: 'Warsaw GW-1',
      secretHash: await bcrypt.hash('gw-secret-dev', 10),
    },
  });
  console.log(`✔ Gateway: ${gateway.name}`);

  // ── Sample Reservation ────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const startTime = new Date(tomorrow);
  startTime.setHours(9, 0, 0, 0);
  const endTime = new Date(tomorrow);
  endTime.setHours(17, 0, 0, 0);

  await prisma.reservation.create({
    data: {
      deskId: desks[0].id,
      userId: endUser.id,
      date: tomorrow,
      startTime,
      endTime,
      status: 'CONFIRMED',
    },
  });
  console.log(`✔ Sample reservation for ${endUser.firstName} on desk ${desks[0].code}`);

  console.log('\n✅ Seed complete!');
  console.log('\nTest accounts:');
  console.log('  superadmin@reserti.pl  / Admin1234!  (SUPER_ADMIN)');
  console.log('  owner@reserti.pl       / Owner1234!  (OWNER)');
  console.log('  admin@demo-corp.pl     / Admin1234!  (OFFICE_ADMIN)');
  console.log('  staff@demo-corp.pl     / Staff1234!  (STAFF)');
  console.log('  user@demo-corp.pl      / User1234!   (END_USER)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
