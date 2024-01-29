import { IndexKeyRange } from "./dbDeclarations"
import { dbPromise } from "./utils"

interface CursorProvider {
    openKeyCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursor | null>
    openCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursorWithValue | null>
}

interface CursorValue1<T extends IDBValidKey, K extends IDBValidKey> {
    key: T
    primaryKey: K

}

interface CursorValue2<V, T extends IDBValidKey, K extends IDBValidKey> extends CursorValue1<T, K> {
    value: V
    delete(): Promise<void>
    update(newValue: V): Promise<T>
}

export interface CursorIterationOption<IK, PK> {
    from?: {
        key?: IK
        primaryKey?: PK
    }
    limit?: number
    offset?: number
    query?: IndexKeyRange<IK>
    direction?: IDBCursorDirection
}

export class CursorIterator<T, IK extends IDBValidKey, PK extends IDBValidKey> {

    _cursorProvider: CursorProvider

    constructor(cursorProvider: CursorProvider) {
        this._cursorProvider = cursorProvider
    }

    _iterateCursor<C extends IDBCursor>(
        cursorRequester: () => IDBRequest<C | null>,
        action: (cursor: C) => Promise<void>,
        options?: CursorIterationOption<IK, PK>
    ): Promise<void> {
        if (options?.offset && options.offset < 1) {
            throw Error("offset must be greater than 0")
        }
        if (options?.limit && options.limit < 1) {
            throw Error("limit must be greater than 0")
        }
        return new Promise((resolve, reject) => {
            let offsetNotApplied = Boolean(options?.offset)
            let fromIndexNotApplied = Boolean(options?.from?.key)
            let curCount = 0

            const rq = cursorRequester()
            rq.onsuccess = () => {
                const cursor = rq.result
                if (cursor) {
                    if (fromIndexNotApplied) {
                        if (options?.from?.primaryKey) {
                            cursor.continuePrimaryKey(options.from.key!, options.from.primaryKey)
                        } else {
                            cursor.continue(options?.from?.key)
                        }
                        fromIndexNotApplied = false
                        return
                    }

                    if (offsetNotApplied) {
                        cursor.advance(options!.offset! - 1)
                        offsetNotApplied = false
                        return
                    }

                    curCount++
                    action(cursor).then(() => {
                        cursor.continue()
                    })

                    if (options?.limit && curCount >= options.limit) {
                        resolve()
                    }
                } else {
                    resolve()
                }
            }
            rq.onerror = () => {
                reject(rq.error)
            }
        })

    }

    iterateKeys(
        action: (v: CursorValue1<IK, PK>) => Promise<void>,
        options?: CursorIterationOption<IK, PK>,
    ): Promise<void> {
        return this._iterateCursor(
            () => this._cursorProvider.openKeyCursor(options?.query, options?.direction),
            async (cursor) => {
                await action({
                    key: cursor.key as IK,
                    primaryKey: cursor.primaryKey as PK
                })
            },
            options
        )
    }
    
    iterateValues(
        action: (v: CursorValue2<T, IK, PK>) => Promise<void>,
        options?: CursorIterationOption<IK, PK>,
    ) {
        return this._iterateCursor(
            () => this._cursorProvider.openCursor(options?.query, options?.direction),
            async (cursor) => {
                await action({
                    value: cursor.value,
                    key: cursor.key as IK,
                    primaryKey: cursor.primaryKey as PK,
                    update: (newValue) => (dbPromise(cursor.update(newValue)) as Promise<IK>),
                    delete: () => dbPromise(cursor.delete())
                })
            },
            options
        )
    }
}