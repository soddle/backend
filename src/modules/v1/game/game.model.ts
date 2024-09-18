import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {
  @Prop({ required: true })
  player: string; // Pubkey in Rust, we'll use string for MongoDB

  @Prop({ required: true })
  gameType: number;

  @Prop({ required: true, type: Date })
  startTime: Date;

  @Prop({ required: true, default: false })
  game1Completed: boolean;

  @Prop({ required: true, default: false })
  game2Completed: boolean;

  @Prop({ required: true, default: 0 })
  game1Score: number;

  @Prop({ required: true, default: 0 })
  game2Score: number;

  @Prop({
    type: [{ type: Object, required: true }],
    default: [],
  })
  game1Guesses: { guess: any; result: boolean }[];

  @Prop({ type: [], required: true, default: [] })
  game2Guesses: any[];

  @Prop({ required: true, default: 0 })
  game1GuessesCount: number;

  @Prop({ required: true, default: 0 })
  game2GuessesCount: number;

  @Prop({ required: true, default: 0 })
  totalScore: number;

  @Prop({ required: true, default: false })
  completed: boolean;

  @Prop({ required: true, default: 0 })
  score: number;

  @Prop({ type: Object, required: true })
  kol: any; // KOL in Rust, we'll use any for flexibility

  @Prop({ required: true })
  competitionId: string;
}

export const GameSchema = SchemaFactory.createForClass(Game);
