// ── PATCH: backend/src/modules/notifications/notifications.service.ts ──────
// Dodaj tę metodę publiczną DO ISTNIEJĄCEJ klasy NotificationsService
// Umieść po metodzie testSend()

/**
 * sendVisitorInvite — wysyła zaproszenie emailem do gościa biura.
 *
 * Nie wymaga NotificationSetting — to mail transakcyjny, nie firmowy alert.
 * Używa SMTP organizacji (lub globalnego fallbacku).
 * Loguje wynik do NotificationLog ze stringowym typem 'VISITOR_INVITED'.
 */
async sendVisitorInvite(opts: {
  visitor: {
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string;
    visitDate: Date;
    qrToken:   string;
    purpose?:  string | null;
    company?:  string | null;
  };
  host: {
    firstName: string;
    lastName:  string;
  };
  location: {
    name: string;
    organizationId: string;
  };
}): Promise<void> {
  const { visitor, host, location } = opts;

  const visitDateStr = visitor.visitDate.toLocaleDateString('pl-PL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // QR link — używany przez recepcję do check-in przez kamerę / panel
  const qrUrl = `${this.config.get('FRONTEND_URL', 'https://staff.prohalw2026.ovh')}/visitors/qr/${visitor.qrToken}`;

  const html = this._mailer.buildHtml({
    title:    `Zaproszenie do ${location.name}`,
    body: `
      <p>Cześć <strong>${visitor.firstName}</strong>,</p>
      <p>
        ${host.firstName} ${host.lastName} zaprasza Cię do odwiedzenia
        biura <strong>${location.name}</strong>.
      </p>
      <table style="margin:16px 0;border-collapse:collapse">
        <tr><td style="color:#6b7280;padding:4px 12px 4px 0">Data wizyty</td><td><strong>${visitDateStr}</strong></td></tr>
        ${visitor.purpose ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Cel wizyty</td><td>${visitor.purpose}</td></tr>` : ''}
        ${visitor.company ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Firma</td><td>${visitor.company}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:4px 12px 4px 0">Gospodarz</td><td>${host.firstName} ${host.lastName}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px">
        Pokaż ten email lub kod QR przy wejściu. Recepcja użyje go do szybkiej rejestracji.
      </p>
    `,
    ctaLabel: 'Pokaż kod QR',
    ctaUrl:   qrUrl,
    color:    '#B53578',
  });

  const result = await this._mailer.send(
    {
      to:      [visitor.email],
      subject: `Zaproszenie do ${location.name} — ${visitDateStr}`,
      html,
    },
    location.organizationId,
  );

  // Log — używamy stringa żeby nie dodawać wartości do enum (zero migracji)
  await this.prisma.notificationLog.create({
    data: {
      type:           'VISITOR_INVITED' as any,  // cast — typ nie jest w enum
      organizationId: location.organizationId,
      subject:        `Zaproszenie do ${location.name}`,
      recipients:     [visitor.email],
      dedupeKey:      `visitor-invite-${visitor.id}`,
      success:        result.ok,
      errorMsg:       result.error,
    },
  }).catch(() => {}); // log failure nie może blokować odpowiedzi
}
