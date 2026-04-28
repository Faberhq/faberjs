export class ViewNotFoundException extends Error {
  constructor(
    readonly viewName: string,
    readonly attemptedPath: string,
  ) {
    super(`View not found: "${viewName}" (looked for: ${attemptedPath})`);
    this.name = 'ViewNotFoundException';
  }
}
