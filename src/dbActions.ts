import { CursorIterator } from "./cursor"
import { IndexDef, IndexKeyRange, ObjectStoreDef } from "./dbDeclarations"
import { dbPromise } from "./utils"

/**
 * {@link T} is the type of the object, {@link PK} is the type of the object's primary key.
 */
export class ObjectStore<T, PK extends IDBValidKey> {
    #objectStore: IDBObjectStore

    /**
     * @readonly
     */
    iterator: CursorIterator<T, PK, PK>

    constructor(objectStore: IDBObjectStore) {
        this.#objectStore = objectStore
        this.iterator = new CursorIterator(objectStore)
    }

    add(value: Partial<T>, key?: PK): Promise<PK> {
        return dbPromise(this.#objectStore.add(value, key)) as Promise<PK>
    }

    put(value: Partial<T>, key?: PK): Promise<PK> {
        return dbPromise(this.#objectStore.put(value, key)) as Promise<PK>
    }

    get(key: PK): Promise<T | undefined> {
        return dbPromise(this.#objectStore.get(key))
    }

    getAll(): Promise<T[]> {
        return dbPromise(this.#objectStore.getAll())
    }

    delete(key: PK): Promise<undefined> {
        return dbPromise(this.#objectStore.delete(key))
    }

    clear(): Promise<undefined> {
        return dbPromise(this.#objectStore.clear())
    }

    count(): Promise<number> {
        return dbPromise(this.#objectStore.count())
    }

    index<IT extends IDBValidKey>(indexDef: IndexDef<IT>): Index<T, IT, PK> {
        return new Index(this.#objectStore.index(indexDef.name))
    }

    createIndex<IT extends IDBValidKey>(indexDef: IndexDef<IT>): Index<T, IT, PK> {
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
}

/**
 *  {@link IK} is the type of this index, {@link PK} is the type of the primary key of the object of this index.
 */
export class Index<O, IK extends IDBValidKey, PK extends IDBValidKey> {
    #index: IDBIndex
    
    /**
     * @readonly
     */
    iterator: CursorIterator<O, IK, PK>

    constructor(index: IDBIndex) {
        this.#index = index
        this.iterator = new CursorIterator(index) 
    }

    get(key: IK): Promise<O | undefined> {
        return dbPromise(this.#index.get(key))
    }

    getFirstInRange(query: IndexKeyRange<IK>): Promise<O | undefined> {
        return dbPromise(this.#index.get(query))
    }

    getAll(query?: IndexKeyRange<IK>, count?: number): Promise<O[]> {
        return dbPromise(this.#index.getAll(query, count))
    }

    count(query?: IndexKeyRange<IK>): Promise<number> {
        return dbPromise(this.#index.count(query))
    }

    getPrimaryKey(key: IK): Promise<PK | undefined> {
        return dbPromise(this.#index.getKey(key)) as Promise<PK | undefined>
    }

    getFirstPrimaryKey(query: IndexKeyRange<IK>): Promise<PK | undefined> {
        return dbPromise(this.#index.getKey(query)) as Promise<PK | undefined>
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