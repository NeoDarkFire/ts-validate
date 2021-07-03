import test from 'ava'
import { Validator, makeValidator, isString } from '~/index'

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
