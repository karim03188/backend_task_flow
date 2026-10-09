export interface AuthenticatedUser {
  userId: string;
  email: string;
  tokenVersion: number;
}
