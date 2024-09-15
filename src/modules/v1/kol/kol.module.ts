import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KolController } from './kol.controller';
import { KolService } from './kol.service';
import { Kol, KolSchema } from './kol.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: Kol.name, schema: KolSchema }])],
  controllers: [KolController],
  providers: [KolService],
})
export class KolModule {}
