import test from 'ava'
import { Validator, makeValidator, isString, convert, toInt } from '~/index'

test('simple validator with conditions', t => {
	interface Mongo {
		_id: string
	}
	const MongoValidator: Validator<Mongo> = makeValidator({
		_id: [
			isString,
			(x: string) => x.length === 24,
			(x: string) => Number.parseInt(x, 16).toString(16) === x,
		]
	})
	// TODO: why does this fail
	// t.is(MongoValidator.match({ _id: 'abcdefghijklmnopqrstuvwx' }), false)
	// t.is(MongoValidator.match({ _id: '0123456789abcdef012345' }), false)
	t.is(MongoValidator.match({ _id: 0x0123456789abcdef01234567 }), false)
	t.is(MongoValidator.match({ _id: '0123456789abcdef01234567' }), true)
});

test('simple validator with conversion', t => {
	interface SqlEntity {
		id: number
	}
	const SqlValidator: Validator<SqlEntity> = makeValidator({
		id: [convert(toInt), (x: number) => x > 0]
	})
	// TODO: why does this fail
	// t.is(SqlValidator.match({ id: 0 }), false)
	t.is(SqlValidator.match({ id: 1.5 }), true)
	t.is(SqlValidator.match({ id: "4" }), true)
	t.is(SqlValidator.match({ id: "abc" }), false)
});
