import { CursorIterator } from "./cursor"
import { IndexDef, IndexKeyRange, ObjectStoreDef } from "./dbDeclarations"
import { dbPromise } from "./utils"

/**
 * {@link T} is the type of the object, {@link PK} is the type of the object's primary key.
 */
export class ObjectStore<T, PK extends IDBValidKey> {
    #objectStore: IDBObjectStore

    readonly iterator: CursorIterator<T, PK, PK>

    constructor(objectStore: IDBObjectStore) {
        this.#objectStore = objectStore
        this.iterator = new CursorIterator(objectStore)
    }

    /**
     * A {@link Promise} version of {@link IDBObjectStore.add}
     */
    add(value: Partial<T>, key?: PK): Promise<PK> {
        return dbPromise(this.#objectStore.add(value, key)) as Promise<PK>
    }

    /**
     * A {@link Promise} version of {@link IDBObjectStore.put}
     */
    put(value: Partial<T>, key?: PK): Promise<PK> {
        return dbPromise(this.#objectStore.put(value, key)) as Promise<PK>
    }

    /**
     * @see {@link IDBObjectStore.get}
     */
    get(query: PK | IndexKeyRange<PK>): Promise<T | undefined> {
        return dbPromise(this.#objectStore.get(query))
    }

    /**
     * It is {@link get} but will throw if no object is found
     * @throws {NoResultError} when no object with {@link key} is found
     */
    async requireGet(key: PK | IndexKeyRange<PK>): Promise<T> {
        const result = await dbPromise(this.#objectStore.get(key))
        if (result !== undefined) {
            return result
        } else throw new NoResultError()
    }

    /**
     * A {@link Promise} version of {@link IDBObjectStore.getAll}
     */
    getAll(query?: PK | IndexKeyRange<PK>, count?: number): Promise<T[]> {
        return dbPromise(this.#objectStore.getAll(query, count))
    }

    /**
     * @see {@link IDBObjectStore.getAllKeys}
     */
    getAllPrimaryKeys(query?: PK| IndexKeyRange<PK>, count?: number): Promise<PK[]> {
        return dbPromise(this.#objectStore.getAllKeys(query, count)) as Promise<PK[]>
    }

    /**
     * @see {@link IDBObjectStore.getKey}
     */
    async getPrimaryKey(query: PK | IndexKeyRange<PK>): Promise<PK | undefined> {
        return (await dbPromise(this.#objectStore.getKey(query))) as PK | undefined
    }

    /**
     * @see {@link IDBObjectStore.delete}
     */
    delete(query: PK | IndexKeyRange<PK>): Promise<undefined> {
        return dbPromise(this.#objectStore.delete(query))
    }

    /**
     * A {@link Promise} version of {@link IDBObjectStore.clear}
     */
    clear(): Promise<undefined> {
        return dbPromise(this.#objectStore.clear())
    }

    /**
     * A {@link Promise} version of {@link IDBObjectStore.count}
     */
    count(query?: PK | IndexKeyRange<PK>): Promise<number> {
        return dbPromise(this.#objectStore.count(query))
    }

    /**
     * @see {ObjectStore.index}
     */
    index<IT extends IDBValidKey>(indexDef: IndexDef<IT>): Index<T, IT, PK> {
        return new Index(this.#objectStore.index(indexDef.name))
    }

    /**
     * @see {ObjectStore.createIndex}
     */
    createIndex<IT extends IDBValidKey>(indexDef: IndexDef<IT>): Index<T, IT, PK> {
        return new Index(this.#objectStore.createIndex(indexDef.name, indexDef.keyPath, indexDef.options))
    }

    /**
     * @see {ObjectStore.deleteIndex}
     */
    deleteIndex<IT extends IDBValidKey>(indexDef: IndexDef<IT>) {
        this.#objectStore.deleteIndex(indexDef.name)
    }

    /**
     * Try to delete an index of the specified {@link name}. Return true if delete successfully.
     * @see {ObjectStore.deleteIndex}
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
}

/**
 *  {@link IK} is the type of this index, {@link PK} is the type of the primary key of the object of this index.
 */
export class Index<O, IK extends IDBValidKey, PK extends IDBValidKey> {
    #index: IDBIndex
    readonly iterator: CursorIterator<O, IK, PK>

    constructor(index: IDBIndex) {
        this.#index = index
        this.iterator = new CursorIterator(index)
    }

    /**
     * @see {IDBIndex.get}
     */
    get(key: IK | IndexKeyRange<IK>): Promise<O | undefined> {
        return dbPromise(this.#index.get(key))
    }

    /**
    * @throws {NoResultError} when no object with {@link key} is found
    * @see {IDBIndex.get}
    */
    async requireGet(key: IK | IndexKeyRange<IK>): Promise<O> {
        const result = await dbPromise(this.#index.get(key))
        if (result !== undefined) {
            return result
        } else throw new NoResultError()
    }

    getAll(query?: IK | IndexKeyRange<IK>, count?: number): Promise<O[]> {
        return dbPromise(this.#index.getAll(query, count))
    }

    /**
     * @see {IDBIndex.getAll}
     */
    getAllPrimaryKeys(query?: IK | IndexKeyRange<IK>, count?: number): Promise<PK[]> {
        return dbPromise(this.#index.getAll(query, count))
    }

    /**
     * @see {IDBIndex.count}
     */
    count(query?: IK | IndexKeyRange<IK>): Promise<number> {
        return dbPromise(this.#index.count(query))
    }

    /**
     * @see {IDBIndex.getKey}
     */
    getPrimaryKey(key: IK | IndexKeyRange<IK>): Promise<PK | undefined> {
        return dbPromise(this.#index.getKey(key)) as Promise<PK | undefined>
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

class NoResultError extends Error {

}