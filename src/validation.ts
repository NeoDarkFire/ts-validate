import { AssertionFn, ConversionFn, Conversion } from './validator'

// TODO:
// - move those helpers in appropriate files
// - `isArray` function which maps a type guard function
// - `isEnum` function which takes an enum
// - make a `Builder` class factory

// -----------------------------------------------------------------------------
// Typeof functions

type Z<T> = AssertionFn<T>
// Must be at least two types, A itself cannot be an union
export function union<A>(a: Z<A>): unknown
export function union<A, B>(a: Z<A>, b: Z<B>): Z<A | B>
export function union<A, B, C>(a: Z<A>, b: Z<B>, c: Z<C>): Z<A | B | C>
export function union<A, B, C, D>(
  a: Z<A>,
  b: Z<B>,
  c: Z<C>,
  d: Z<D>
): Z<A | B | C | D>
export function union<A, B, C, D, E>(
  a: Z<A>,
  b: Z<B>,
  c: Z<C>,
  d: Z<D>,
  e: Z<E>
): Z<A | B | C | D | E>
export function union<A, B, C, D, E, F>(
  a: Z<A>,
  b: Z<B>,
  c: Z<C>,
  d: Z<D>,
  e: Z<E>,
  f: Z<F>
): Z<A | B | C | D | E | F>
// Add more signatures here if needed
/**
 * Helper to make a logical OR out of assertion functions
 * @example
 * union(isUndefined, isNumber)(x)  // returns true when x is undefined OR a number
 */
export function union<T>(...args: Z<T>[]): Z<T> {
  return function (x: unknown): x is T {
    return args.some((f) => f(x))
  }
}

/**
 * Helper to turn a simple function to a type safe variation
 * @example convert(Number.parseInt)
 */
export function convert<T>(
  fn: (x: unknown) => T | never
): ConversionFn<T> | never {
  return function (x: unknown): Conversion<T> {
    return { isConversion: true, converted: fn(x) }
  }
}

/**
 * Assert that the first function returns true,
 * or try the other which performs a conversion
 * @example assertOrTry(isDate, x => new Date(x))
 */
export function assertOrTry<T>(
  ass: AssertionFn<T>,
  fn: (x: unknown) => T | never
): ConversionFn<T> | never {
  return function (x: unknown): Conversion<T> {
    if (ass(x)) {
      return { isConversion: true, converted: x }
    } else {
      return { isConversion: true, converted: fn(x) }
    }
  }
}

export function toInt(n: unknown): number | never {
  const x = Number.parseInt(n as string)
  if (!Number.isNaN(x)) return x
  else throw new TypeError(`Cannot convert ${n} to an Int`)
}

export function toFloat(n: unknown): number | never {
  const x = Number.parseFloat(n as string)
  if (!Number.isNaN(x)) return x
  else throw new TypeError(`Cannot convert ${n} to a Float`)
}

export function isUndefined(n: unknown): n is undefined {
  return n === undefined
}
export function isNull(n: unknown): n is null {
  return n === null
}
export function isBoolean(n: unknown): n is boolean {
  return typeof n === 'boolean'
}
export function isNumber(n: unknown): n is number {
  return typeof n === 'number'
}
export function isBigInt(n: unknown): n is bigint {
  return typeof n === 'bigint'
}
export function isString(n: unknown): n is string {
  return typeof n === 'string'
}
// eslint-disable-next-line -- We really want to type guard against object here
export function isObject(n: unknown): n is object {
  return typeof n === 'object' && n !== null
}
export function isDate(n: unknown): n is Date {
  return Object.prototype.toString.call(n) === '[object Date]'
}
