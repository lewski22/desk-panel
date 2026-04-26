export const STATUS_CFG: Record<string, {
  label: string; dot: string; bg: string; text: string; activeBg: string;
}> = {
  CONFIRMED: { label: 'Potwierdzone', dot: '#10B981', bg: '#d1fae5', text: '#065f46', activeBg: '#10B981' },
  PENDING:   { label: 'Oczekujące',   dot: '#f59e0b', bg: '#fef3c7', text: '#854d0e', activeBg: '#f59e0b' },
  COMPLETED: { label: 'Zakończone',   dot: '#38bdf8', bg: '#e0f2fe', text: '#0c4a6e', activeBg: '#38bdf8' },
  CANCELLED: { label: 'Anulowane',    dot: '#a1a1aa', bg: '#f4f4f5', text: '#3f3f46', activeBg: '#a1a1aa' },
  EXPIRED:   { label: 'Wygasłe',      dot: '#EF4444', bg: '#fee2e2', text: '#991b1b', activeBg: '#EF4444' },
};
