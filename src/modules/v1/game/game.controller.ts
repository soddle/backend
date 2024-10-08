import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  Param,
  Get,
} from '@nestjs/common';
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
      publicKey: string;
      game: any;
    },
  ) {
    return this.gameService.startGame(body.publicKey, body.game);
  }

  @Post('guess')
  async makeGuess(
    @Body() body: { gameType: number; publicKey: string; guess: any },
  ) {
    return this.gameService.makeGuess(
      body.gameType,
      body.publicKey,
      body.guess,
    );
  }
  @Post('/user')
  @ResponseMessage(RESPONSE_CONSTANT.USER.GET_USER_DETAILS_SUCCESS)
  async getUserDetails(@Body('publicKey') publicKey: string) {
    return this.gameService.getUserDetails(publicKey);
  }

  
  @Get('/leaderboard')
  @ResponseMessage(RESPONSE_CONSTANT.GAME.GET_LEADERBOARD_SUCCESS)
  async getLeaderboard(@Body() body) {
    return this.gameService.getLeaderboardDetails(body.leaderboardType, body.gameType);
  }
  
  @Get('/:publicKey')
  @ResponseMessage(RESPONSE_CONSTANT.GAME.GET_GAME_SUCCESS)
  async getGame(@Param('publicKey') publicKey: string) {
    return this.gameService.getCurrentGameSession(publicKey);
  }
}
