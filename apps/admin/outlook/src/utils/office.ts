// ── Office.js helpery ────────────────────────────────────────
// Wrapper'y dla async Office.js API — zamieniają callback API na Promise

declare const Office: any;

/** Pobierz datę i godzinę startu spotkania */
export function getItemStart(): Promise<Date> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.start.getAsync(
      { asyncContext: null },
      (result: any) => {
        if (result.status === 'failed') reject(new Error(result.error.message));
        else resolve(new Date(result.value));
      },
    );
  });
}

/** Pobierz datę i godzinę końca spotkania */
export function getItemEnd(): Promise<Date> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.end.getAsync(
      { asyncContext: null },
      (result: any) => {
        if (result.status === 'failed') reject(new Error(result.error.message));
        else resolve(new Date(result.value));
      },
    );
  });
}

/** Pobierz temat spotkania */
export function getItemSubject(): Promise<string> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.subject.getAsync(
      { asyncContext: null },
      (result: any) => {
        if (result.status === 'failed') reject(new Error(result.error.message));
        else resolve(result.value ?? '');
      },
    );
  });
}

/** Ustaw pole "Lokalizacja" w spotkaniu */
export function setItemLocation(location: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.location.setAsync(
      location,
      { asyncContext: null },
      (result: any) => {
        if (result.status === 'failed') reject(new Error(result.error.message));
        else resolve();
      },
    );
  });
}

/** Formatuje czas do HH:MM */
export function toHHMM(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

/** Formatuje datę do YYYY-MM-DD */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sprawdź czy jesteśmy w kontekście Outlook (nie w przeglądarce) */
export function isOfficeContext(): boolean {
  try {
    return typeof Office !== 'undefined' && !!Office.context;
  } catch {
    return false;
  }
}
