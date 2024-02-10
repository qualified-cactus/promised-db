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