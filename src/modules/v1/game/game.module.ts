import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { Game, GameDocument, GameSchema } from './game.model';
import { SolanaModule } from '../solana/solana.module';
import { KolModule } from '../kol/kol.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
    SolanaModule,
    KolModule,
  ],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
