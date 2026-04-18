/**
 * RecommendationsService — Sprint K1
 *
 * Algorytm rule-based: historia 20 rezerwacji usera →
 * scoring wolnych biurek → top rekomendacja.
 *
 * backend/src/modules/recommendations/recommendations.service.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }       from '../../database/prisma.service';

// ── Wagi scoringu (suma=100) ──────────────────────────────────
const W_SAME_DESK  = 50; // to samo biurko co najczęściej
const W_SAME_ZONE  = 25; // ta sama strefa
const W_BEACON_UP  = 15; // beacon online
const W_RECENT     = 10; // użyte w ostatnich 7 dniach

const HISTORY_LIMIT     = 20;   // ostatnie N rezerwacji
const RECENT_DAYS       = 7;    // próg "niedawno"
const MIN_HISTORY_COUNT = 0;    // brak historii → fallback, nie błąd

export interface DeskRecommendation {
  deskId:    string;
  deskName:  string;
  deskCode:  string;
  zone:      string | null;
  floor:     string | null;
  score:     number;
  reason:    'FAVORITE' | 'FAVORITE_ZONE' | 'ANY_FREE';
  isOnline:  boolean;
  // Licznik ile razy user rezerwował to biurko (do UI)
  timesBooked: number;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * getRecommendedDesk — główna metoda K1.
   *
   * @param userId   — JWT subject
   * @param locationId — filtr lokalizacji (obowiązkowy)
   * @param date     — dzień rezerwacji (YYYY-MM-DD)
   * @param start    — czas rozpoczęcia (ISO lub HH:MM)
   * @param end      — czas zakończenia (ISO lub HH:MM)
   * @param actorOrgId — izolacja org
   */
  async getRecommendedDesk(
    userId:      string,
    locationId:  string,
    date:        string,
    start:       string,
    end:         string,
    actorOrgId?: string,
  ): Promise<DeskRecommendation | null> {
    const slotStart = this._parseSlotTime(date, start);
    const slotEnd   = this._parseSlotTime(date, end);

    // ── 1. Historia rezerwacji usera ─────────────────────────
    const history = await this.prisma.reservation.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'COMPLETED'] as any },
        desk: {
          location: {
            id: locationId,
            ...(actorOrgId && { organizationId: actorOrgId }),
          },
        },
      },
      select: {
        deskId:    true,
        startTime: true,
        desk: {
          select: {
            id:     true,
            name:   true,
            code:   true,
            zone:   true,
            floor:  true,
            status: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take:    HISTORY_LIMIT,
    });

    // ── 2. Policz częstość biurek ────────────────────────────
    const deskFreq = new Map<string, { count: number; lastUsed: Date }>();
    for (const r of history) {
      const entry = deskFreq.get(r.deskId);
      if (entry) {
        entry.count++;
        if (r.startTime > entry.lastUsed) entry.lastUsed = r.startTime;
      } else {
        deskFreq.set(r.deskId, { count: 1, lastUsed: r.startTime });
      }
    }

    // Ulubione biurko + strefa
    const favDeskId = deskFreq.size > 0
      ? [...deskFreq.entries()].sort((a, b) => b[1].count - a[1].count)[0][0]
      : null;
    const favZone = history.find(r => r.deskId === favDeskId)?.desk?.zone ?? null;

    // ── 3. Pobierz dostępne biurka w lokalizacji ─────────────
    const allDesks = await this.prisma.desk.findMany({
      where: {
        locationId,
        status: 'ACTIVE',
        location: actorOrgId ? { organizationId: actorOrgId } : undefined,
      },
      select: {
        id:     true,
        name:   true,
        code:   true,
        zone:   true,
        floor:  true,
        device: { select: { isOnline: true } },
      },
    });

    // ── 4. Pobierz konflikty dla danego slotu ─────────────────
    const conflictingDeskIds = await this._getConflictingDesks(
      locationId, slotStart, slotEnd,
    );
    const conflictSet = new Set(conflictingDeskIds);

    // ── 5. Score każde dostępne biurko ───────────────────────
    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - RECENT_DAYS);

    const scored: Array<DeskRecommendation & { _score: number }> = [];

    for (const desk of allDesks) {
      // Wyklucz biurka z konfliktem
      if (conflictSet.has(desk.id)) continue;

      const freq       = deskFreq.get(desk.id);
      const isOnline   = desk.device?.isOnline ?? false;
      const timesBooked = freq?.count ?? 0;

      let score = 0;
      let reason: DeskRecommendation['reason'] = 'ANY_FREE';

      if (favDeskId && desk.id === favDeskId) {
        score += W_SAME_DESK;
        reason = 'FAVORITE';
      } else if (favZone && desk.zone === favZone) {
        score += W_SAME_ZONE;
        reason = 'FAVORITE_ZONE';
      }

      if (isOnline)  score += W_BEACON_UP;
      if (freq && freq.lastUsed > recentThreshold) score += W_RECENT;

      scored.push({
        deskId:   desk.id,
        deskName: desk.name,
        deskCode: desk.code,
        zone:     desk.zone,
        floor:    desk.floor,
        score,
        reason,
        isOnline,
        timesBooked,
        _score: score,
      });
    }

    if (scored.length === 0) return null;

    // ── 6. Najwyższy score wygrywa ───────────────────────────
    scored.sort((a, b) => b._score - a._score || (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
    const best = scored[0];

    // Jeśli score=0 i brak historii → ANY_FREE
    if (best.score === 0 && deskFreq.size === 0) {
      best.reason = 'ANY_FREE';
    }

    return {
      deskId:      best.deskId,
      deskName:    best.deskName,
      deskCode:    best.deskCode,
      zone:        best.zone,
      floor:       best.floor,
      score:       best.score,
      reason:      best.reason,
      isOnline:    best.isOnline,
      timesBooked: best.timesBooked,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────
  private async _getConflictingDesks(
    locationId: string,
    start:      Date,
    end:        Date,
  ): Promise<string[]> {
    const conflicts = await this.prisma.reservation.findMany({
      where: {
        desk: { locationId },
        status: { in: ['PENDING', 'CONFIRMED'] as any },
        // Nakładające się sloty
        OR: [
          { startTime: { lt: end },   endTime: { gt: start } },
        ],
      },
      select: { deskId: true },
      distinct: ['deskId'],
    });
    return conflicts.map(c => c.deskId);
  }

  private _parseSlotTime(date: string, time: string): Date {
    // Akceptuje HH:MM lub pełny ISO
    if (time.includes('T')) return new Date(time);
    return new Date(`${date}T${time}:00.000Z`);
  }
}
