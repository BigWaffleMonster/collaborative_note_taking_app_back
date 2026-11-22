export type AuthErrorStatus = 400 | 401 | 409;

export class AuthError extends Error {
  constructor(
    public readonly status: AuthErrorStatus,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
