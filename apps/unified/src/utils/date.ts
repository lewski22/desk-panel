// ── Date utilities — używaj lokalnej daty, nie UTC ──────────
// new Date().toISOString().slice(0,10) zwraca datę UTC
// co przy UTC+2 o 01:00 daje POPRZEDNI dzień.
// localDateStr() zawsze zwraca aktualną lokalną datę.

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Buduje ISO datetime z lokalnej daty + lokalnej godziny HH:MM
// Nie dodaje 'Z' — JS parsuje bez Z jako czas lokalny
// .toISOString() konwertuje poprawnie do UTC dla backendu
export function localDateTimeISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
