import { Role } from '@prisma/client';

/** Access-token payload. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

/** Refresh-token payload — signed with a separate secret. */
export interface RefreshPayload {
  sub: string;
  tokenType: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: {
    id: string;
    documentId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
  };
}
