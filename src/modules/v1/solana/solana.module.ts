import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SolanaService } from './solana.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
