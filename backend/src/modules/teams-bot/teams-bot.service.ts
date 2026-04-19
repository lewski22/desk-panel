/**
 * TeamsBotService — Azure Bot Framework v4
 *
 * Obsługuje wiadomości bezpośrednie do bota i Messaging Extensions
 * (slash commands w oknie kompozycji Teams).
 *
 * Komendy (wiadomość bezpośrednia):
 *   book               — formularz rezerwacji biurka
 *   reservations/moje  — lista nadchodzących rezerwacji
 *   cancel <id>        — anuluj rezerwację
 *   help               — lista komend
 *
 * Messaging Extensions (compose box /book, /reservations):
 *   composeExtension/fetchTask    — otwórz task module
 *   composeExtension/submitAction — przetwórz formularz
 */
import { Injectable, Logger }           from '@nestjs/common';
import { TeamsActivityHandler, TurnContext, MessageFactory } from 'botbuilder';
import type { MessagingExtensionAction, MessagingExtensionActionResponse } from 'botbuilder';
import { PrismaService }                from '../../database/prisma.service';
import {
  helpCard, bookingFormCard, reservationsCard,
  successCard, errorCard,
} from './teams-bot-cards';

@Injectable()
export class TeamsBotService extends TeamsActivityHandler {
  private readonly logger = new Logger(TeamsBotService.name);

  constructor(private readonly prisma: PrismaService) {
    super();

    // ── Wiadomości bezpośrednie ──────────────────────────────────
    this.onMessage(async (context, next) => {
      const value = context.activity.value as any;

      // Akcja z Adaptive Card (Action.Submit)
      if (value?.botAction === 'confirmBook') {
        await this.handleBookConfirm(context, value);
      } else if (value?.botAction === 'cancelBook') {
        await this.handleCancelById(context, context.activity.from.aadObjectId, value.reservationId);
      } else {
        // Komenda tekstowa — usuń @mention, normalizuj
        const raw = (context.activity.text ?? '').replace(/<at>[^<]*<\/at>/g, '').trim();
        const [cmd, ...args] = raw.toLowerCase().split(/\s+/);
        await this.routeCommand(context, cmd, args);
      }

      await next();
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MESSAGING EXTENSIONS (slash commands w compose box)
  // ══════════════════════════════════════════════════════════════

  protected async handleTeamsMessagingExtensionFetchTask(
    context: TurnContext,
    action: MessagingExtensionAction,
  ): Promise<MessagingExtensionActionResponse> {
    const aadOid = context.activity.from.aadObjectId;

    if (action.commandId === 'book') {
      const user = await this.resolveUser(aadOid);
      if (!user) return this.taskMessage('Nie znaleziono konta Reserti powiązanego z Twoim kontem Teams. Zaloguj się do Reserti przez SSO Entra ID.');

      const today    = new Date();
      const desks    = await this.fetchAvailableDesks(user.organizationId!, today, '08:00', '18:00');
      if (!desks.length) return this.taskMessage('Brak dostępnych biurek na dziś.');

      return {
        task: {
          type:  'continue',
          value: { title: 'Zarezerwuj biurko', height: 'medium', width: 'medium', card: bookingFormCard(desks, this.todayStr()) },
        },
      };
    }

    if (action.commandId === 'reservations') {
      const user = await this.resolveUser(aadOid);
      if (!user) return this.taskMessage('Nie znaleziono konta Reserti.');

      const items = await this.fetchUpcomingReservations(user.id);
      return {
        task: {
          type:  'continue',
          value: { title: 'Moje rezerwacje', height: 'medium', width: 'medium', card: reservationsCard(items) },
        },
      };
    }

    return this.taskMessage('Nieznana komenda.');
  }

  protected async handleTeamsMessagingExtensionSubmitAction(
    context: TurnContext,
    action: MessagingExtensionAction,
  ): Promise<MessagingExtensionActionResponse> {
    const aadOid = context.activity.from.aadObjectId;
    const data   = action.data as any;

    if (action.commandId === 'book' && data?.botAction === 'confirmBook') {
      const result = await this.createReservation(aadOid, data);
      if (result.ok) {
        return {
          composeExtension: {
            type:             'result',
            attachmentLayout: 'list',
            attachments:      [successCard(result.message)],
          },
        };
      }
      return this.taskMessage(result.message);
    }

    if (data?.botAction === 'cancelBook') {
      const user = await this.resolveUser(aadOid);
      if (!user) return this.taskMessage('Nie znaleziono konta Reserti.');
      await this.cancelReservation(user.id, data.reservationId);
      return this.taskMessage('Rezerwacja została anulowana.');
    }

    return this.taskMessage('Nieznana akcja.');
  }

  // ══════════════════════════════════════════════════════════════
  // COMMAND ROUTING (direct message)
  // ══════════════════════════════════════════════════════════════

  private async routeCommand(context: TurnContext, cmd: string, args: string[]): Promise<void> {
    const aadOid = context.activity.from.aadObjectId;

    switch (cmd) {
      case 'book':
      case 'zarezerwuj':
        return this.handleBook(context, aadOid);

      case 'reservations':
      case 'moje':
      case 'rezerwacje':
        return this.handleReservations(context, aadOid);

      case 'cancel':
      case 'anuluj':
        return this.handleCancelById(context, aadOid, args[0]);

      default:
        await context.sendActivity(MessageFactory.attachment(helpCard()));
    }
  }

  // ── book ──────────────────────────────────────────────────────
  private async handleBook(context: TurnContext, aadOid: string | undefined): Promise<void> {
    const user = await this.resolveUser(aadOid);
    if (!user) {
      await context.sendActivity(MessageFactory.attachment(
        errorCard('Nie znaleziono konta Reserti powiązanego z Twoim kontem Teams. Zaloguj się do Reserti przez SSO Entra ID.'),
      ));
      return;
    }

    const desks = await this.fetchAvailableDesks(user.organizationId!, new Date(), '08:00', '18:00');
    if (!desks.length) {
      await context.sendActivity(MessageFactory.attachment(errorCard('Brak dostępnych biurek na dziś.')));
      return;
    }

    await context.sendActivity(MessageFactory.attachment(bookingFormCard(desks, this.todayStr())));
  }

  // ── Adaptive Card submit: confirmBook ─────────────────────────
  private async handleBookConfirm(context: TurnContext, value: any): Promise<void> {
    const aadOid = context.activity.from.aadObjectId;
    const result = await this.createReservation(aadOid, value);
    await context.sendActivity(MessageFactory.attachment(
      result.ok ? successCard(result.message) : errorCard(result.message),
    ));
  }

  // ── reservations ──────────────────────────────────────────────
  private async handleReservations(context: TurnContext, aadOid: string | undefined): Promise<void> {
    const user = await this.resolveUser(aadOid);
    if (!user) {
      await context.sendActivity(MessageFactory.attachment(errorCard('Nie znaleziono konta Reserti.')));
      return;
    }

    const items = await this.fetchUpcomingReservations(user.id);
    await context.sendActivity(MessageFactory.attachment(reservationsCard(items)));
  }

  // ── cancel ────────────────────────────────────────────────────
  private async handleCancelById(
    context: TurnContext,
    aadOid: string | undefined,
    reservationId: string | undefined,
  ): Promise<void> {
    if (!reservationId) {
      await context.sendActivity('Podaj ID rezerwacji: `cancel <id>`');
      return;
    }

    const user = await this.resolveUser(aadOid);
    if (!user) {
      await context.sendActivity(MessageFactory.attachment(errorCard('Nie znaleziono konta Reserti.')));
      return;
    }

    const cancelled = await this.cancelReservation(user.id, reservationId);
    await context.sendActivity(MessageFactory.attachment(
      cancelled
        ? successCard('Rezerwacja została anulowana.')
        : errorCard('Nie znaleziono rezerwacji lub brak uprawnień.'),
    ));
  }

  // ══════════════════════════════════════════════════════════════
  // BUSINESS LOGIC HELPERS
  // ══════════════════════════════════════════════════════════════

  private async resolveUser(aadOid: string | undefined) {
    if (!aadOid) return null;
    return this.prisma.user.findFirst({
      where: { azureObjectId: aadOid, isActive: true },
      select: { id: true, organizationId: true, firstName: true },
    });
  }

  private async fetchAvailableDesks(
    organizationId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ) {
    const dateStr = date.toISOString().split('T')[0];
    const start   = new Date(`${dateStr}T${startTime}:00`);
    const end     = new Date(`${dateStr}T${endTime}:00`);

    const desks = await this.prisma.desk.findMany({
      where: {
        location:     { organizationId },
        status:       'ACTIVE',
        reservations: {
          none: {
            status:    { in: ['PENDING', 'CONFIRMED'] as any },
            startTime: { lt: end },
            endTime:   { gt: start },
          },
        },
      },
      include: { location: { select: { name: true } } },
      orderBy: [{ location: { name: 'asc' } }, { name: 'asc' }],
      take: 25,
    });

    return desks.map(d => ({
      id:       d.id,
      name:     d.name,
      zone:     d.zone,
      location: d.location.name,
    }));
  }

  private async fetchUpcomingReservations(userId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        userId,
        status:    { in: ['PENDING', 'CONFIRMED'] as any },
        startTime: { gte: new Date() },
      },
      include: { desk: { include: { location: { select: { name: true } } } } },
      orderBy: { startTime: 'asc' },
      take: 5,
    });

    return reservations.map(r => ({
      id:        r.id,
      deskName:  r.desk.name,
      location:  r.desk.location.name,
      date:      r.date.toISOString().split('T')[0],
      startTime: r.startTime.toTimeString().slice(0, 5),
      endTime:   r.endTime.toTimeString().slice(0, 5),
    }));
  }

  private async createReservation(
    aadOid: string | undefined,
    data: { date: string; startTime: string; endTime: string; deskId: string },
  ): Promise<{ ok: boolean; message: string }> {
    const user = await this.resolveUser(aadOid);
    if (!user) return { ok: false, message: 'Nie znaleziono konta Reserti.' };

    const { date, startTime, endTime, deskId } = data;
    if (!date || !startTime || !endTime || !deskId) {
      return { ok: false, message: 'Wypełnij wszystkie pola formularza.' };
    }

    const start = new Date(`${date}T${startTime}:00`);
    const end   = new Date(`${date}T${endTime}:00`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return { ok: false, message: 'Nieprawidłowy zakres czasu.' };
    }

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        status:    { in: ['PENDING', 'CONFIRMED'] as any },
        startTime: { lt: end },
        endTime:   { gt: start },
      },
    });
    if (conflict) return { ok: false, message: 'Biurko jest już zajęte w tym czasie.' };

    const desk = await this.prisma.desk.findUnique({
      where: { id: deskId },
      include: { location: { select: { name: true } } },
    });
    if (!desk) return { ok: false, message: 'Nie znaleziono biurka.' };

    await this.prisma.reservation.create({
      data: {
        deskId,
        userId:    user.id,
        date:      new Date(date),
        startTime: start,
        endTime:   end,
        status:    'CONFIRMED' as any,
      },
    });

    this.logger.log(`Reservation created via Teams bot: desk=${deskId} user=${user.id}`);
    return {
      ok:      true,
      message: `Zarezerwowano **${desk.name}** (${desk.location.name}) na ${date}, ${startTime}–${endTime}.`,
    };
  }

  private async cancelReservation(userId: string, reservationId: string): Promise<boolean> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, userId, status: { in: ['PENDING', 'CONFIRMED'] as any } },
    });
    if (!reservation) return false;

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data:  { status: 'CANCELLED' as any },
    });
    this.logger.log(`Reservation ${reservationId} cancelled via Teams bot`);
    return true;
  }

  // ── Utils ─────────────────────────────────────────────────────

  private todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  private taskMessage(value: string): MessagingExtensionActionResponse {
    return { task: { type: 'message', value } };
  }
}
