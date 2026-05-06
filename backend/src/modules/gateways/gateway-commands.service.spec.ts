import { Test, TestingModule } from '@nestjs/testing';
import { GatewayCommandsService } from './gateway-commands.service';
import { Response } from 'express';

function makeRes(writableEnded = false): jest.Mocked<Partial<Response>> {
  return {
    writableEnded,
    write:     jest.fn(),
    end:       jest.fn(),
    setHeader: jest.fn(),
  } as any;
}

describe('GatewayCommandsService', () => {
  let svc: GatewayCommandsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatewayCommandsService],
    }).compile();
    svc = module.get(GatewayCommandsService);
  });

  afterEach(() => svc.onModuleDestroy());

  // ── Connection management ──────────────────────────────────

  it('registers an SSE connection', () => {
    svc.registerConnection('gw-1', makeRes() as Response);
    expect(svc.isConnected('gw-1')).toBe(true);
  });

  it('isConnected returns false for unknown gateway', () => {
    expect(svc.isConnected('gw-unknown')).toBe(false);
  });

  it('isConnected returns false when writableEnded is true', () => {
    svc.registerConnection('gw-2', makeRes(true) as Response);
    expect(svc.isConnected('gw-2')).toBe(false);
  });

  it('closes previous connection on re-registration', () => {
    const old   = makeRes() as Response;
    const fresh = makeRes() as Response;
    svc.registerConnection('gw-3', old);
    svc.registerConnection('gw-3', fresh);
    expect(old.end).toHaveBeenCalled();
  });

  it('removeConnection removes gateway from map', () => {
    svc.registerConnection('gw-4', makeRes() as Response);
    svc.removeConnection('gw-4');
    expect(svc.isConnected('gw-4')).toBe(false);
  });

  // ── handleAck ─────────────────────────────────────────────

  it('handleAck for unknown nonce does not throw', () => {
    expect(() => svc.handleAck('no-such-nonce', true)).not.toThrow();
  });

  it('handleAck ok=true resolves publish promise', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-5', res);

    const publishPromise = svc.publish('gw-5', 'test_event', {}, 5_000);

    // Extract nonce from the id: line written to response
    const idLine = (res.write as jest.Mock).mock.calls.find(
      (c: string[]) => (c[0] as string).startsWith('id:')
    );
    const nonce = (idLine?.[0] as string)?.replace('id: ', '').trim();
    expect(nonce).toBeDefined();

    svc.handleAck(nonce!, true);
    await expect(publishPromise).resolves.toBeUndefined();
  });

  it('handleAck ok=false rejects publish promise with NACK message', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-6', res);

    const publishPromise = svc.publish('gw-6', 'test_event', {}, 5_000);

    const idLine = (res.write as jest.Mock).mock.calls.find(
      (c: string[]) => (c[0] as string).startsWith('id:')
    );
    const nonce = (idLine?.[0] as string)?.replace('id: ', '').trim();

    svc.handleAck(nonce!, false, 'handler failed');
    await expect(publishPromise).rejects.toThrow('Gateway NACK');
  });

  it('handleAck is idempotent for same nonce', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-idem', res);

    const publishPromise = svc.publish('gw-idem', 'test_event', {}, 5_000);

    const idLine = (res.write as jest.Mock).mock.calls.find(
      (c: string[]) => (c[0] as string).startsWith('id:')
    );
    const nonce = (idLine?.[0] as string)?.replace('id: ', '').trim()!;

    svc.handleAck(nonce, true);
    // Second ACK for same nonce must not throw
    expect(() => svc.handleAck(nonce, false, 'duplicate')).not.toThrow();
    await expect(publishPromise).resolves.toBeUndefined();
  });

  // ── publish ────────────────────────────────────────────────

  it('publish timeoutMs=0 resolves immediately (fire-and-forget)', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-7', res);

    await expect(
      svc.publish('gw-7', 'led_command', { deskId: 'x' }, 0)
    ).resolves.toBeUndefined();
  });

  it('publish throws when gateway is not connected', async () => {
    await expect(
      svc.publish('gw-offline', 'test', {}, 1_000)
    ).rejects.toThrow('not connected');
  });

  it('publish times out and rejects after timeoutMs', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-8', res);

    await expect(
      svc.publish('gw-8', 'slow_event', {}, 50)
    ).rejects.toThrow('ACK timeout');
  }, 500);

  it('publish writes id, event and data lines to response', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-9', res);

    // fire-and-forget so we don't wait
    await svc.publish('gw-9', 'beacon_add', { username: 'u' }, 0);

    const writtenLines: string[] = (res.write as jest.Mock).mock.calls.map(
      (c: string[]) => c[0] as string
    );
    expect(writtenLines.some(l => l.startsWith('id:'))).toBe(true);
    expect(writtenLines.some(l => l.startsWith('event: beacon_add'))).toBe(true);
    expect(writtenLines.some(l => l.startsWith('data:'))).toBe(true);
  });

  it('publish payload includes nonce and expiresAt', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-10', res);

    await svc.publish('gw-10', 'command', { deskId: 'd' }, 0);

    const dataLine = (res.write as jest.Mock).mock.calls.find(
      (c: string[]) => (c[0] as string).startsWith('data:')
    );
    const payload = JSON.parse((dataLine?.[0] as string).replace('data: ', ''));
    expect(payload.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(payload.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  // ── onModuleDestroy ────────────────────────────────────────

  it('onModuleDestroy closes all connections', () => {
    const r1 = makeRes() as Response;
    const r2 = makeRes() as Response;
    svc.registerConnection('gw-a', r1);
    svc.registerConnection('gw-b', r2);
    svc.onModuleDestroy();
    expect(r1.end).toHaveBeenCalled();
    expect(r2.end).toHaveBeenCalled();
  });

  it('onModuleDestroy rejects pending publish promises', async () => {
    const res = makeRes() as Response;
    svc.registerConnection('gw-c', res);

    const publishPromise = svc.publish('gw-c', 'beacon_add', {}, 10_000);
    svc.onModuleDestroy();

    await expect(publishPromise).rejects.toThrow('shutting down');
  });
});
