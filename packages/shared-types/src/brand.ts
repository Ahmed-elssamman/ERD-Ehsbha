declare const Brand: unique symbol

export type Brand<T, B extends string> = T & { [Brand]: B }

export function brand<T, B extends string>(value: T): Brand<T, B> {
  return value as Brand<T, B>
}

export function isBrand<T, B extends string>(value: unknown, guard: (v: unknown) => v is T): value is Brand<T, B> {
  return guard(value)
}

export function unsafeBrand<T, B extends string>(value: T): Brand<T, B> {
  return value as unknown as Brand<T, B>
}
