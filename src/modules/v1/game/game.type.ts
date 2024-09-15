export enum AttributeResult {
  Correct = 'Correct',
  Incorrect = 'Incorrect',
  Higher = 'Higher',
  Lower = 'Lower',
}

export interface KOL {
  name: string;
  age: number;
  country: string;
  pfp: string;
  account_creation: number;
  followers: number;
  ecosystem: string;
}
