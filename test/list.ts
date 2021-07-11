import { Validator, isNumber, isUndefined, union } from '~/index'

export interface List<T> {
  head: T
  tail?: List<T>
}
export const ListValidator = new Validator<List<number>>({
  head: [isNumber],
  tail: [union(isUndefined, isList)],
})
export function isList<T = never>(x: unknown): x is List<T> {
  return ListValidator.matchOrFail(x)
}
