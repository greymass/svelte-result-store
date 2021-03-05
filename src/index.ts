import {
    derived as svelteDerived,
    readable as svelteReadable,
    writable as svelteWritable,
} from 'svelte/store'

import type {Readable, Writable} from 'svelte/store'

export type Result<T> = {value?: T; error?: Error}

type Subscriber<T> = (value: T) => void
type Unsubscriber = () => void
type Invalidator<T> = (value?: T) => void
type Updater<T> = (value: T) => T
type Stores = Readable<Result<any>> | [Readable<Result<any>>, ...Array<Readable<Result<any>>>]
type StoresValues<T> = T extends Readable<Result<infer U>>
    ? U
    : {
          [K in keyof T]: T[K] extends Readable<Result<infer U>> ? U : never
      }

export class ReadableResult<T> implements Readable<Result<T>> {
    subscribe: (run: Subscriber<Result<T>>, invalidate?: Invalidator<Result<T>>) => Unsubscriber

    constructor(resultStore: Readable<Result<T>>) {
        this.subscribe = resultStore.subscribe
    }

    /**
     * A store containing the value or undefined if there is an error.
     * Can also be undefined for async stores while the value is being resolved.
     */
    get value(): Readable<T | undefined> {
        return {
            subscribe: (set) =>
                this.subscribe((result) => {
                    if (result.error === undefined) {
                        set(result.value)
                    }
                }),
        }
    }

    /**
     * A store always containing a value when the result is resolved.
     * @param value The value used in place of errors.
     */
    catch(handler: (error: Error) => T | void): Readable<T | undefined> {
        return {
            subscribe: (set) =>
                this.subscribe((result) => {
                    if (result.error !== undefined) {
                        const value = handler(result.error)
                        if (value) {
                            set(value)
                        }
                    } else if (result.value !== undefined) {
                        set(result.value)
                    }
                }),
        }
    }

    /**
     * A store containing the error or undefined.
     */
    get error(): Readable<Error | undefined> {
        return {
            subscribe: (set) =>
                this.subscribe((result) => {
                    if (result.error !== undefined) {
                        set(result.error)
                    }
                }),
        }
    }

    /**
     * A store containing true if the readable has a result (a value or error), false otherwise.
     */
    get resolved(): Readable<boolean> {
        return {
            subscribe: (set) =>
                this.subscribe((result) => {
                    set(result.error !== undefined || result.value !== undefined)
                }),
        }
    }

    /**
     * A promise that resolves or rejects on the first value or error.
     */
    get promise(): Promise<T> {
        return new Promise((resolve, reject) => {
            const done = this.subscribe((result) => {
                if (result.error !== undefined) {
                    reject(result.error)
                } else if (result.value !== undefined) {
                    resolve(result.value)
                }
                if (result.error !== undefined || result.value !== undefined) {
                    setTimeout(() => {
                        done()
                    }, 0)
                }
            })
        })
    }
}

export class WritableResult<T> extends ReadableResult<T> implements Writable<Result<T>> {
    set: (value: Result<T>) => void
    update: (updater: Updater<Result<T>>) => void

    constructor(resultStore: Writable<Result<T>>) {
        super(resultStore)
        this.set = resultStore.set
        this.update = resultStore.update
    }

    updateValue(updater: Updater<T | undefined>) {
        this.update((result) => ({value: updater(result.value)}))
    }
}

type StartStopNotifier<T> = (
    set: Subscriber<T>,
    error: Subscriber<Error>
) => Unsubscriber | Promise<T | void> | void

/**
 * Like svelte/store's readable but initial value is optional and start notifier can be async and throw.
 */
export function readable<T>(initial: Result<T>): ReadableResult<T>
export function readable<T>(start: StartStopNotifier<T>): ReadableResult<T>
export function readable<T>(initial: Result<T>, start: StartStopNotifier<T>): ReadableResult<T>
export function readable<T>(...args: any[]): ReadableResult<T> {
    return new ReadableResult(internalWritable(...args))
}

/**
 * Like svelte/store's writable but initial value is optional and start notifier can be async and throw.
 */
export function writable<T>(initial: Result<T>): WritableResult<T>
export function writable<T>(start: StartStopNotifier<T>): WritableResult<T>
export function writable<T>(initial: Result<T>, start: StartStopNotifier<T>): WritableResult<T>
export function writable<T>(...args: any[]): WritableResult<T> {
    return new WritableResult(internalWritable(...args))
}

/**
 * Like svelte/store's derived but acts only when all results have resolved to a value.
 */
export function derived<S extends Stores, T>(
    stores: S,
    fn: (values: StoresValues<S>) => Promise<T>
): ReadableResult<T>
export function derived<S extends Stores, T>(
    stores: S,
    fn: (values: StoresValues<S>) => T
): ReadableResult<T>
export function derived<S extends Stores, T>(
    stores: S,
    fn: (values: StoresValues<S>, set: (value: T) => void, error: (error: Error) => void) => void
): ReadableResult<T>
export function derived<S extends Stores, T>(stores: S, fn: any): ReadableResult<T> {
    const single = !Array.isArray(stores)
    const auto = fn.length < 2
    const store = svelteDerived<S, Result<T>>(stores, (storeValues, set) => {
        const results = single
            ? [storeValues as StoresValues<S>]
            : (storeValues as StoresValues<S>[])
        const error = results.find((r) => r.error !== undefined)
        if (error) {
            set(error)
        } else {
            const values = results.map((r) => r.value)
            if (values.every((v) => v !== undefined)) {
                try {
                    const rv = fn(
                        single ? values[0] : values,
                        (value) => {
                            set({value})
                        },
                        (error) => {
                            set({error})
                        }
                    )
                    if (rv instanceof Promise) {
                        rv.then((value) => {
                            set({value})
                        }).catch((error) => {
                            set({error})
                        })
                    } else if (auto) {
                        set({value: rv as T})
                    } else {
                        return rv as Unsubscriber | void
                    }
                } catch (error) {
                    set({error})
                }
            } else {
                set({})
            }
        }
    })
    return new ReadableResult(store)
}

type FlatReadableResult<R, D extends number> = {
    done: R
    recur: R extends ReadableResult<infer Inner>
        ? FlatReadableResult<Inner, [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10][D]>
        : R
}[D extends -1 ? 'done' : 'recur']

/**
 * Takes nested readable and flattens it down to just one.
 * @param maxDepth Maximum recursion depth, default 10.
 */
export function flatten<T extends ReadableResult<any>, D extends number = 10>(
    store: T,
    maxDepth?: D
): ReadableResult<FlatReadableResult<T, D>> {
    const max = maxDepth || 10
    const result: Result<any> = {}
    const flat = svelteReadable(result, (set) => {
        const next = (d: number) => (r: any) => {
            if (r.error) {
                set({error: r.error})
            } else {
                if (r.value && typeof r.value.subscribe === 'function' && d < max) {
                    return subscribeCleanup(r.value, next(d + 1))
                } else {
                    set(r)
                }
            }
        }
        return subscribeCleanup(store, next(0))
    })
    return new ReadableResult(flat) as any
}

type Cleanup = () => void
type CleanupSubscriber<T> = (value: T) => Cleanup | void

function subscribeCleanup<T>(store: Readable<T>, run: CleanupSubscriber<T>): Unsubscriber {
    let cleanup = noop
    const unsub = store.subscribe((v) => {
        cleanup()
        cleanup = run(v) || noop
    })
    return () => {
        cleanup()
        unsub()
    }
}

function internalWritable<T>(...args: any[]): Writable<Result<T>> {
    let start: StartStopNotifier<T>
    let result: Result<T> = {}
    if (args.length === 2) {
        result = args[0]
        start = args[1]
    } else {
        start = typeof args[0] === 'function' ? args[0] : noop
        result =
            typeof args[0] === 'object' &&
            (args[0].value !== undefined || args[0].error !== undefined)
                ? args[0]
                : {}
    }
    return svelteWritable(result, (setResult) => {
        try {
            const rv = start(
                (value) => {
                    setResult({value})
                },
                (error) => {
                    setResult({error})
                }
            )
            if (rv instanceof Promise) {
                rv.then((value) => {
                    if (value !== undefined) {
                        setResult({value})
                    }
                }).catch((error) => {
                    setResult({error})
                })
            } else {
                return rv
            }
        } catch (error) {
            setResult({error})
        }
    })
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
