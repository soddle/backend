import { PipelineStage } from 'mongoose';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Mongoose } from 'mongoose';
import { SolanaService } from '../solana/solana.service';
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
      user = await this.userModel.create({
        publicKey: playerPublicKey,
        currentGameSession: null,
      });
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
        previousGuesses: [],
        competitionId: body.competitionId || null,
        guesses: body.guesses || [],
      });
      console.log(newSession);
      await newSession.save();
      user.currentGameSession = newSession.id;

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
      user.currentGameSession = currentSession._id;
      await user.save();
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
    const sessionId: mongoose.Schema.Types.ObjectId = user.currentGameSession;

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
      if (
        updatedSession.completed ||
        updatedSession.game1Completed ||
        updatedSession.game2Completed
      ) {
        await this.userModel.findByIdAndUpdate(user.id, {
          $push: { previousSessions: sessionId },
          $set: { currentGameSession: null },
        });
      }

      await this.solanaService.submitScore(
        updatedSession.player,
        gameType,
        updatedSession[scoreField],
        updatedSession[guessesField],
      );

      return updatedSession;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Failed to update session or submit score to blockchain',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async updateSessionWithGuess(
    sessionId: mongoose.Schema.Types.ObjectId,
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
      ((Date.now() - new Date(session.startTime).getTime()) / 1000) * 5,
    );

    const isCompleted =
      gameType === 1
        ? Object.values(result as Record<string, AttributeResult>).every(
            (r) => r === AttributeResult.Correct,
          )
        : (result as { result: boolean }).result;
    const guessPenalty = isCompleted
      ? session[guessesField] * 50
      : (session[guessesField] + 1) * 50; // +1 because we're adding a new guess
    console.log(guessPenalty, 'guessPenalty');
    console.log(Date.now(), 'Date.now()');
    console.log(timePenalty, 'timePenalty');

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
          [scoreField]: Math.max(0, 1000 - timePenalty - guessPenalty),
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
          mistakesCount: session.game1Guesses.length - 1,
          timeInSeconds: Math.floor(
            (Date.now() - new Date(session.startTime).getTime()) / 1000,
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

  async getLeaderboardDetails(
    leaderboardType: string,
    gameType: number,
  ): Promise<any[]> {
    console.log(
      `Starting getLeaderboardDetails with leaderboardType: ${leaderboardType}, gameType: ${gameType}`,
    );

    let startDate: Date | null = null;
    const currentDate = new Date();

    switch (leaderboardType) {
      case 'daily':
        startDate = new Date(currentDate.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(currentDate.setHours(0, 0, 0, 0));
        startDate.setDate(currentDate.getDate() - currentDate.getDay());
        break;
      case 'monthly':
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );
        break;
      case 'alltime':
        // For all-time, we don't set a start date
        break;
      default:
        console.error(`Invalid leaderboard type: ${leaderboardType}`);
        throw new Error('Invalid leaderboard type');
    }

    console.log(`Calculated startDate: ${startDate}`);

    const matchStage: PipelineStage.Match = {
      $match: {
        gameType: gameType,
        game1Completed: true,
      },
    };

    // Only add the startTime condition if it's not an all-time leaderboard
    if (startDate) {
      matchStage.$match.startTime = { $gte: startDate };
    }

    const pipeline: PipelineStage[] = [
      matchStage,
      {
        $group: {
          _id: '$player',
          totalScore: { $sum: '$game1Score' },
          gamesPlayed: { $sum: 1 },
        },
      },
      {
        $sort: { totalScore: -1 },
      },
      {
        $limit: 100,
      },
      {
        $project: {
          _id: 0,
          player: '$_id',
          totalScore: 1,
          gamesPlayed: 1,
        },
      },
    ];

    console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

    try {
      const leaderboard = await this.gameModel.aggregate(pipeline);
      console.log(`Leaderboard results count: ${leaderboard.length}`);

      if (leaderboard.length === 0) {
        console.log('Leaderboard is empty. Performing additional checks...');

        const totalDocuments = await this.gameModel.countDocuments();
        console.log(`Total documents in the collection: ${totalDocuments}`);

        const documentsMatchingGameType = await this.gameModel.countDocuments({
          gameType: gameType,
          game1Completed: true,
        });
        console.log(
          `Completed games of type ${gameType}: ${documentsMatchingGameType}`,
        );

        if (startDate) {
          const documentsInDateRange = await this.gameModel.countDocuments({
            startTime: { $gte: startDate },
            gameType: gameType,
            game1Completed: true,
          });
          console.log(
            `Documents within date range and matching criteria: ${documentsInDateRange}`,
          );
        }

        const sampleDocuments = await this.gameModel
          .find({
            gameType: gameType,
            game1Completed: true,
          })
          .limit(5)
          .lean();
        console.log(
          'Sample documents:',
          JSON.stringify(sampleDocuments, null, 2),
        );
      }

      return leaderboard;
    } catch (error) {
      console.error('Error in aggregation:', error);
      throw error;
    }
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
    const actualPfpType = console.log(actual.pfpType, 'actual.pfpType');
    console.log(guess.pfpType, 'guess.pfpType');
    console.log(
      actual.pfpType === guess.pfpType,
      'actual.pfpType===guess.pfpType',
    );
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
        pfpType: actual.pfpType.includes(guess.pfpType)
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
        ecosystem: actual.ecosystem.includes(guess.ecosystem)
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
