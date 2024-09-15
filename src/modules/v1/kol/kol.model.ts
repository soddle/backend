import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type KOLDocument = Kol & Document;

@Schema()
export class Kol extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  age: number;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  pfp: string;

  @Prop({ required: true })
  accountCreation: number;

  @Prop({ required: true })
  followers: number;

  @Prop({ required: true })
  ecosystem: string;

  @Prop({ type: [String], required: true })
  tweets: string[];
}

export const KolSchema = SchemaFactory.createForClass(Kol);
