import { IndexKeyRange } from "./dbDeclarations"
import { dbPromise } from "./utils"

interface CursorProvider {
    openKeyCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursor | null>
    openCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursorWithValue | null>
}

export interface CursorValue1<T extends IDBValidKey, K extends IDBValidKey> {
    key: T
    primaryKey: K
}

export interface CursorValue2<V, T extends IDBValidKey, K extends IDBValidKey> extends CursorValue1<T, K> {
    value: V
    delete(): Promise<void>
    update(newValue: V): Promise<T>
}


export interface CursorIterationOption<IK, PK> {
    /**
     * Specify where the cursor should start from (inclusive).
     * {@link IDBCursor.continue} is used if {@link primaryKey} is undefined.
     * If it is not, {@link IDBCursor.continuePrimaryKey} is used instead.
     */
    from?: {
        key: IK
        primaryKey?: PK
    }
    /**
     * Limit the number of results iterated
     */
    limit?: number
    /**
     * If specified, {@link IDBCursor.advance} is used before iteration.
     */
    offset?: number
    query?: IndexKeyRange<IK>
    direction?: IDBCursorDirection
}

export class CursorIterator<T, IK extends IDBValidKey, PK extends IDBValidKey> {

    #cursorProvider: CursorProvider

    constructor(cursorProvider: CursorProvider) {
        this.#cursorProvider = cursorProvider
    }

    #iterateCursor<C extends IDBCursor>(
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
                            cursor.continuePrimaryKey(options.from.key, options.from.primaryKey)
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

    /**
     * Iterating over keys and primary keys. To update/delete, use {@link iterateValues} instead.
     * @param options see doc of {@link CursorIterationOption} to know how to use.
     */
    iterateKeys(
        action: (v: CursorValue1<IK, PK>) => Promise<void>,
        options?: CursorIterationOption<IK, PK>,
    ): Promise<void> {
        return this.#iterateCursor(
            () => this.#cursorProvider.openKeyCursor(options?.query, options?.direction),
            async (cursor) => {
                await action({
                    key: cursor.key as IK,
                    primaryKey: cursor.primaryKey as PK
                })
            },
            options
        )
    }

    /**
     * Iterating over key, primary keys and objects. 
     * You can also update or delete during iteration using {@link CursorValue2.update} or {@link CursorValue2.delete}.
     * @param options see doc of {@link CursorIterationOption} to know how to use.
     */
    iterateValues(
        action: (v: CursorValue2<T, IK, PK>) => Promise<void>,
        options?: CursorIterationOption<IK, PK>,
    ) {
        return this.#iterateCursor(
            () => this.#cursorProvider.openCursor(options?.query, options?.direction),
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