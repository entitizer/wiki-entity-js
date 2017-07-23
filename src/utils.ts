
import * as _ from 'lodash';
import * as Bluebird from 'bluebird';

export { Bluebird, _ }

export type PlainObject<T> = {
    [index: string]: T
}
export type AnyPlainObject = PlainObject<any>
export type StringPlainObject = PlainObject<string>
