import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  Program,
  AnchorProvider,
  setProvider,
  Wallet,
  Idl,
} from '@coral-xyz/anchor';
import * as IDL from './idl/soddle_game.json'; //ll need to generate this IDL from your Rust program
import { Cron, CronExpression } from '@nestjs/schedule';
import { ENVIRONMENT } from 'src/common/configs/environment';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

@Injectable()
export class SolanaService {
  private connection: Connection;
  private program: Program;
  private wallet: Wallet;

  constructor() {
    // Initialize Solana connection (use your preferred RPC URL)
    this.connection = new Connection(
      'https://staging-rpc.dev2.eclipsenetwork.xyz',
      'confirmed',
    );

    const keypair = Keypair.fromSecretKey(
      bs58.decode(ENVIRONMENT.AUTHORITY.PRIVATE_KEY),
    );
    this.wallet = new Wallet(keypair);

    // Initialize Anchor provider
    const provider = new AnchorProvider(this.connection, this.wallet, {
      preflightCommitment: 'confirmed',
    });
    setProvider(provider);

    // Initialize the program
    const idl = IDL as Idl;
    this.program = new Program(idl, provider);
  }

  @Cron('0 */24 * * *')
  async handleCron() {
    console.log('Called every day at midnight');
    const [gameStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('game_state')],
      this.program.programId,
    );

    try {
      const tx = await this.program.methods
        .initializeGame()
        .accounts({
          gameState: gameStatePDA,
          authority: this.wallet.publicKey,
          systemProgram: PublicKey.default,
        })
        .rpc();

      console.log('Game initialized. Transaction signature:', tx);
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Error initializing game:',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async submitScore(
    playerPublicKey: string,
    gameType: number,
    score: number,
    guesses: number,
  ): Promise<string> {
    const player = new PublicKey(playerPublicKey);

    type GameState = {
      currentCompetition: {
        id: string;
        startTime: number;
        endTime: number;
      };
      lastUpdateTime: number;
    };
    // Derive PDAs
    const [gameStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('game_state')],
      this.program.programId,
    );
    //@ts-expect-error  description of the error
    const gameState = await this.program.account.gameState.fetch(gameStatePDA);

    const [gameSessionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('game_session'),
        player.toBuffer(),
        Buffer.from(gameState.currentCompetition.id),
      ],
      this.program.programId,
    );
    console.log(gameSessionPDA, 'gameSessionPda');
    try {
      const tx = await this.program.methods
        .submitScore(gameType, score, guesses)
        .accounts({
          gameSession: gameSessionPDA,
          player: player,
          authority: this.wallet.publicKey, // Use the wallet's public key instead of PDA
          systemProgram: SystemProgram.programId,
        })
        .signers([this.wallet.payer]) // Add the wallet as a signer
        .rpc();

      console.log('Final score submitted. Transaction signature:', tx);
      return tx;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Error submitting final score:',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
