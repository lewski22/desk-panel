import { CardFactory, Attachment } from 'botbuilder';

export function helpCard(): Attachment {
  return CardFactory.adaptiveCard({
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '🏢 Reserti Desk Booking', size: 'ExtraLarge', weight: 'Bolder', color: 'Accent' },
      { type: 'TextBlock', text: 'Dostępne komendy:', weight: 'Bolder', spacing: 'Medium' },
      {
        type: 'FactSet',
        facts: [
          { title: 'book', value: 'Zarezerwuj biurko (formularz)' },
          { title: 'reservations / moje', value: 'Moje nadchodzące rezerwacje' },
          { title: 'cancel <id>', value: 'Anuluj rezerwację po ID' },
          { title: 'help', value: 'Ta wiadomość' },
        ],
      },
      {
        type: 'TextBlock',
        text: 'Możesz też użyć komendy /book lub /reservations w oknie kompozycji.',
        isSubtle: true,
        size: 'Small',
        wrap: true,
        spacing: 'Medium',
      },
    ],
  });
}

export function bookingFormCard(
  desks: Array<{ id: string; name: string; zone?: string | null; location: string }>,
  defaultDate: string,
): Attachment {
  return CardFactory.adaptiveCard({
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '🪑 Zarezerwuj biurko', size: 'Large', weight: 'Bolder', color: 'Accent' },
      { type: 'Input.Date', id: 'date', label: 'Data', value: defaultDate, isRequired: true },
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column', width: 1,
            items: [{ type: 'Input.Time', id: 'startTime', label: 'Od', value: '09:00', isRequired: true }],
          },
          {
            type: 'Column', width: 1,
            items: [{ type: 'Input.Time', id: 'endTime', label: 'Do', value: '17:00', isRequired: true }],
          },
        ],
      },
      {
        type: 'Input.ChoiceSet',
        id: 'deskId',
        label: 'Biurko',
        isRequired: true,
        placeholder: 'Wybierz biurko...',
        choices: desks.map(d => ({
          title: d.zone ? `${d.name} · ${d.zone} (${d.location})` : `${d.name} (${d.location})`,
          value: d.id,
        })),
      },
    ],
    actions: [
      { type: 'Action.Submit', title: '✅ Zarezerwuj', data: { botAction: 'confirmBook' } },
    ],
  });
}

export function reservationsCard(
  items: Array<{ id: string; deskName: string; location: string; date: string; startTime: string; endTime: string }>,
): Attachment {
  if (items.length === 0) {
    return CardFactory.adaptiveCard({
      type: 'AdaptiveCard', version: '1.4',
      body: [
        { type: 'TextBlock', text: '📋 Moje rezerwacje', size: 'Large', weight: 'Bolder', color: 'Accent' },
        { type: 'TextBlock', text: 'Brak nadchodzących rezerwacji.', color: 'Warning', wrap: true },
      ],
    });
  }

  const rows = items.map(r => ({
    type: 'Container',
    separator: true,
    items: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column', width: 'stretch',
            items: [
              { type: 'TextBlock', text: r.deskName, weight: 'Bolder' },
              { type: 'TextBlock', text: `${r.date}  ${r.startTime}–${r.endTime}`, isSubtle: true, size: 'Small' },
              { type: 'TextBlock', text: r.location, isSubtle: true, size: 'Small' },
            ],
          },
          {
            type: 'Column', width: 'auto', verticalContentAlignment: 'Center',
            items: [{
              type: 'ActionSet',
              actions: [{ type: 'Action.Submit', title: '❌ Anuluj', style: 'destructive', data: { botAction: 'cancelBook', reservationId: r.id } }],
            }],
          },
        ],
      },
    ],
  }));

  return CardFactory.adaptiveCard({
    type: 'AdaptiveCard', version: '1.4',
    body: [
      { type: 'TextBlock', text: `📋 Moje rezerwacje (${items.length})`, size: 'Large', weight: 'Bolder', color: 'Accent' },
      ...rows,
    ],
  });
}

export function successCard(message: string): Attachment {
  return CardFactory.adaptiveCard({
    type: 'AdaptiveCard', version: '1.4',
    body: [{ type: 'TextBlock', text: `✅ ${message}`, weight: 'Bolder', color: 'Good', wrap: true }],
  });
}

export function errorCard(message: string): Attachment {
  return CardFactory.adaptiveCard({
    type: 'AdaptiveCard', version: '1.4',
    body: [{ type: 'TextBlock', text: `❌ ${message}`, color: 'Attention', wrap: true }],
  });
}
