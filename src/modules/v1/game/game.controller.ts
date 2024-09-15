import { Controller, Post, Body, UseInterceptors, Param, Get } from '@nestjs/common';
import { GameService } from './game.service';
import { RESPONSE_CONSTANT } from 'src/common/constants/response.constant';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { ResponseTransformerInterceptor } from 'src/common/interceptors/response.interceptor';

@UseInterceptors(ResponseTransformerInterceptor)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('start')
  @ResponseMessage(RESPONSE_CONSTANT.GAME.START_GAME_SUCCESS)
  async startGame(
    @Body()
    body: {
      playerPublicKey: string;
      game: any;
    },
  ) {
    return this.gameService.startGame(body.playerPublicKey, body.game);
  }

  @Post('guess')
  async makeGuess(@Body() body: { sessionId: string; guess: any }) {
    return this.gameService.makeGuess(body.sessionId, body.guess);
  }

  @Get('/:sessionId')
  async getGame(@Param('sessionId') sessionId: string) {
    return this.gameService.getCurrentGameSession(sessionId);
  }
}
