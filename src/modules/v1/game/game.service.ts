import { Injectable } from '@nestjs/common';
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

    if (!currentSession || currentSession.completed) {
      const newSession = new this.gameModel({
        player: playerPublicKey,
        gameType: body.gameType,
        startTime: body.startTime,
        game1Completed: body.game1Completed || false,
        game2Completed: body.game2Completed || false,
        game1Score: body.game1Score || 0,
        game2Score: body.game2Score || 0,
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
        currentSession.game1Score = 0;
        currentSession.game1Guesses = [];
      } else if (body.gameType === 2) {
        currentSession.game2Completed = false;
        currentSession.game2Score = 0;
        currentSession.game2Guesses = [];
      }
      currentSession.gameType = body.gameType;
      currentSession.startTime = new Date();
      await currentSession.save();
    }

    return currentSession;
  }

  async makeGuess(gameType: number, userPublicKey: string, guess: any) {
    const user = await this.userModel.findOne({ publicKey: userPublicKey });
    if (!user || !user.currentGameSession) {
      throw new Error('User has no active game session');
    }
    const sessionId = user.currentGameSession;
    const session = await this.gameModel.findById(sessionId);
    if (!session || session.completed) {
      throw new Error('Invalid or completed game session');
    }

    const guessesField =
      gameType === 1 ? 'game1GuessesCount' : 'game2GuessesCount';
    const scoreField = gameType === 1 ? 'game1Score' : 'game2Score';

    const result = this.evaluateGuess(session.kol, guess, gameType);

    this.updateGuesses(session, gameType, guess, result);
    this.updateScore(session, guessesField, scoreField);
    this.updateCompletionStatus(session, gameType, result, guess);

    await session.save();

    try {
      await this.solanaService.submitScore(
        session.player,
        gameType,
        session[scoreField],
        session[guessesField],
      );
    } catch (error) {
      console.error('Failed to submit score to blockchain:', error);
    }

    return session;
  }

  private updateGuesses(
    session: GameDocument,
    gameType: number,
    guess: any,
    result: any,
  ) {
    const guessesField = gameType === 1 ? 'game1Guesses' : 'game2Guesses';
    const guessesCountField =
      gameType === 1 ? 'game1GuessesCount' : 'game2GuessesCount';

    session[guessesField].push({ guess, result });
    session[guessesCountField]++;
  }

  private updateScore(
    session: GameDocument,
    guessesField: string,
    scoreField: string,
  ) {
    const timePenalty =
      Math.floor((Date.now() - session.startTime) / 60000) * 10;
    const guessPenalty = session[guessesField] * 50;

    session[scoreField] = Math.max(
      0,
      session[scoreField] - timePenalty - guessPenalty,
    );
    session.totalScore = session.game1Score + session.game2Score;
  }

  private updateCompletionStatus(
    session: GameDocument,
    gameType: number,
    result: any,
    guess: any,
  ) {
    if (gameType === 1) {
      session.game1Completed = Object.values(
        result as Record<string, AttributeResult>,
      ).every((r) => r === AttributeResult.Correct);
    } else {
      session.game2Completed = (result as { result: boolean }).result;
    }

    session.completed = session.game1Completed && session.game2Completed;
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
        pfp:
          actual.pfp === guess.pfp
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
    throw new Error('Invalid game type');
  }

  async getCurrentGameSession(sessionId: string): Promise<GameDocument | null> {
    return this.gameModel.findById(sessionId).exec();
  }
}
