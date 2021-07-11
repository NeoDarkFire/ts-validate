import test from 'ava'
import {
  Validator,
  isString,
  convert,
  toInt,
  isNumber,
  isUndefined,
  union,
} from '~/index'
import { ListValidator } from '@/list'

test('MongoDB ObjectID validator (string)', (t) => {
  interface Mongo {
    _id: string
  }
  const MongoValidator = new Validator<Mongo>({
    _id: [isString, (x) => x.match(/^[0-9a-f]{24}$/i) !== null],
  })
  t.is(MongoValidator.match({ _id: 'abcdefghijklmnopqrstuvwx' }), false)
  t.is(MongoValidator.match({ _id: '0123456789abcdef' }), false)
  t.is(MongoValidator.match({ _id: 0x0123456789abcdef01234567 }), false)
  t.is(MongoValidator.match({ _id: '0123456789abcdef0123456789ab' }), false)
  t.is(MongoValidator.match({ _id: '0123456789abcdef01234567' }), true)
  t.is(MongoValidator.match({ _id: '0123456789ABCDEF01234567' }), true)
})

test('SQL numeric ID validator', (t) => {
  interface SqlEntity {
    id: number
  }
  const SqlValidator = new Validator<SqlEntity>({
    // id: [convert(toInt), (x: number) => x > 0]
    id: [convert(toInt), (x) => x > 0],
  })
  t.is(SqlValidator.match({ id: 0 }), false)
  t.is(SqlValidator.match({ id: 1.5 }), true)
  t.is(SqlValidator.match({ id: '4' }), true)
  t.is(SqlValidator.match({ id: 'abc' }), false)
})

test('Complex conversion', (t) => {
  interface Test {
    bytes: { MSB: number; LSB: number }
  }
  const TestValidator = new Validator<Test>({
    bytes: [
      convert((x) => {
        const int = toInt(x)
        return {
          MSB: (int >> 8) & 0xff,
          LSB: int & 0xff,
        }
      }),
    ],
  })
  t.like(TestValidator.validate({ bytes: 0xaabb }), {
    bytes: { MSB: 0xaa, LSB: 0xbb },
  })
})
test('Optional fields', (t) => {
  interface Optional<T> {
    value?: T
  }
  const OptionalValidator = new Validator<Optional<number>>({
    value: [union(isUndefined, isNumber)],
  })
  t.is(OptionalValidator.match({ value: '4' }), false)
  t.is(OptionalValidator.match({ value: 4 }), true)
  t.is(OptionalValidator.match({ value: undefined }), true)
})

test('Recursive validation', (t) => {
  t.is(ListValidator.match({ head: '4' }), false)
  t.is(ListValidator.match({ head: 4 }), true)
  t.is(ListValidator.match({ head: 4, tail: { head: '4' } }), false)
  t.is(ListValidator.match({ head: 4, tail: { head: 4 } }), true)
})

test('Error messages', (t) => {
  const err = t.throws(() =>
    ListValidator.validate({
      head: '1',
      tail: { head: '2', tail: { head: '3', tail: null } },
    })
  )
  if (err instanceof AggregateError) {
    const header = 'Multiple errors occured'
    // Should only have one header
    const match = err.message.match(new RegExp(`${header}`, 'g'))
    t.is(match?.length ?? 0, 1)
    // Should show all errors
    t.regex(err.message, /"head": 1/)
    t.regex(err.message, /"tail.head": 2/)
    t.regex(err.message, /"tail.tail.head": 3/)
    t.regex(err.message, /"tail.tail.tail": null \(Unexpected null\)/)
    // Should not show more errors
    t.is(err.message.match(/\n/g)?.length ?? 0, 4)
  } else {
    t.fail('The error should be an AggregateError')
  }
})

test('Forbidden syntax that should never compile', (t) => {
  ;() => {
    // @ts-expect-error - the type must always be specified
    new Validator({})
  }
  t.pass()
})
