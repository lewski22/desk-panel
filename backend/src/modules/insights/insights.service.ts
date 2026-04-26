/**
 * InsightsService — Sprint K2
 *
 * Template engine (nie LLM) generujący insights zajętości per lokalizacja.
 * Cron: codziennie o 07:00, wynik cachowany w UtilizationInsight.
 *
 * backend/src/modules/insights/insights.service.ts
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService }        from '../../database/prisma.service';

// ── Typy ────────────────────────────────────────────────────────
export type InsightType =
  | 'PEAK_DAY'
  | 'UNDERUTILIZED_ZONE'
  | 'GHOST_DESKS'
  | 'MORNING_RUSH'
  | 'NFC_VS_QR'
  | 'AVG_DURATION';

export type InsightSeverity = 'info' | 'warning' | 'success';

export interface InsightItem {
  type:     InsightType;
  title:    string;
  body:     string;
  metric:   number;        // główna liczba
  unit:     string;        // '%', 'min', 'dni/tyg' itp.
  severity: InsightSeverity;
}

const PERIOD_DAYS    = 30;
const MIN_CHECKINS   = 3; // min. check-inów żeby generować insighty

const DAYS_PL = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];

@Injectable()
export class InsightsService implements OnModuleInit {
  private readonly logger = new Logger(InsightsService.name);

  constructor(readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await (this.prisma as any).utilizationInsight.count().catch(() => 0);
    if (count === 0) {
      this.logger.log('[K2] Table empty — seeding insights on startup');
      this.cronGenerateAll().catch(e => this.logger.error('[K2] Startup seed failed:', e.message));
    }
  }

  // ── Cron: 07:00 każdego dnia ─────────────────────────────────
  @Cron('0 7 * * *', { name: 'generate-insights' })
  async cronGenerateAll(): Promise<void> {
    this.logger.log('[K2] Starting daily insights generation');

    const locations = await this.prisma.location.findMany({
      select: { id: true, organizationId: true, name: true },
    });

    let generated = 0;
    let skipped   = 0;

    for (const loc of locations) {
      try {
        const items = await this._generateForLocation(loc.id, loc.organizationId);
        if (items === null) { skipped++; continue; }

        // Upsert — zastąp poprzedni insight dla tej lokalizacji
        // (DELETE stare + INSERT nowe w transakcji)
        await this.prisma.$transaction([
          (this.prisma as any).utilizationInsight.deleteMany({
            where: { locationId: loc.id },
          }),
          (this.prisma as any).utilizationInsight.create({
            data: {
              locationId: loc.id,
              orgId:      loc.organizationId,
              periodDays: PERIOD_DAYS,
              insights:   items as any,
            },
          }),
        ]);
        generated++;
      } catch (err: any) {
        this.logger.error(`[K2] Failed for location ${loc.id}: ${err.message}`);
      }
    }

    this.logger.log(`[K2] Done — generated: ${generated}, skipped (too few data): ${skipped}`);
  }

  // ── Publiczne API ─────────────────────────────────────────────
  /**
   * getForLocation — zwraca ostatnie insighty dla lokalizacji.
   * Jeśli starsze niż 36h → odpal regenerację w tle.
   */
  async getForLocation(locationId: string, orgId?: string): Promise<InsightItem[]> {
    const record = await (this.prisma as any).utilizationInsight.findFirst({
      where: { locationId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) {
      // Wygeneruj synchronicznie przy pierwszym wywołaniu
      const items = await this._generateForLocation(locationId, orgId ?? '');
      if (!items) return [];
      // Zapisz w tle
      this._saveInsight(locationId, orgId ?? '', items).catch(() => {});
      return items;
    }

    // Stale-while-revalidate — zwróć cache, odśwież w tle jeśli > 36h
    const ageH = (Date.now() - new Date(record.generatedAt).getTime()) / 3_600_000;
    if (ageH > 36) {
      this._generateForLocation(locationId, orgId ?? '')
        .then(items => items && this._saveInsight(locationId, orgId ?? '', items))
        .catch(() => {});
    }

    return (record.insights as InsightItem[]) ?? [];
  }

  /**
   * getForOrg — zwraca insighty dla wszystkich lokalizacji orga.
   * Używane przez OwnerPage → Platform Insights.
   */
  async getForOrg(orgId: string): Promise<Array<{ locationId: string; locationName: string; insights: InsightItem[] }>> {
    const records = await (this.prisma as any).utilizationInsight.findMany({
      where: { orgId },
      orderBy: { generatedAt: 'desc' },
      include: { location: { select: { name: true } } },
    });

    // Deduplikuj — tylko najnowszy per location
    const seen = new Set<string>();
    const result: Array<{ locationId: string; locationName: string; insights: InsightItem[] }> = [];

    for (const r of records) {
      if (seen.has(r.locationId)) continue;
      seen.add(r.locationId);
      result.push({
        locationId:   r.locationId,
        locationName: r.location?.name ?? r.locationId,
        insights:     r.insights as InsightItem[],
      });
    }

    return result;
  }

  // ── Template engine ──────────────────────────────────────────
  /**
   * _generateForLocation — oblicza 6 wzorców i zwraca listę InsightItem.
   * Zwraca null jeśli za mało danych.
   */
  async _generateForLocation(
    locationId: string,
    _orgId:     string,
  ): Promise<InsightItem[] | null> {
    const since = new Date();
    since.setDate(since.getDate() - PERIOD_DAYS);

    // ── Dane bazowe ─────────────────────────────────────────────
    const checkins = await this.prisma.checkin.findMany({
      where: {
        desk: { locationId },
        checkedInAt: { gte: since },
      },
      select: {
        checkedInAt:  true,
        checkedOutAt: true,
        method:       true,
        deskId:       true,
        reservationId: true,
        desk: { select: { zone: true } },
      },
    });

    if (checkins.length < MIN_CHECKINS) return null;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        desk: { locationId },
        date: { gte: since },
        status: { in: ['CONFIRMED', 'COMPLETED'] as any },
      },
      select: {
        id:     true,
        deskId: true,
        date:   true,
      },
    });

    const totalDesks = await this.prisma.desk.count({
      where: { locationId, status: 'ACTIVE' },
    });

    const items: InsightItem[] = [];

    // ── Wzorzec 1: PEAK_DAY ──────────────────────────────────
    const byDay = Array(7).fill(0);
    for (const ci of checkins) {
      byDay[ci.checkedInAt.getDay()]++;
    }
    const peakDayIdx  = byDay.indexOf(Math.max(...byDay));
    const peakDayPct  = Math.round((byDay[peakDayIdx] / checkins.length) * 100);
    items.push({
      type:     'PEAK_DAY',
      title:    'Najbardziej oblegany dzień',
      body:     `${DAYS_PL[peakDayIdx]} odpowiada za ${peakDayPct}% wszystkich wejść w analizowanym okresie.`,
      metric:   peakDayPct,
      unit:     '%',
      severity: peakDayPct > 40 ? 'warning' : 'info',
    });

    // ── Wzorzec 2: UNDERUTILIZED_ZONE ───────────────────────
    const zoneMap = new Map<string, number>();
    for (const ci of checkins) {
      const z = ci.desk?.zone ?? 'Bez strefy';
      zoneMap.set(z, (zoneMap.get(z) ?? 0) + 1);
    }
    if (zoneMap.size > 1) {
      const minZone    = [...zoneMap.entries()].sort((a, b) => a[1] - b[1])[0];
      const minZonePct = Math.round((minZone[1] / checkins.length) * 100);
      items.push({
        type:     'UNDERUTILIZED_ZONE',
        title:    'Niedostatecznie wykorzystana strefa',
        body:     `Strefa „${minZone[0]}" generuje tylko ${minZonePct}% wejść. Rozważ reorganizację lub konwersję biurek.`,
        metric:   minZonePct,
        unit:     '%',
        severity: minZonePct < 15 ? 'warning' : 'info',
      });
    }

    // ── Wzorzec 3: GHOST_DESKS ───────────────────────────────
    const checkinReservationIds = new Set(
      checkins.map(ci => ci.reservationId).filter(Boolean),
    );
    const ghostCount = reservations.filter(
      r => !checkinReservationIds.has(r.id),
    ).length;
    const ghostPct = reservations.length > 0
      ? Math.round((ghostCount / reservations.length) * 100)
      : 0;
    if (reservations.length >= 5) {
      items.push({
        type:     'GHOST_DESKS',
        title:    'Rezerwacje bez check-inu',
        body:     `${ghostPct}% rezerwacji (${ghostCount} z ${reservations.length}) nie zakończyło się check-inem. Rozważ skrócenie okna anulowania.`,
        metric:   ghostPct,
        unit:     '%',
        severity: ghostPct > 25 ? 'warning' : ghostPct > 10 ? 'info' : 'success',
      });
    }

    // ── Wzorzec 4: MORNING_RUSH ──────────────────────────────
    const morningCheckins = checkins.filter(ci => ci.checkedInAt.getHours() < 10).length;
    const morningPct      = Math.round((morningCheckins / checkins.length) * 100);
    items.push({
      type:     'MORNING_RUSH',
      title:    'Poranny szczyt wejść',
      body:     `${morningPct}% check-inów następuje przed godz. 10:00. ${
        morningPct > 60
          ? 'Rozważ elastyczne godziny otwarcia lub priorytetowe blokowanie biurek rano.'
          : 'Rozkład wejść jest zrównoważony w ciągu dnia.'
      }`,
      metric:   morningPct,
      unit:     '%',
      severity: morningPct > 65 ? 'warning' : 'info',
    });

    // ── Wzorzec 5: NFC_VS_QR ────────────────────────────────
    const nfcCount  = checkins.filter(ci => ci.method === 'NFC').length;
    const qrCount   = checkins.filter(ci => ci.method === 'QR').length;
    const otherCount = checkins.length - nfcCount - qrCount;
    const nfcPct    = Math.round((nfcCount  / checkins.length) * 100);
    const qrPct     = Math.round((qrCount   / checkins.length) * 100);
    items.push({
      type:     'NFC_VS_QR',
      title:    'Metody check-inu',
      body:     `NFC: ${nfcPct}% · QR: ${qrPct}%${otherCount > 0 ? ` · Ręczny: ${100 - nfcPct - qrPct}%` : ''}. ${
        nfcPct > 70
          ? 'Beacony NFC są głównym kanałem — zadbaj o ich uptime.'
          : qrPct > 70
          ? 'QR dominuje — rozważ instalację dodatkowych beaconów NFC.'
          : 'Kanały są zrównoważone.'
      }`,
      metric:   nfcPct,
      unit:     '% NFC',
      severity: 'info',
    });

    // ── Wzorzec 6: AVG_DURATION ──────────────────────────────
    const durations = checkins
      .filter(ci => ci.checkedOutAt)
      .map(ci => ci.checkedOutAt!.getTime() - ci.checkedInAt.getTime());

    if (durations.length >= 5) {
      const avgMinutes = Math.round(
        durations.reduce((s, d) => s + d, 0) / durations.length / 60_000,
      );
      const avgH = Math.floor(avgMinutes / 60);
      const avgM = avgMinutes % 60;
      items.push({
        type:     'AVG_DURATION',
        title:    'Średnia długość sesji',
        body:     `${avgH}h ${avgM}min — obliczone na podstawie ${durations.length} sesji z check-outem. ${
          avgMinutes < 120
            ? 'Większość sesji jest krótka — hot-desking działa sprawnie.'
            : avgMinutes > 480
            ? 'Długie sesje mogą blokować biurka. Rozważ automatyczny checkout.'
            : 'Czas sesji jest typowy dla biura hybrydowego.'
        }`,
        metric:   avgMinutes,
        unit:     'min',
        severity: avgMinutes > 480 ? 'warning' : 'info',
      });
    }

    return items;
  }

  private async _saveInsight(
    locationId: string,
    orgId:      string,
    items:      InsightItem[],
  ): Promise<void> {
    await this.prisma.$transaction([
      (this.prisma as any).utilizationInsight.deleteMany({ where: { locationId } }),
      (this.prisma as any).utilizationInsight.create({
        data: { locationId, orgId, periodDays: PERIOD_DAYS, insights: items as any },
      }),
    ]);
  }
}
