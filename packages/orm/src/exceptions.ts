export class ModelNotFoundException extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'ModelNotFoundException';
  }
}

export class DatabaseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseException';
  }
}
