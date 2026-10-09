import { User } from '@prisma/client';

/**
 * The only shape of a user that is ever returned to a client. Password hash and
 * token version are intentionally excluded.
 */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(
  user: Pick<User, 'id' | 'email' | 'name' | 'createdAt' | 'updatedAt'>,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
