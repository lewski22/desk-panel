import { Controller, Post, Req, Res, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation }                                     from '@nestjs/swagger';
import { SkipThrottle }                                              from '@nestjs/throttler';
import { Request, Response }                                         from 'express';
import { CloudAdapter }                                              from '@microsoft/botbuilder';
import { TeamsBotService }                                           from './teams-bot.service';

@ApiTags('teams-bot')
@Controller()
export class TeamsBotController {
  private readonly logger = new Logger(TeamsBotController.name);

  constructor(
    private readonly adapter: CloudAdapter,
    private readonly bot:     TeamsBotService,
  ) {}

  /**
   * POST /bot/messages
   *
   * Endpoint rejestrowany w Azure Bot Service jako Messaging Endpoint.
   * Odbiera wszystkie aktywności: wiadomości, invoke (Messaging Extensions), itp.
   * CloudAdapter weryfikuje JWT z Bot Framework Service.
   */
  @Post('bot/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @SkipThrottle()
  @ApiOperation({ summary: 'Azure Bot Framework — endpoint wiadomości' })
  async messages(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.adapter.process(req, res, async (context) => {
      await this.bot.run(context);
    });
  }
}
