import test from 'ava'
import { Validator, isString, convert, toInt } from '~/index'

test('MongoDB ObjectID validator (string)', t => {
	interface Mongo {
		_id: string
	}
	const MongoValidator = new Validator<Mongo>({
		_id: [
			isString,
			(x: string) => x.match(/^[0-9a-f]{24}$/i) !== null,
		]
	})
	t.is(MongoValidator.match({ _id: 'abcdefghijklmnopqrstuvwx' }), false)
	t.is(MongoValidator.match({ _id: '0123456789abcdef' }), false)
	t.is(MongoValidator.match({ _id: 0x0123456789abcdef01234567 }), false)
	t.is(MongoValidator.match({ _id: '0123456789abcdef0123456789ab' }), false)
	t.is(MongoValidator.match({ _id: '0123456789abcdef01234567' }), true)
	t.is(MongoValidator.match({ _id: '0123456789ABCDEF01234567' }), true)
});

test('SQL numeric ID validator', t => {
	interface SqlEntity {
		id: number
	}
	const SqlValidator = new Validator<SqlEntity>({
		id: [convert(toInt), (x: number) => x > 0]
	})
	t.is(SqlValidator.match({ id: 0 }), false)
	t.is(SqlValidator.match({ id: 1.5 }), true)
	t.is(SqlValidator.match({ id: "4" }), true)
	t.is(SqlValidator.match({ id: "abc" }), false)
});

test('Complex conversion', t => {
	interface Test {
		bytes: { MSB: number, LSB: number }
	}
	const TestValidator = new Validator<Test>({
		bytes: [
			convert((x) => {
				const int = toInt(x)
				return {
					MSB: (int >> 8) & 0xFF,
					LSB: int & 0xFF
				}
			}),
		]
	})
	t.like(TestValidator.validate({ bytes: 0xAABB }), {bytes: {MSB: 0xAA, LSB: 0xBB}})
});

test('Forbidden syntax that should never compile', t => {
	() => {
		// @ts-expect-error - the type must always be specified
		new Validator({})
	}
	t.pass()
});
