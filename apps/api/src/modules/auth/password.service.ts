import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

/** Coût bcrypt du cahier des charges : ~250 ms par hachage, assez lent pour freiner la force brute. */
export const BCRYPT_COST = 12;

/**
 * Hash factice comparé quand l'email est inconnu : la réponse prend le même temps
 * qu'un mauvais mot de passe, ce qui empêche de deviner quels emails sont inscrits.
 */
const DUMMY_HASH = bcrypt.hashSync('devmirror-timing-equalizer', BCRYPT_COST);

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  verify(password: string, hash: string | null | undefined): Promise<boolean> {
    return bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && hash != null);
  }
}
