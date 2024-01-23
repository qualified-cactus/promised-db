export function dbPromise<T>(rq: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        rq.onerror = function () {
            reject(this.error)
        }
        rq.onsuccess = function () {
            resolve(this.result)
        }
    })
}



