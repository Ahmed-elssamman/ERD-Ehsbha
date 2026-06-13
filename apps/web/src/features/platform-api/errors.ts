export class PlatformError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: unknown = null,
    public readonly requestId: string | null = null,
    public readonly operationId: string | null = null,
  ) {
    super(message)
    this.name = 'PlatformError'
  }
}
