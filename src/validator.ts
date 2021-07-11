import ValidationError from './validation-error'

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
    _assertNonNullObject(obj)

    const _obj = obj as ToValidate // Cast here
    const errors: Error[] = []
    for (const field of _keys(this.validations)) {
      try {
        const converted = this._validateFieldRaw(field, _obj)
        if (converted !== undefined) _obj[field] = converted
      } catch (err) {
        _pushError(err, field, _obj[field], errors)
      }
    }
    return _cast(obj, errors)
  }

  validateField<F extends keyof T & string>(
    field: F,
    obj: unknown
  ): T[F] | never {
    _assertNonNullObject(obj)

    const _obj = obj as ToValidate // Cast here
    const errors: Error[] = []
    try {
      const converted = this._validateFieldRaw(field, _obj)
      if (converted !== undefined) _obj[field] = converted
    } catch (err) {
      _pushError(err, field, _obj[field], errors)
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
      } else if (_isConversion(res)) {
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
    _assertNonNullObject(obj)

    const _obj = obj as ToValidate // Cast here
    const errors: ValidationError[] = []
    // Check the fields in parrallel, not sequentially (they're independant)
    const promises = _keys(this.validations).map(async (field) => {
      try {
        const converted = await this._validateFieldRawAsync(field, _obj)
        if (converted !== undefined) _obj[field] = converted
      } catch (err) {
        _pushError(err, field, _obj[field], errors)
      }
    })
    await Promise.all(promises)

    return _cast(obj, errors)
  }

  async validateFieldAsync<F extends keyof T & string>(
    field: F,
    obj: unknown
  ): Promise<T[F]> {
    _assertNonNullObject(obj)

    const _obj = obj as ToValidate // Cast here
    const errors: Error[] = []
    try {
      const converted = await this._validateFieldRawAsync(field, _obj)
      if (converted !== undefined) _obj[field] = converted
    } catch (err) {
      _pushError(err, field, _obj[field], errors)
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
      } else if (_isConversion(res)) {
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

// -----------------------------------------------------------------------------
// Types used by Validator

export type Conversion<T> = { isConversion: true; converted: T }
export type ConversionFn<T> = (
  field: unknown | unknown[]
) => Conversion<T> | never

export type AssertionFn<T> = (field: unknown | unknown[]) => field is T | never

export type ValidationResult<T = boolean> = T | Promise<T> | never
export type ValidationFn<T> = (field: T) => ValidationResult

export type Validations<T> = {
  [K in keyof T]: [
    AssertionFn<T[K]> | ConversionFn<T[K]>,
    ...Array<ValidationFn<T[K]>>
  ]
}

// eslint-disable-next-line -- No way around using this any
type NoInfer<T> = [T][T extends any ? 0 : never]
type ToValidate = { [key: string]: unknown }

// -----------------------------------------------------------------------------
// Helper functions

// Internal only
function _isConversion(n: unknown): n is Conversion<unknown> {
  return (
    typeof n === 'object' && (n as Conversion<unknown>).isConversion === true
  )
}

type Keys<T> = (keyof T & string)[] & Iterable<keyof T & string>
/// Like Object.keys but with better type constraints
function _keys<T>(obj: T): Keys<T> {
  return Object.keys(obj) as Keys<T>
}

// -----------------------------------------------------------------------------
// Error handling

function _assertNonNullObject(obj: unknown): void | never {
  if (obj === null) {
    throw new TypeError('Unexpected null')
  } else if (Array.isArray(obj)) {
    throw new TypeError('Cannot be an array')
  } else if (typeof obj !== 'object') {
    throw new TypeError('Not an object')
  }
}

function _renameChildFields<E extends Error>(
  field: string
): (err: E | ValidationError) => void {
  return (err) => {
    if (err instanceof ValidationError) {
      err.field = `${field}.${err.field}`
      err.message = err.message.replace(/".+":/, `"${err.field}":`)
    } else if (err instanceof AggregateError) {
      err.errors.forEach(_renameChildFields(field))
    }
  }
}

function _pushError<E extends Error>(
  err: E | ValidationError,
  field: string,
  value: unknown,
  errors: Error[]
) {
  if (err instanceof ValidationError) {
    err.field = field
    errors.push(err)
  } else if (err instanceof AggregateError) {
    err.errors.forEach(_renameChildFields(field))
    errors.push(err)
  } else {
    const trimmedValue = `${value}`.substring(0, 40)
    const details = err?.message?.length ? ` (${err.message})` : ''
    const msg = `Validation failed for "${field}": ${trimmedValue}${details}`
    errors.push(new ValidationError(msg, field, value))
  }
}

function _setAggregateMessage(err: AggregateError, first: boolean): typeof err {
  const msg = err.errors
    .map((err) => {
      if (err instanceof AggregateError) {
        return _setAggregateMessage(err, false).message
      } else {
        return err.message
      }
    })
    .join('\n- ')
  err.message = (first ? 'Multiple errors occured:\n- ' : '') + msg
  return err
}

function _cast<T>(obj: unknown, errors: Error[]): T | never {
  if (errors.length === 1) {
    // Throw a single error
    throw errors[0]
  } else if (errors.length > 1) {
    // Throw every validation errors at once
    throw _setAggregateMessage(new AggregateError(errors), true)
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
