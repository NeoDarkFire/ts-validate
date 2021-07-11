/// Error class used for model validation.
/// Capable of holding the invalid field's name
export default class ValidationError extends Error {
  constructor(msg: string, public field?: string, public value?: unknown) {
    super(msg)
    this.name = 'ValidationError'
    // Set the prototype explicitly
    Object.setPrototypeOf(this, ValidationError.prototype)
  }

  // Utility to throw a validation error
  static throw(msg: string, field?: string, value?: unknown): never {
    throw new ValidationError(msg, field, value)
  }
}
