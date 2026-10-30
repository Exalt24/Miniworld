export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, 'not_found', `${what} not found`);
export const forbidden = (message: string) => new AppError(403, 'forbidden', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
