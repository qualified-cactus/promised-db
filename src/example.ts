import { ObjectStoreDef, IndexDef, DatabaseDef, Database } from "./dbDeclarations"

namespace TodoTask {
    export interface Type {
        id: number
        name: string
        completed: number // 0 for false, 1 for true
    }
    export const ObjectStore: ObjectStoreDef<Type, number> = {
        name: "todo-tasks",
        options: {
            keyPath: "id",
            autoIncrement: true
        }
    }
    export const NameIndex = new IndexDef<string>(
        "todo-task-name-index", // index name
        "name", // index path
        { unique: true } // index's options
    )
    export const CompletedIndex = new IndexDef<number>(
        "todo-task-name-index", // index name
        "completed", // index path
    )
}

const TodoTaskDbDef = new DatabaseDef(
    "todo-tasks-db", // db name 
    1, // version
    
    // upgrade handler
    (db, oldVersion, newVersion) => {
        if (oldVersion < 1) {
            const objectStore = db.createObjectStore(TodoTask.ObjectStore)
            objectStore.createIndex(TodoTask.NameIndex)
            objectStore.createIndex(TodoTask.CompletedIndex)
        }
    }
)

async function doOperation() {

    const db: Database = await TodoTaskDbDef.open()
    await db.transaction(
        [TodoTask.ObjectStore],  // transaction's scope
        "readwrite",    // mode
        async (transaction) => {

            // find the first completed todo-task in db and delete it
            const todoTaskObjectStore = transaction.objectStore(TodoTask.ObjectStore)
            const completedIndex = todoTaskObjectStore.index(TodoTask.CompletedIndex)
            const task = await completedIndex.get(1)    
            if (task) {
                todoTaskObjectStore.delete(task.id)
            }

            // key range can be created from Index definition
            const nameIndex = todoTaskObjectStore.index(TodoTask.NameIndex)
            // get all tasks with name greater than "bazz"
            const tasksList = nameIndex.getAll(TodoTask.NameIndex.lowerBound("bazz"))

            // iterate over keys of index / objectstore
            nameIndex.iterator.iterateKeys(async (cursor)=>{
                console.log(cursor.key)  // access index key
                console.log(cursor.primaryKey) // access primary key
            })

            // iterate over objects of index / objectstore 
            nameIndex.iterator.iterateValues(async (cursor)=>{
                console.log(cursor.key)  // access index key
                console.log(cursor.primaryKey) // access primary key
                console.log(cursor.value) // access object

                await cursor.update({...cursor.value, name: "new name"}) // update value using cursor
                await cursor.delete() // or delete value using cursor
            })
        }
    )
}