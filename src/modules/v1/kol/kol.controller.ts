import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { KolService } from './kol.service';
import { Kol } from './kol.model';
import { ResponseMessage } from '../../../common/decorators/response.decorator';
import { RESPONSE_CONSTANT } from '../../../common/constants/response.constant';

@Controller('kols')
export class KolController {
  constructor(private readonly kolService: KolService) {}

  private modifyData(oldData: Kol) {
    return {
      id: oldData._id,
      name: oldData.name,
      age: oldData.age,
      country: oldData.country,
      pfp: oldData.pfp,
      accountCreation: oldData.accountCreation,
      followers: oldData.followers,
      ecosystem: oldData.ecosystem,
      tweets: oldData.tweets,
    };
  }

  @Post('add')
  @ResponseMessage(RESPONSE_CONSTANT.KOL.ADD_KOLS_SUCCESS)
  async addKOLsToDB() {
    return await this.kolService.addKOLsToDB();
  }

  @Get()
  @ResponseMessage(RESPONSE_CONSTANT.KOL.GET_ALL_KOLS_SUCCESS)
  async getAllKols() {
    const newKols = await this.kolService.findAll();
    return newKols.map((kol) => this.modifyData(kol));
  }

  @Get('random')
  @ResponseMessage(RESPONSE_CONSTANT.KOL.GET_RANDOM_KOL_SUCCESS)
  async getRandomKol() {
    const kol = await this.kolService.getRandomKol();
    return this.modifyData(kol);
  }

  @Get('tweet')
  @ResponseMessage(RESPONSE_CONSTANT.KOL.GET_RANDOM_TWEET_SUCCESS)
  async getRandomTweet(@Body('kolId') kolId: string) {
    if (!kolId) {
      throw new HttpException('Please provide a kolId', HttpStatus.BAD_REQUEST);
    }
    const { kol, tweet } = await this.kolService.getRandomTweet(kolId);
    return {
      kol: this.modifyData(kol),
      tweet: tweet,
    };
  }
}
