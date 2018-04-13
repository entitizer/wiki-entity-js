
export type PlainObject<T> = {
    [index: string]: T
}
export type AnyPlainObject = PlainObject<any>
export type StringPlainObject = PlainObject<string>

export function eachSeries<T>(arr: any[], iteratorFn: (item: any) => Promise<T>) {
    return arr.reduce((p, item) => p.then(() => iteratorFn(item)), Promise.resolve());
}

export function uniq<T>(items: T[]) {
    return items.filter((value, index, self) => self.indexOf(value) === index);
}

export function isValidWikiId(id: string) {
    return /^Q\d+$/.test(id);
}
