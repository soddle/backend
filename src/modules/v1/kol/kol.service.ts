import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Kol, KOLDocument } from './kol.model';

@Injectable()
export class KolService {
  constructor(@InjectModel(Kol.name) private kolModel: Model<KOLDocument>) {}

  async addKOLsToDB() {
    // const newKols = [/* array of new KOL data */];
    // return await this.kolModel.insertMany(newKols);
    return 'KOLs added to the database';
  }

  async findAll(): Promise<Kol[]> {
    return await this.kolModel.find().exec();
  }

  async getRandomKol(): Promise<Kol> {
    const aggregation = [{ $sample: { size: 1 } }];
    const [randomKol] = await this.kolModel.aggregate(aggregation);
    return randomKol;
  }

  async getRandomTweet(kolId: string): Promise<{ kol: Kol; tweet: string }> {
    if (!kolId) {
      throw new HttpException('Please provide a kolId', HttpStatus.BAD_REQUEST);
    }
    const kol = await this.kolModel.findById(kolId).exec();
    if (!kol) {
      throw new HttpException('KOL not found', HttpStatus.NOT_FOUND);
    }
    if (!kol.tweets || kol.tweets.length === 0) {
      throw new HttpException(
        'No tweets found for this KOL',
        HttpStatus.NOT_FOUND,
      );
    }
    const randomTweet =
      kol.tweets[Math.floor(Math.random() * kol.tweets.length)];
    return { kol, tweet: randomTweet };
  }
}
