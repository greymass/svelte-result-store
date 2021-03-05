svelte-result-store
===================

Svelte store that does error handling and promises.

## Introduction

Svelte stores are great but becomes cumbersome to use when you need error handling and want to compose a flow of multiple, possibly failing stores.

`svelte-result-store` introduces a new concept on top of the standard `svelte/store` that is the `Result<T> = {value?: T; error?: Error}` type. A `Result` can have three states, either unresolved (no error, no value), resolved with value or resolved with error.

This module exports the same three methods as `svelte/store`, (`{readable, writable, derived}`) and they work mostly the same but on `Result`s. A notable difference is that `svelte-result-store` does not require an initial value and considers `undefined` to be "unresolved" instead of an actual value (use `null` if you need to work with optional values).

With this we can let the derived stores act only on resolved values and short-circuit a chain of derived stores if an error occurs - not requiring you to check for errors at each step - for example:

```ts
const numberStore = writable() // no initial value required

HorseSensor.global.addEventListener('neeeeigh', (event) => {
    numberStore.set({value: event.hay.numNeedles})
})

const remoteStore = readable((set, error) => {
    fetch('https://example.com').then((res) => res.json()).then(set).catch(error)
})

const derivedStore = derived([numberStore, remoteStore], ([number, data] => {
    // number and data is guaranteed to be available here
    return number * data.stonks
}))

derivedStore.subscribe((result) => {
    if (result.error) {
        console.log(error)
    } else if (result.value) {
        console.log(result.value)
    } else {
        console.log('pending')
    }
})
```

And since the result stores work nicely with promises you could write the remoteStore from above using an async function instead:

```ts
const remoteStore = readable(async () => {
    const res = await fetch('https://example.com')
    return res.json()
})
```

In fact any function passed to `readable`, `writable` or `derived` can be async and errors thrown (both async and sync) will propagate to the `Result`.

The readable stores returned by this library also expose some convenience getters, for example if we are only interested in the resulting values from the above example we could do:

```ts
derivedStore.value.subscribe((value) => console.log('haystocks signal', value))
```

Or even better (since you would never dream of just ignoring an error, right?):

```ts
derivedStore
    .catch((error) => console.log('Unexpected error!', error))
    .subscribe((value) => console.log('haystocks signal', value))
```

See the source or generated type definitions for a list of all helper methods :)

## Installation

The `svelte-result-store` package is distributed as a module on [npm](https://www.npmjs.com/package/svelte-result-store).

```
yarn add svelte-result-store
# or
npm install --save svelte-result-store
```

## Example usage

```ts
import {readable, derived} from 'svelte-result-store'

const things = readable(async () => {
    const data = await getData()
    if (data.badThings) {
        throw new Error('Bad things')
    }
    return data.things
})

const otherThings = readable((set) => {
    set(42)
})

const allThings = derived([things, otherThings], async ([$things, $otherThings]) => {
    const result = await computeAllThings($things, $otherThings)
    return result.all
})

allThings.value.subscribe((value) => {
    if (value) {
        console.log('GOT ALL THE THINGS', value)
    }
})

allThings.error.subscribe((error) => {
    if (error) {
        console.log('Things are bad', error)
    }
})
```

## Developing

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

Clone the repository and run `make` to checkout all dependencies and build the project. See the [Makefile](./Makefile) for other useful targets. Before submitting a pull request make sure to run `make lint`.

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com), if you find this useful please consider [supporting us](https://greymass.com/support-us).
