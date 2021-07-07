// -----------------------------------------------------------------------------
// Helpers

type Keys<T> = (keyof T)[] & Iterable<keyof T>
/// Like Object.keys but with better type constraints
function _keys<T>(obj: T): Keys<T> {
  return Object.keys(obj) as Keys<T>
}

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

// Internal
function isConversion(n: unknown): n is Conversion<unknown> {
  return (
    typeof n === 'object' && (n as Conversion<unknown>).isConversion === true
  )
}

// -----------------------------------------------------------------------------
// Validator types and helper functions

// eslint-disable-next-line -- No way around using this any
type NoInfer<T> = [T][T extends any ? 0 : never]

export type Conversion<T> = { isConversion: true; converted: T }
export type ConversionFn<T> = (
  field: unknown | unknown[]
) => Conversion<T> | never
export type AssertionFn<T> = (field: unknown | unknown[]) => field is T | never
type ValidationResult<T = boolean> = T | Promise<T> | never
type ValidationFn<T> = (field: T) => ValidationResult
export type Validations<T> = {
  [K in keyof T]: [
    AssertionFn<T[K]> | ConversionFn<T[K]>,
    ...Array<ValidationFn<T[K]>>
  ]
}
type ToValidate = { [key: string]: unknown }

/// Error class used for model validation.
/// Capable of holding the invalid field's name
export class ValidationError extends Error {
  constructor(msg: string, public field?: string) {
    super(msg)
    // Set the prototype explicitly
    Object.setPrototypeOf(this, ValidationError.prototype)
  }

  // Utility to throw a validation error
  static throw(msg: string, field?: string): never {
    throw new ValidationError(msg, field)
  }
}

function _pushError<E extends Error>(
  err: E | ValidationError,
  field: string,
  errors: Error[]
) {
  if (err instanceof ValidationError) {
    err.field = field
    errors.push(err)
  } else if (err instanceof AggregateError) {
    errors.push(err)
  } else {
    try {
      const msg = `Validation failed for [${field}]`
      ValidationError.throw(msg, field)
    } catch (verr) {
      errors.push(verr)
    }
  }
}

function _errorFields<E extends Error>(err: E): string {
  let ret: string | undefined = undefined
  if (err instanceof ValidationError) {
    ret = (err as ValidationError).field
  } else if (err instanceof AggregateError) {
    ret = '(' + (err as AggregateError).errors.map(_errorFields).join(',') + ')'
  }
  return ret || '???'
}

function _cast<T>(obj: unknown, errors: Error[]): T | never {
  if (errors.length === 1) {
    // Throw a single error
    throw errors[0]
  } else if (errors.length > 1) {
    // Throw every validation errors at once
    const fields = errors.map(_errorFields).join(', ')
    throw new AggregateError(errors, `Validation failed for [${fields}]`)
  } else {
    // Return the type safely casted
    return obj as unknown as T
  }
}

type Action = (obj: unknown) => unknown
/// Call `fn` for each obj in `objs`, catching errors and throwing them
/// all at the end (if any).
function _aggregateErrors(objs: unknown[], fn: Action): void | never {
  if (objs === undefined || objs === null) {
    throw null
  }
  const errors: Error[] = []
  try {
    objs.forEach(fn)
  } catch (err) {
    errors.push(err)
  }
  if (errors.length > 0) {
    throw new AggregateError(errors)
  }
}

// -----------------------------------------------------------------------------
// The main class of this file

/**
 * Validator class.
 *
 * Uses a validation object to validate object of a desired type T.
 */
export class Validator<T = void> {
  private readonly validations: Validations<T>

  /**
   * Construct a new Validator by specifying a type
   * along with the validation object for that type.
   */
  constructor(validations: NoInfer<Validations<T>>) {
    this.validations = validations
  }

  // -------------------------------------------------------------------------
  // Synchronous methods

  // Same as validateAsync, but ignores Promises
  validate(obj: unknown): T | never {
    if (typeof obj !== 'object' || obj === null) {
      ValidationError.throw('Not an object or null')
    }
    const _obj = obj as ToValidate // Cast here
    const errors: Error[] = []
    for (const field of _keys(this.validations)) {
      try {
        const converted = this._validateFieldRaw(field, _obj)
        if (converted !== undefined) _obj[field as string] = converted
      } catch (err) {
        _pushError(err, field as string, errors)
      }
    }
    return _cast(obj, errors)
  }

  validateField<F extends keyof T & string>(
    field: F,
    obj: unknown
  ): T[F] | never {
    if (typeof obj !== 'object' || obj === null) {
      ValidationError.throw(`Field '${field}' is not an object or null`)
    }
    const _obj = obj as ToValidate // Cast here
    const errors: Error[] = []
    try {
      const converted = this._validateFieldRaw(field, _obj)
      if (converted !== undefined) _obj[field] = converted
    } catch (err) {
      _pushError(err, field as string, errors)
    }
    return _cast<T>(obj, errors)[field]
  }

  _validateFieldRaw<F extends keyof T>(
    field: F,
    obj: ToValidate
  ): T[F] | undefined | never {
    const fns = this.validations[field]
    let x = obj[field as string] as T[F]
    let converted: T[F] | undefined
    for (const fn of fns) {
      const res = (fn as ValidationFn<T[F]> | ConversionFn<T[F]>)(x)
      if (res instanceof Promise || res === true) {
        // Do nothing
      } else if (isConversion(res)) {
        x = res.converted
        converted = x
      } else {
        throw null
      }
    }
    return converted
  }

  validateEvery(objs: unknown): T[] | never {
    if (!Array.isArray(objs)) throw new TypeError('Must be an array')
    return objs.map((obj) => this.validate(obj)) as T[]
  }

  match(obj: unknown): obj is T {
    try {
      if (typeof obj !== 'object' || obj === null) return false
      else return !!this.validate(obj)
    } catch {
      return false
    }
  }

  matchOrFail(obj: unknown): obj is T | never {
    this.validate(obj)
    return true
  }

  matchEvery(objs: unknown[]): objs is T[] {
    return objs.every((obj) => this.match(obj))
  }

  matchEveryOrFail(objs: unknown[]): objs is T[] | never {
    _aggregateErrors(objs, (obj) => this.validate(obj))
    return true
  }

  // -------------------------------------------------------------------------
  // Asynchronous methods

  async validateAsync(obj: unknown): Promise<T> {
    if (typeof obj !== 'object' || obj === null) {
      ValidationError.throw('Not an object or null')
    }
    const _obj = obj as ToValidate // Cast here
    const errors: ValidationError[] = []
    // Check the fields in parrallel, not sequentially (they're independant)
    const promises = _keys(this.validations).map(async (field) => {
      try {
        const converted = await this._validateFieldRawAsync(field, _obj)
        if (converted !== undefined) _obj[field as string] = converted
      } catch (err) {
        _pushError(err, field as string, errors)
      }
    })
    await Promise.all(promises)

    return _cast(obj, errors)
  }

  async validateFieldAsync<F extends keyof T & string>(
    field: F,
    obj: unknown
  ): Promise<T[F]> {
    if (typeof obj !== 'object' || obj === null) {
      ValidationError.throw(`Field '${field}' is not an object or null`)
    }
    const _obj = obj as ToValidate // Cast here
    const errors: Error[] = []
    try {
      const converted = await this._validateFieldRawAsync(field, _obj)
      if (converted !== undefined) _obj[field] = converted
    } catch (err) {
      _pushError(err, field as string, errors)
    }
    return _cast<T>(obj, errors)[field]
  }

  async _validateFieldRawAsync<F extends keyof T>(
    field: F,
    obj: ToValidate
  ): Promise<T[F] | undefined> {
    const fns = this.validations[field]
    let x = obj[field as string] as T[F]
    let converted: T[F] | undefined
    // Check the fields sequentially to keep assertions in order
    for (const fn of fns) {
      let res = (fn as ValidationFn<T[F]> | ConversionFn<T[F]>)(x)
      res = res instanceof Promise ? await res : res
      if (res === true) {
        // Do nothing
      } else if (isConversion(res)) {
        x = res.converted
        converted = x
      } else {
        throw null
      }
    }
    return converted
  }

  async validateEveryAsync(objs: unknown): Promise<T[]> {
    if (!Array.isArray(objs)) throw new TypeError('Must be an array')
    return (await Promise.all(
      objs.map(async (obj) => await this.validateAsync(obj))
    )) as T[]
  }

  async matchAsync(obj: unknown): Promise<boolean> {
    try {
      if (typeof obj !== 'object' || obj === null) return false
      else return !!(await this.validateAsync(obj))
    } catch {
      return false
    }
  }

  async matchOrFailAsync(obj: unknown): Promise<boolean> {
    await this.validateAsync(obj)
    return true
  }

  async matchEveryAsync(objs: unknown[]): Promise<boolean> {
    const promises = objs.map((obj) => this.matchAsync(obj))
    const all = await Promise.all(promises)
    return all.every((res) => res === true)
  }

  async matchEveryOrFailAsync(objs: unknown[]): Promise<boolean> {
    const promises = objs.map((obj) => this.validateAsync(obj))
    await Promise.all(promises)
    return true
  }
}
