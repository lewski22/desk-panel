import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response }                    from 'express';
import { ConfigService }               from '@nestjs/config';
import { ApiExcludeController }        from '@nestjs/swagger';

/**
 * Serwuje skrypt instalacyjny install.sh z tokenem wstrzykniętym jako
 * zmienne środowiskowe na początku pliku.
 *
 * Endpoint: GET /install/gateway/:token
 * — POZA globalPrefix /api/v1
 * — Wywołanie: curl -fsSL https://api.domain.pl/install/gateway/TOKEN | bash
 */
@ApiExcludeController()
@Controller('install')
export class InstallController {
  constructor(private config: ConfigService) {}

  @Get('gateway/:token')
  serveInstallScript(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const apiUrl = this.config.get<string>('PUBLIC_API_URL') ?? '';

    // Skrypt instalacyjny z wstrzykniętymi zmiennymi
    // Token + URL API są bezpiecznie zakodowane w zmiennych bash
    // — brak potrzeby przechowywania tokenu w URL samego skryptu
    const script = this._buildScript(token, apiUrl);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="install.sh"');
    // Nie cachuj — token jest jednorazowy
    res.setHeader('Cache-Control', 'no-store');
    res.send(script);
  }

  private _buildScript(token: string, apiUrl: string): string {
    // Sanityzacja — token to cuid(), tylko alfanumeryczne
    const safeToken  = token.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeApiUrl = apiUrl.replace(/[^a-zA-Z0-9:/.?=&_-]/g, '');

    return `#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Reserti Gateway — skrypt instalacyjny
# Wygenerowano: ${new Date().toISOString()}
# Ten skrypt jest jednorazowy — token wygasa po użyciu lub po 24h
# ═══════════════════════════════════════════════════════════════

# Zmienne wstrzyknięte przez backend
export RESERTI_SETUP_TOKEN="${safeToken}"
export RESERTI_API_URL="${safeApiUrl}"

# Pobierz i uruchom właściwy skrypt instalacyjny
SCRIPT_URL="${this.config.get<string>('GATEWAY_INSTALL_SCRIPT_URL') ?? 'https://raw.githubusercontent.com/lewski22/desk-gateway-python/main/install.sh'}"

echo "Pobieranie skryptu instalacyjnego..."
TMPFILE=$(mktemp /tmp/reserti-install-XXXXXX.sh)
trap "rm -f $TMPFILE" EXIT

if ! curl -fsSL "$SCRIPT_URL" -o "$TMPFILE"; then
  echo "[✗] Nie można pobrać skryptu instalacyjnego"
  echo "    Sprawdź połączenie z internetem i spróbuj ponownie"
  exit 1
fi

chmod +x "$TMPFILE"
exec bash "$TMPFILE"
`;
  }
}
