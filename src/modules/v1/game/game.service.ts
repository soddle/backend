import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SolanaService } from '../solana/solana.service';
import { KolService } from '../kol/kol.service';
import { Game, GameDocument } from './game.model';
import { AttributeResult, KOL } from './game.type';
import { KOLDocument } from '../kol/kol.model';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private solanaService: SolanaService,
  ) {}

  async startGame(playerPublicKey: string, body: any) {
    let user = await this.userModel.findOne({ publicKey: playerPublicKey });

    if (!user) {
      user = new this.userModel({
        publicKey: playerPublicKey,
        currentGameSession: null,
      });
      await user.save();
    }

    let currentSession;
    if (user.currentGameSession) {
      currentSession = await this.gameModel.findById(user.currentGameSession);
    }
    console.log(body);
    if (
      !currentSession ||
      currentSession.completed ||
      currentSession.game1Completed ||
      currentSession.game2Completed
    ) {
      const newSession = new this.gameModel({
        player: playerPublicKey,
        gameType: body.gameType,
        startTime: new Date(),
        game1Completed: body.game1Completed || false,
        game2Completed: body.game2Completed || false,
        game1Score: 1000,
        game2Score: 1000,
        game1Guesses: body.game1Guesses || [],
        game2Guesses: body.game2Guesses || [],
        totalScore: body.totalScore || 0,
        completed: body.completed || false,
        score: body.score || 0,
        kol: body.kol || null,
        competitionId: body.competitionId || null,
        guesses: body.guesses || [],
      });
      await newSession.save();
      user.currentGameSession = newSession.id.toString();
      await user.save();
      currentSession = newSession;
    } else {
      if (body.gameType === 1) {
        currentSession.game1Completed = false;
        currentSession.game1Score = 1000;
        currentSession.game1Guesses = [];
      } else if (body.gameType === 2) {
        currentSession.game2Completed = false;
        currentSession.game2Score = 1000;
        currentSession.game2Guesses = [];
      }
      currentSession.gameType = body.gameType;
      currentSession.startTime = new Date();
      await currentSession.save();
    }

    return currentSession;
  }

  async getUserDetails(publicKey: string) {
    return this.userModel.findOne({
      publicKey,
    });
  }

  async makeGuess(gameType: number, userPublicKey: string, guess: any) {
    const user = await this.userModel.findOne({ publicKey: userPublicKey });
    if (!user || !user.currentGameSession) {
      throw new NotFoundException('User has no active game session');
    }
    const sessionId = user.currentGameSession;

    const session = await this.gameModel.findById(sessionId);
    if (!session) {
      throw new ConflictException('Invalid or completed game session');
    }
    if (
      (gameType === 1 && session.game1Completed) ||
      (gameType === 2 && session.game2Completed)
    ) {
      throw new ConflictException(
        `Game session for Game ${gameType} already completed`,
      );
    }

    const guessesField =
      gameType == 1 ? 'game1GuessesCount' : 'game2GuessesCount';

    const scoreField = gameType == 1 ? 'game1Score' : 'game2Score';
    console.log('guessesField', guessesField);
    console.log('scoreField', scoreField);
    const result = this.evaluateGuess(session.kol, guess, gameType);

    try {
      const updatedSession = await this.updateSessionWithGuess(
        sessionId,
        gameType,
        guess,
        result,
        guessesField,
        scoreField,
      );

      await this.solanaService.submitScore(
        updatedSession.player,
        gameType,
        updatedSession[scoreField],
        updatedSession[guessesField],
      );

      return updatedSession;
    } catch (error) {
      throw new HttpException(
        'Failed to update session or submit score to blockchain',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async updateSessionWithGuess(
    sessionId: string,
    gameType: number,
    guess: any,
    result: any,
    guessesField: string,
    scoreField: string,
  ) {
    const guesses = gameType == 1 ? 'game1Guesses' : 'game2Guesses';
    const completedField = gameType == 1 ? 'game1Completed' : 'game2Completed';
    console.log('guesses', guesses);
    console.log('completedField', completedField);
    const session = await this.gameModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Game session not found');
    }

    // Calculate the time penalty in points, based on the elapsed time since the game started.
    // The penalty is 10 points per second, calculated by subtracting the game start time from the current time,
    // and then multiplying by 10.
    const timePenalty = Math.floor(
      ((Date.now() - new Date(session.startTime).getTime()) / 1000) * 10,
    );
    const guessPenalty = (session[guessesField] + 1) * 50; // +1 because we're adding a new guess
    console.log(Date.now(), 'Date.now()');
    console.log(timePenalty, 'timePenalty');
    console.log(guessPenalty, 'guessPenalty');

    const isCompleted =
      gameType === 1
        ? Object.values(result as Record<string, AttributeResult>).every(
            (r) => r === AttributeResult.Correct,
          )
        : (result as { result: boolean }).result;
    console.log('isCompleted', isCompleted);
    console.log('score before calculation', session[scoreField]);
    console.log(
      Math.max(0, session[scoreField] - timePenalty - guessPenalty),
      'score',
    );
    const updatedSession = await this.gameModel.findByIdAndUpdate(
      sessionId,
      {
        $push: { [guesses]: { guess, result } },
        $inc: { [guessesField]: 1 },
        $set: {
          [scoreField]: Math.max(
            0,
            session[scoreField] - timePenalty - guessPenalty,
          ),
          [completedField]: isCompleted,
          completed:
            gameType === 1
              ? isCompleted && session.game2Completed
              : session.game1Completed && isCompleted,
          totalScore: Math.max(
            0,
            session.game1Score +
              session.game2Score -
              timePenalty -
              guessPenalty,
          ),
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedSession) {
      console.log('updated sessionid', updatedSession.id);
      console.log('error', 'Failed to update session');
    }

    return updatedSession;
  }
  getFollowerCountFromLabel(label: string): number {
    switch (label) {
      case 'over 5M':
        return 5000000;
      case '3-5M':
        return 4000000; // Assuming the midpoint of the range
      case '1-3M':
        return 2000000; // Assuming the midpoint of the range
      case '500k-1M':
        return 750000; // Assuming the midpoint of the range
      default:
        return 250000; // Assuming the midpoint of the range '0-500k'
    }
  }

  private evaluateGuess(
    actual: KOLDocument,
    guess: KOLDocument,
    gameType: number,
  ): Record<string, AttributeResult> | { kol: KOLDocument; result: boolean } {
    if (gameType === 1) {
      return {
        name:
          actual.name === guess.name
            ? AttributeResult.Correct
            : AttributeResult.Incorrect,
        age:
          actual.age === guess.age
            ? AttributeResult.Correct
            : actual.age > guess.age
              ? AttributeResult.Higher
              : AttributeResult.Lower,
        country:
          actual.country === guess.country
            ? AttributeResult.Correct
            : AttributeResult.Incorrect,
        pfpType:
          actual.pfpType === guess.pfpType
            ? AttributeResult.Correct
            : AttributeResult.Incorrect,

        account_creation:
          actual.accountCreation === guess.accountCreation
            ? AttributeResult.Correct
            : actual.accountCreation > guess.accountCreation
              ? AttributeResult.Higher
              : AttributeResult.Lower,
        followers:
          actual.followers === guess.followers
            ? AttributeResult.Correct
            : actual.followers > guess.followers
              ? AttributeResult.Higher
              : AttributeResult.Lower,
        ecosystem:
          actual.ecosystem === guess.ecosystem
            ? AttributeResult.Correct
            : AttributeResult.Incorrect,
      };
    } else if (gameType === 2) {
      return {
        kol: guess,
        result: actual.id === guess.id,
      };
    }
    throw new NotFoundException('Invalid game type');
  }

  async getCurrentGameSession(publicKey: string): Promise<GameDocument | null> {
    const user = await this.userModel.findOne({ publicKey });
    if (!user || !user.currentGameSession) {
      throw new NotFoundException('User has no active game session');
    }
    const sessionId = user.currentGameSession;
    const session = await this.gameModel.findById(sessionId);
    return session;
  }
}
