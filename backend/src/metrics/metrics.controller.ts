import { Controller, Get, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express'; import { register } from 'prom-client';
@Controller()
export class MetricsController {
  @Get('metrics')
  async metrics(@Req() req: Request, @Res() res: Response) {
    const allowed=(process.env.METRICS_ALLOWED_IPS??'127.0.0.1').split(',');
    const ip=req.ip?.replace('::ffff:','')?? '';
    if(!allowed.includes(ip)&&!allowed.includes('*')) return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    res.set('Content-Type',register.contentType); res.send(await register.metrics());
  }
  @Get('health')
  health() { return { status:'ok', timestamp:new Date().toISOString(), version:'0.17.0' }; }
}
