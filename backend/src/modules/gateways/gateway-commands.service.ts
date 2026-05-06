import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Response } from 'express';
import { randomBytes } from 'crypto';

export interface PendingCommand {
  nonce:     string;
  event:     string;
  data:      Record<string, unknown>;
  expiresAt: number;
  resolve:   (ack: { ok: boolean; error?: string }) => void;
  reject:    (err: Error) => void;
  timer:     NodeJS.Timeout;
}

@Injectable()
export class GatewayCommandsService implements OnModuleDestroy {
  private readonly logger = new Logger(GatewayCommandsService.name);

  // gatewayId → active SSE Response
  private readonly connections = new Map<string, Response>();

  // nonce → PendingCommand waiting for ACK
  private readonly pending = new Map<string, PendingCommand>();

  // ── Connection management ────────────────────────────────────

  registerConnection(gatewayId: string, res: Response): void {
    const existing = this.connections.get(gatewayId);
    if (existing && !existing.writableEnded) {
      existing.end();
      this.logger.log(`SSE: replaced existing connection — gatewayId=${gatewayId}`);
    }
    this.connections.set(gatewayId, res);
    this.logger.log(`SSE: connected — gatewayId=${gatewayId} total=${this.connections.size}`);
  }

  removeConnection(gatewayId: string): void {
    this.connections.delete(gatewayId);
    this.logger.log(`SSE: disconnected — gatewayId=${gatewayId} total=${this.connections.size}`);
  }

  isConnected(gatewayId: string): boolean {
    const res = this.connections.get(gatewayId);
    return !!res && !res.writableEnded;
  }

  // ── Command publishing ───────────────────────────────────────

  /**
   * Publishes a command to the gateway via SSE and optionally waits for ACK.
   * @param timeoutMs  ACK timeout in ms; 0 = fire-and-forget
   */
  async publish(
    gatewayId: string,
    event:     string,
    data:      Record<string, unknown>,
    timeoutMs = 15_000,
  ): Promise<void> {
    const res = this.connections.get(gatewayId);
    if (!res || res.writableEnded) {
      throw new Error(`Gateway ${gatewayId} is not connected (SSE)`);
    }

    const nonce     = randomBytes(16).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + Math.max(Math.ceil(timeoutMs / 1000) * 2, 60);
    const payload   = { ...data, nonce, expiresAt };

    this._writeEvent(res, event, nonce, payload);

    if (timeoutMs === 0) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error(`ACK timeout for nonce=${nonce} event=${event} gatewayId=${gatewayId}`));
      }, timeoutMs);

      this.pending.set(nonce, {
        nonce,
        event,
        data: payload,
        expiresAt,
        resolve: (ack) => {
          if (ack.ok) {
            resolve();
          } else {
            reject(new Error(`Gateway NACK: ${ack.error ?? 'unknown error'}`));
          }
        },
        reject,
        timer,
      });
    });
  }

  handleAck(nonce: string, ok: boolean, error?: string): void {
    const cmd = this.pending.get(nonce);
    if (!cmd) {
      this.logger.debug(`ACK for unknown nonce=${nonce} (already timed out or duplicate)`);
      return;
    }
    clearTimeout(cmd.timer);
    this.pending.delete(nonce);
    cmd.resolve({ ok, error });
    this.logger.log(`ACK received: nonce=${nonce} ok=${ok}`);
  }

  // ── Private ──────────────────────────────────────────────────

  private _writeEvent(
    res:     Response,
    event:   string,
    id:      string,
    payload: Record<string, unknown>,
  ): void {
    try {
      res.write(`id: ${id}\n`);
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch (err) {
      this.logger.error(`SSE write failed: ${err}`);
    }
  }

  onModuleDestroy(): void {
    for (const [id, res] of this.connections) {
      if (!res.writableEnded) res.end();
      this.logger.log(`SSE: closed on destroy — gatewayId=${id}`);
    }
    this.connections.clear();
    for (const cmd of this.pending.values()) {
      clearTimeout(cmd.timer);
      cmd.reject(new Error('Server shutting down'));
    }
    this.pending.clear();
  }
}
