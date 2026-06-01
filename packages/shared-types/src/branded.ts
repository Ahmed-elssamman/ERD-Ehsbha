declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type Piastres = Brand<number, 'Piastres'>;
export type Meters = Brand<number, 'Meters'>;
export type Cuid = Brand<string, 'Cuid'>;
export type IsoDate = Brand<string, 'IsoDate'>;
export type IsoDateTime = Brand<string, 'IsoDateTime'>;
export type E164Phone = Brand<string, 'E164Phone'>;

export const asPiastres = (n: number): Piastres => n as Piastres;
export const asMeters = (n: number): Meters => n as Meters;
export const asCuid = (s: string): Cuid => s as Cuid;
