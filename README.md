svelte-result-store
===================

Svelte store that does error handling and promises.

## Installation

The `svelte-result-store` package is distributed as a module on [npm](https://www.npmjs.com/package/svelte-result-store).

```
yarn add svelte-result-store
# or
npm install --save svelte-result-store
```

## Usage

```ts
import {readable, derived} from 'svelte-result-store

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
