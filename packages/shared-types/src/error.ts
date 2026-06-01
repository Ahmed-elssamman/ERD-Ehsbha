export interface ApiErrorShape<TCode extends string = string> {
  code: TCode;
  message: string;
  details?: unknown;
}
