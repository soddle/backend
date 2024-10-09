import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { Cron } from '@nestjs/schedule';
import { ENVIRONMENT } from 'src/common/configs/environment';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

@Injectable()
export class SolanaService {
  private connection: Connection;
  private program: Program;
  private wallet: Wallet;
  private gameStatePDA: PublicKey;
  private gameState: any;

  constructor() {
    // Initialize Solana connection (use your preferred RPC URL)
    this.connection = new Connection(
      `https://devnet.helius-rpc.com/?api-key=${ENVIRONMENT.RPC.SOLANA.URL}`,
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

    // Derive PDAs
    this.gameStatePDA = PublicKey.findProgramAddressSync(
      [Buffer.from('game_state')],
      this.program.programId,
    )[0];
    //@ts-expect-error  description of the error
    this.program.account.gameState
      .fetch(this.gameStatePDA)
      .then((gameState) => {
        this.gameState = gameState;
      })
      .catch((error) => {
        console.error('Error fetching game state:', error);
      });
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

    const [gameSessionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('game_session'),
        player.toBuffer(),
        Buffer.from(this.gameState.currentCompetition.id),
      ],
      this.program.programId,
    );
    console.log(gameSessionPDA)
    // @ts-ignore
    const gameSession = this.program.account.gameSession.fetch(gameSessionPDA);
    console.log(gameSession)
    console.log(gameType, score, guesses);
    console.log(
      gameSessionPDA.toBase58,
      player.toBase58,
      this.wallet.publicKey,
    );
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
