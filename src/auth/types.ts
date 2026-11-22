export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: User;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
}
