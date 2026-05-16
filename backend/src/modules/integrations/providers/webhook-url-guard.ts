import { BadRequestException } from '@nestjs/common';

/**
 * Blocks SSRF targets: private/loopback/link-local IPv4, private IPv6 ranges,
 * and the AWS metadata endpoint. Throws BadRequestException (400).
 * Called both at config-save time (integrations.service) and at dispatch time (webhook.provider).
 */
export function assertPublicWebhookUrl(rawUrl: string): void {
  let parsed: URL;
  try { parsed = new URL(rawUrl); }
  catch { throw new BadRequestException(`Invalid webhook URL: ${rawUrl}`); }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new BadRequestException('Webhook URL must use HTTP or HTTPS');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|]$/g, ''); // strip IPv6 brackets

  const blockedIPv4 =
    host === 'localhost' ||
    host === '0.0.0.0'  ||
    /^127\./.test(host)                       || // 127.0.0.0/8
    /^10\./.test(host)                        || // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)  || // 172.16.0.0/12
    /^192\.168\./.test(host)                  || // 192.168.0.0/16
    /^169\.254\./.test(host);                    // link-local + AWS metadata

  // IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10),
  // IPv4-mapped loopback (::ffff:127.x.x.x)
  const blockedIPv6 =
    host === '::1'                         ||
    host === '::'                          ||
    /^fc[0-9a-f]{2}:/i.test(host)         || // fc00::/7 unique local (fc00–fdff)
    /^fd[0-9a-f]{2}:/i.test(host)         || // fd00::/8 unique local
    /^fe[89ab][0-9a-f]:/i.test(host)      || // fe80::/10 link-local
    /^::ffff:127\./i.test(host);              // IPv4-mapped loopback

  if (blockedIPv4 || blockedIPv6) {
    throw new BadRequestException(`Webhook URL points to a private or reserved address: ${host}`);
  }
}
