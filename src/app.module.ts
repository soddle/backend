import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KolModule } from './modules/v1/kol/kol.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ENVIRONMENT } from './common/configs/environment';
import { GameModule } from './modules/v1/game/game.module';

@Module({
  imports: [MongooseModule.forRoot(ENVIRONMENT.DB.URL), KolModule, GameModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
