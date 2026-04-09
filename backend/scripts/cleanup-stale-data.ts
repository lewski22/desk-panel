/**
 * cleanup-stale-data.ts
 * ─────────────────────
 * Skrypt jednorazowy do czyszczenia bazy z przeterminowanych danych.
 *
 * Uruchomienie (z katalogu backend/):
 *   npx ts-node -P tsconfig.json scripts/cleanup-stale-data.ts
 *
 * Lub przez entrypoint w dockerze:
 *   docker exec <container> sh -c "cd /app && npx ts-node scripts/cleanup-stale-data.ts"
 *
 * Co robi:
 *  1. Zamyka otwarte checkins gdzie rezerwacja wygasła (endTime < now)
 *  2. Zamyka stale walk-in checkins starsze niż 12h bez rezerwacji
 *  3. Ustawia EXPIRED dla CONFIRMED/PENDING rezerwacji po endTime
 *  4. Drukuje raport — ile rekordów naprawiono
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function main() {
  const now         = new Date();
  const staleWalkin = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h temu

  console.log('🧹 Desk Beacon — czyszczenie bazy danych');
  console.log(`   Czas: ${now.toISOString()}\n`);

  // ── 1. Zamknij checkins z wygasłą rezerwacją ─────────────────
  const expiredCheckins = await prisma.checkin.findMany({
    where: {
      checkedOutAt: null,
      reservation:  { endTime: { lt: now } },
    },
    select: {
      id:          true,
      deskId:      true,
      checkedInAt: true,
      reservation: { select: { endTime: true, deskId: true } },
    },
  });

  if (expiredCheckins.length > 0) {
    await prisma.checkin.updateMany({
      where: { id: { in: expiredCheckins.map(c => c.id) } },
      data:  { checkedOutAt: now },
    });
    console.log(`✓ Zamknięto ${expiredCheckins.length} checkin(ów) z wygasłą rezerwacją:`);
    for (const c of expiredCheckins) {
      const resEnd = c.reservation?.endTime?.toISOString() ?? '?';
      console.log(`  desk: ${c.deskId}  checkedIn: ${c.checkedInAt.toISOString()}  resEnd: ${resEnd}`);
    }
  } else {
    console.log('✓ Brak otwartych checkins z wygasłą rezerwacją');
  }

  // ── 2. Zamknij stale walk-in checkins (>12h, bez rezerwacji) ──
  const staleCheckins = await prisma.checkin.findMany({
    where: {
      checkedOutAt:  null,
      reservationId: null,
      checkedInAt:   { lt: staleWalkin },
    },
    select: { id: true, deskId: true, checkedInAt: true },
  });

  if (staleCheckins.length > 0) {
    await prisma.checkin.updateMany({
      where: { id: { in: staleCheckins.map(c => c.id) } },
      data:  { checkedOutAt: now },
    });
    console.log(`\n✓ Zamknięto ${staleCheckins.length} stale walk-in checkin(ów) (>12h bez rezerwacji):`);
    for (const c of staleCheckins) {
      const age = Math.round((now.getTime() - c.checkedInAt.getTime()) / 3600000);
      console.log(`  desk: ${c.deskId}  checkedIn: ${c.checkedInAt.toISOString()}  wiek: ${age}h`);
    }
  } else {
    console.log('✓ Brak stale walk-in checkins (>12h)');
  }

  // ── 3. Wygaś przeterminowane rezerwacje ───────────────────────
  // Uwaga: updateMany nie zwraca rekordów — najpierw pobierz do logu
  const staleResIds = await prisma.reservation.findMany({
    where: {
      status:  { in: ['CONFIRMED', 'PENDING'] },
      endTime: { lt: now },
    },
    select: { id: true, deskId: true, startTime: true, endTime: true, status: true },
  });

  let staleResCount = 0;
  if (staleResIds.length > 0) {
    const result = await prisma.reservation.updateMany({
      where: { id: { in: staleResIds.map(r => r.id) } },
      data:  { status: 'EXPIRED' },
    });
    staleResCount = result.count;
    console.log(`\n✓ Ustawiono EXPIRED dla ${staleResCount} rezerwacji po terminie:`);
    for (const r of staleResIds) {
      console.log(`  desk: ${r.deskId}  ${r.startTime.toISOString().slice(0,16)} → ${r.endTime.toISOString().slice(0,16)}  was: ${r.status}`);
    }
  } else {
    console.log('✓ Brak przeterminowanych rezerwacji CONFIRMED/PENDING');
  }

  // ── 4. Sanity check + raport ──────────────────────────────────
  console.log('\n📊 Stan po czyszczeniu:');

  const openCheckins  = await prisma.checkin.count({ where: { checkedOutAt: null } });
  const activeRes     = await prisma.reservation.count({ where: { status: { in: ['CONFIRMED', 'PENDING'] } } });
  const expiredTotal  = await prisma.reservation.count({ where: { status: 'EXPIRED' } });
  const cancelledTotal= await prisma.reservation.count({ where: { status: 'CANCELLED' } });

  // Sanity: czy zostały jeszcze otwarte checkins z wygasłą rezerwacją?
  const stillBroken = await prisma.checkin.count({
    where: {
      checkedOutAt: null,
      reservation:  { endTime: { lt: now } },
    },
  });

  console.log(`  Otwarte checkins (aktywne):    ${openCheckins}`);
  console.log(`  Aktywne rezerwacje:            ${activeRes}`);
  console.log(`  Wygasłe (EXPIRED) łącznie:    ${expiredTotal}`);
  console.log(`  Anulowane (CANCELLED) łącznie: ${cancelledTotal}`);
  console.log(`  Nadal błędnych checkins:       ${stillBroken} ${stillBroken > 0 ? '⚠️  PROBLEM!' : '✅'}`);

  const total = expiredCheckins.length + staleCheckins.length + staleResCount;
  if (total === 0) {
    console.log('\n✅ Baza była czysta — nic do naprawy');
  } else {
    console.log(`\n✅ Naprawiono łącznie: ${total} rekordów`);
    console.log('   Sprawdź panel — biurka powinny teraz pokazywać poprawny status.');
  }
}

main()
  .catch(e => {
    console.error('\n❌ Błąd wykonania:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
