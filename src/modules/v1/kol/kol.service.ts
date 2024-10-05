import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Kol, KOLDocument } from './kol.model';
import { dailyKols } from 'src/common/utils/kols';

@Injectable()
export class KolService {
  constructor(@InjectModel(Kol.name) private kolModel: Model<KOLDocument>) {}

  async addKOLsToDB() {
    // const newKols = [/* array of new KOL data */];
    await this.kolModel.deleteMany({});
    return await this.kolModel.insertMany(dailyKols);
  }

  modifyData(oldData) {
    return {
      ...oldData,
      ageDisplay: `${Math.floor(oldData.age / 10) * 10 + 1}-${Math.floor(oldData.age / 10) * 10 + 10}`,
      pfpType:
        oldData.pfpType === 'both' ? 'Artificial-Human' : oldData.pfpType,
      followersDisplay: this.getFollowerRangeLabel(oldData.followers),
    };
  }
  getFollowerRangeLabel(followersCount: number): string {
    if (followersCount >= 5000000) return 'over 5M';
    if (followersCount >= 3000000 && followersCount <= 5000000) return '3-5M';
    if (followersCount >= 1000000 && followersCount < 3000000) return '1-3M';
    if (followersCount >= 500000 && followersCount < 1000000) return '500k-1M';
    return '0-500k';
  }

  async findAll(): Promise<any[]> {
    const newKols = await this.kolModel.find({});
    const kols = newKols.map((kol) => this.modifyData(kol.toJSON()));
    return kols;
  }

  async getRandomKol(): Promise<Partial<Kol>> {
    const aggregation = [{ $sample: { size: 1 } }];
    const [randomKol] = await this.kolModel.aggregate(aggregation);
    return this.modifyData(randomKol);
  }

  async getRandomTweet(
    kolId: string,
  ): Promise<{ kol: Partial<Kol>; tweet: string }> {
    if (!kolId) {
      throw new HttpException('Please provide a kolId', HttpStatus.BAD_REQUEST);
    }
    const kol = await this.kolModel.findById(kolId);
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
    return { kol: this.modifyData(kol), tweet: randomTweet };
  }
}
