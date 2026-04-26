export interface FieldErrors { [field: string]: string }

export function parseApiError(e: any): { global: string; fields: FieldErrors } {
  const raw     = e?.response?.data ?? e;
  const message: string | string[] = raw?.message ?? e?.message ?? 'Błąd serwera';

  if (Array.isArray(message)) {
    const fields: FieldErrors = {};
    message.forEach(msg => {
      const fieldMatch = msg.match(/^(\w+)\s/);
      if (fieldMatch) fields[fieldMatch[1]] = msg;
    });
    const global = Object.keys(fields).length === 0 ? message.join('; ') : '';
    return { global, fields };
  }

  const fieldHints: Record<string, string> = {
    'already exists': 'code',
    'code':           'code',
    'name':           'name',
    'email':          'email',
    'conflict':       'startTime',
  };
  for (const [hint, field] of Object.entries(fieldHints)) {
    if (String(message).toLowerCase().includes(hint)) {
      return { global: '', fields: { [field]: String(message) } };
    }
  }

  return { global: String(message), fields: {} };
}
