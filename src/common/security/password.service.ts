import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/**
 * Centralised password hashing. bcrypt with a cost factor of 12 is used.
 *
 * bcryptjs is a pure-JavaScript implementation of the bcrypt algorithm, chosen
 * here so the project has no native build step. The interface (hash / verify)
 * makes it trivial to swap in `argon2` or the native `bcrypt` package later.
 */
@Injectable()
export class PasswordService {
  private readonly saltRounds = 12;

  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.saltRounds);
  }

  verify(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
