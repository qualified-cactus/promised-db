import { dbPromise } from "./extensions"

export type DbUpgrader = (db: Database, oldVersion: number, newVersion: number | null) => void

/**
 * 
 */
export class DatabaseDef {
    #name: string
    #version: number
    #upgrader: DbUpgrader

    constructor(name: string, version: number, upgrader: DbUpgrader) {
        this.#name = name
        this.#version = version
        this.#upgrader = upgrader
    }

    async open(): Promise<Database> {
        return new Promise((resolve, reject) => {
            const rq = window.indexedDB.open(this.#name, this.#version)
            const upgrader = this.#upgrader
            rq.onupgradeneeded = function (event: IDBVersionChangeEvent) {
                upgrader(new Database(this.result), event.oldVersion, event.newVersion)
            }
            rq.onsuccess = function () {
                resolve(new Database(this.result))
            }
            rq.onerror = function () {
                reject(this.error)
            }
        })
    }
}

export class Database {
    #db: IDBDatabase
    constructor(db: IDBDatabase) {
        this.#db = db
    }

    createObjectStore<T, K extends IDBValidKey>(objectDef: ObjectStoreDef<T, K>): ObjectStore<T, K> {
        return new ObjectStore(this.#db.createObjectStore(objectDef.name, objectDef.options))
    }

    deleteObjectStore(objectDef: ObjectStoreDef<any, any>) {
        this.#db.deleteObjectStore(objectDef.name)
    }

    transaction<T>(
        scope: ObjectStoreDef<any, any>[],
        mode: IDBTransactionMode,
        action: (transaction: Transaction) => Promise<T>,
        options?: IDBTransactionOptions
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction(scope.map((o) => o.name), mode, options)
            let actionCompleted = false
            let result: T
            transaction.oncomplete = () => {
                if (!actionCompleted) {
                    reject(new Error("Transaction completed before action function completed"))
                } else {
                    resolve(result)
                }
            }
            action(new Transaction(transaction))
                .then((out) => {
                    actionCompleted = true
                    result = out
                })
                .catch((e) => {
                    transaction.abort()
                    reject(e)
                })
        })
    }

    close() {
        this.#db.close()
    }
}

export interface ObjectStoreDef<T, K extends IDBValidKey> {
    name: string
    options?: IDBObjectStoreParameters
}

export class IndexDef<T extends IDBValidKey> {
    name: string
    keyPath: string | string[]
    options?: IDBIndexParameters

    constructor(name: string, keyPath: string | string[], options?: IDBIndexParameters) {
        this.name = name
        this.keyPath = keyPath
        this.options = options
    }

    bound(lower: T, upper: T, lowerOpen?: boolean, upperOpen?: boolean): IndexKeyRange<T> {
        return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)
    }

    lowerBound(lower: T, open?: boolean): IndexKeyRange<T> {
        return IDBKeyRange.lowerBound(lower, open)
    }

    upperBound(upper: T, open?: boolean): IndexKeyRange<T> {
        return IDBKeyRange.upperBound(upper, open)
    }

    only(value: T): IndexKeyRange<T> {
        return IDBKeyRange.only(value)
    }
}

export type IndexKeyRange<T> = IDBKeyRange


/**
 * {@link T} is the type of the object, {@link K} is the type of the object's primary key.
 */
export class ObjectStore<T, K extends IDBValidKey> {
    #objectStore: IDBObjectStore
    constructor(objectStore: IDBObjectStore) {
        this.#objectStore = objectStore
    }

    add(value: Partial<T>, key?: K): Promise<K> {
        return dbPromise(this.#objectStore.add(value, key)) as Promise<K>
    }

    put(value: Partial<T>, key?: K): Promise<K> {
        return dbPromise(this.#objectStore.put(value, key)) as Promise<K>
    }

    get(key: K): Promise<T | undefined> {
        return dbPromise(this.#objectStore.get(key))
    }

    getAll(): Promise<T[]> {
        return dbPromise(this.#objectStore.getAll())
    }

    delete(key: K): Promise<undefined> {
        return dbPromise(this.#objectStore.delete(key))
    }

    clear(): Promise<undefined> {
        return dbPromise(this.#objectStore.clear())
    }

    count(): Promise<number> {
        return dbPromise(this.#objectStore.count())
    }

    index<IT extends IDBValidKey>(indexDef: IndexDef<IT>): Index<T, IT, K> {
        return new Index(this.#objectStore.index(indexDef.name))
    }

    createIndex<IT extends IDBValidKey>(indexDef: IndexDef<IT>): Index<T, IT, K> {
        return new Index(this.#objectStore.createIndex(indexDef.name, indexDef.keyPath, indexDef.options))
    }

    deleteIndex<IT extends IDBValidKey>(indexDef: IndexDef<IT>) {
        this.#objectStore.deleteIndex(indexDef.name)
    }

    /**
     * Try to delete an index of the specified {@link name}. Return true if delete successfully.
     * @param name 
     * @returns 
     */
    tryDeleteIndex(name: string): boolean {
        try {
            this.#objectStore.deleteIndex(name)
            return true
        } catch (e) {
            if (e instanceof DOMException && e.name === "NotFoundError") {
                return false
            } else {
                throw e
            }
        }
    }

    /**
     * Iterating the objects of this object store
     */
    iterate(action: IterateAction<IDBCursorWithValue, T, K>, direction?: IDBCursorDirection): Promise<void> {
        return new Promise((resolve, reject) => {
            const rq = this.#objectStore.openCursor(null, direction)
            rq.onsuccess = () => {
                const cursor = rq.result
                if (cursor) {
                    action(new CursorCurrentValue(cursor, () => cursor.value))
                        .then((skip) => {
                            if (skip) {
                                resolve()
                            } else {
                                cursor.continue()
                            }
                        }).catch(reject)
                } else {
                    resolve()
                }
            }
            rq.onerror = () => { reject(rq.error) }
        })
    }


    /**
     * Iterating the keys of this object store.
     */
    iterateKeys(action: IterateAction<IDBCursor, K, K>, direction?: IDBCursorDirection): Promise<void> {
        return new Promise((resolve, reject) => {
            const rq = this.#objectStore.openKeyCursor(null, direction)
            rq.onsuccess = () => {
                const cursor = rq.result
                if (cursor) {
                    action(new CursorCurrentValue(cursor, () => { return cursor.key as K }))
                        .then((skip) => {
                            if (skip) {
                                resolve()
                            } else {
                                cursor.continue()
                            }
                        }).catch(reject)
                } else {
                    resolve()
                }
            }
            rq.onerror = () => { reject(rq.error) }
        })
    }
}

/**
 * Returning true from this function will stop iterating the cursor.
 */
export type IterateAction<C extends IDBCursor, T, K> = (value: CursorCurrentValue<C, T, K>) => Promise<void | boolean>


export class CursorCurrentValue<C extends IDBCursor, T, K> {
    #cursor: C

    constructor(cursor: C, valueGetter: (c: C) => T) {
        this.#cursor = cursor
        this.value = valueGetter
    }

    value: (c: C) => T

    primaryKey(): K {
        return this.#cursor.primaryKey as K
    }

    async update(newValue: T): Promise<K> {
        return await dbPromise(this.#cursor.update(newValue)) as K
    }

    async delete() {
        await dbPromise(this.#cursor.delete())
    }
}


/**
 *  {@link T} is the type of this index, {@link K} is the type of the primary key of the object of this index.
 */
export class Index<O, T extends IDBValidKey, K extends IDBValidKey> {
    #index: IDBIndex
    constructor(index: IDBIndex) {
        this.#index = index
    }

    get(key: T): Promise<O | undefined> {
        return dbPromise(this.#index.get(key))
    }

    getFirstInRange(query: IndexKeyRange<T>): Promise<O | undefined> {
        return dbPromise(this.#index.get(query))
    }

    getAll(query?: IndexKeyRange<T>, count?: number): Promise<O[]> {
        return dbPromise(this.#index.getAll(query, count))
    }

    count(query?: IndexKeyRange<T>): Promise<number> {
        return dbPromise(this.#index.count(query))
    }

    getPrimaryKey(key: T): Promise<K | undefined> {
        return dbPromise(this.#index.getKey(key)) as Promise<K | undefined>
    }

    getFirstPrimaryKey(query: IndexKeyRange<T>): Promise<K | undefined> {
        return dbPromise(this.#index.getKey(query)) as Promise<K | undefined>
    }

    iterateObjects(action: IterateAction<IDBCursorWithValue, O, K>, query?: IndexKeyRange<T>, direction?: IDBCursorDirection): Promise<void> {
        return new Promise((resolve, reject) => {
            const rq = this.#index.openCursor(query, direction)
            rq.onsuccess = () => {
                const cursor = rq.result
                if (cursor) {
                    action(new CursorCurrentValue(cursor, () => cursor.value))
                        .then((skip) => {
                            if (skip) {
                                resolve()
                            } else {
                                cursor.continue()
                            }
                        }).catch(reject)
                } else {
                    resolve()
                }
            }
            rq.onerror = () => { reject(rq.error) }
        })
    }

    iterateIndexKeys(action: IterateAction<IDBCursor, T, K>, query?: IndexKeyRange<T>, direction?: IDBCursorDirection): Promise<void> {
        return new Promise((resolve, reject) => {
            const rq = this.#index.openKeyCursor(query, direction)
            rq.onsuccess = () => {
                const cursor = rq.result
                if (cursor) {
                    action(new CursorCurrentValue(cursor, () => { return cursor.key as T }))
                        .then((skip) => {
                            if (skip) {
                                resolve()
                            } else {
                                cursor.continue()
                            }
                        }).catch(reject)
                } else {
                    resolve()
                }
            }
            rq.onerror = () => { reject(rq.error) }
        })
    }

}



export class Transaction {
    #transaction: IDBTransaction
    constructor(transaction: IDBTransaction) {
        this.#transaction = transaction
    }

    abort() {
        this.#transaction.abort()
    }

    commit() {
        this.#transaction.commit()
    }

    objectStore<T, K extends IDBValidKey>(objectDef: ObjectStoreDef<T, K>): ObjectStore<T, K> {
        return new ObjectStore<T, K>(this.#transaction.objectStore(objectDef.name))
    }
}