import { ObjectStore, Transaction } from "./dbActions"

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

    createObjectStore<T, K extends IDBValidKey, TNoKey>(objectDef: ObjectStoreDef<T, K, TNoKey>): ObjectStore<T, K, TNoKey> {
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

export interface ObjectStoreDef<T, K extends IDBValidKey, TNoKey=T> {
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
