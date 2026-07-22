export class EvolutionException extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'EvolutionException';
  }
}
