import { Injectable, OnModuleInit } from '@nestjs/common';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import {
  Program,
  AnchorProvider,
  setProvider,
  Wallet,
  Idl,
} from '@coral-xyz/anchor';
import * as IDL from './idl/soddle_game.json'; //ll need to generate this IDL from your Rust program
import { Cron, CronExpression } from '@nestjs/schedule';

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

    // Initialize wallet (in production, you'd use a more secure way to manage keys)
    const keypair = Keypair.generate();
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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async initializeGame() {
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
      console.error('Error initializing game:', error);
    }
  }

  async submitScore(
    playerPublicKey: string,
    score: number,
    guesses: number,
  ): Promise<string> {
    const player = new PublicKey(playerPublicKey);

    // Derive PDAs
    const [gameSessionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('game_session'), player.toBuffer()],
      this.program.programId,
    );
    const [authorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      this.program.programId,
    );

    try {
      const tx = await this.program.methods
        .submitScore(score, guesses)
        .accounts({
          gameSession: gameSessionPDA,
          player: player,
          authority: authorityPDA,
        })
        .rpc();

      console.log('Final score submitted. Transaction signature:', tx);
      return tx;
    } catch (error) {
      console.error('Error submitting final score:', error);
      throw error;
    }
  }
}
