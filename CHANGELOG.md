## 3.1.2
- Further improved type safety of `ObjectStoreDef` and `ObjectStore`.
- `DatabaseDef.open` will now throw `UpgradeAttemptBlockedError` if `onblocked` event occured.
- Added `deleteDatabase` function.

## 3.1.1
- I forgot to rebuild this project before publishing 3.1.0 .

## 3.1.0
- Improved type safety when adding object by explicitly add an option specify object's type without key.

## 3.0.0
- Remove get `getFirstInRange` method from index + objectstore

## 2.3.0
- User can now break iteration when using `CursorIterator.iterateKeys`, 
`CursorIterator.iterateValues` by return `true` from `action`.

## 2.2.0

- Added `ObjectStore.getAllPrimaryKeys` and `Index.getAllPrimaryKeys`.
- Added optional params `query` and `count` to `ObjectStore.getAll`.
- Added some jsdoc.
- Added `.npmignore` to exlude typescript source fron npm distribution.