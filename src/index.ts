import {derived as svelteDerived, readable as svelteReadable} from 'svelte/store'
import type {Readable} from 'svelte/store'

export type Result<T> = {value?: T; error?: Error}

type Subscriber<T> = (value: T) => void
type Unsubscriber = () => void
type Invalidator<T> = (value?: T) => void
type StartStopNotifier<T> = (set: Subscriber<T>, error: Subscriber<Error>) => Unsubscriber | void
type Stores = Readable<Result<any>> | [Readable<Result<any>>, ...Array<Readable<Result<any>>>]
type StoresValues<T> = T extends Readable<Result<infer U>>
    ? U
    : {
          [K in keyof T]: T[K] extends Readable<Result<infer U>> ? U : never
      }

class ResultReadable<T> implements Readable<Result<T>> {
    private valueStore?: Readable<T | undefined>
    private errorStore?: Readable<Error | undefined>
    private resolvedStore?: Readable<boolean>

    constructor(private resultStore: Readable<Result<T>>) {}

    subscribe(run: Subscriber<Result<T>>, invalidate?: Invalidator<Result<T>>): Unsubscriber {
        return this.resultStore.subscribe(run, invalidate)
    }

    /**
     * A store containing the value or undefined if there is an error.
     * Can also be undefined for async stores while the value is resolved.
     */
    get value(): Readable<T | undefined> {
        if (!this.valueStore) {
            this.valueStore = svelteDerived(this.resultStore, (result, set) => {
                if (result.error === undefined) {
                    set(result.value)
                }
            })
        }
        return this.valueStore
    }

    /**
     * A store containing the error or undefined.
     */
    get error(): Readable<Error | undefined> {
        if (!this.errorStore) {
            this.errorStore = svelteDerived(this.resultStore, (result, set) => {
                if (result.error !== undefined) {
                    set(result.error)
                }
            })
        }
        return this.errorStore
    }

    /**
     * A store containing true if the readable has a result (a value or error), false otherwise.
     */
    get resolved(): Readable<boolean> {
        if (!this.resolvedStore) {
            this.resolvedStore = svelteDerived(
                this.resultStore,
                (result, set) => {
                    set(result.error !== undefined || result.value !== undefined)
                },
                false as boolean
            )
        }
        return this.resolvedStore
    }

    /** A promise that resolves or rejects on the first value or error. */
    get promise(): Promise<T> {
        return new Promise((resolve, reject) => {
            const done = this.resultStore.subscribe((result) => {
                if (result.error !== undefined) {
                    reject(result.error)
                } else if (result.value !== undefined) {
                    resolve(result.value)
                    done()
                }
            })
        })
    }
}

export function readable<T>(start: StartStopNotifier<T> | (() => Promise<T>)): ResultReadable<T> {
    const result: Result<T> = {}
    const readable = svelteReadable(result, (setResult) => {
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
                    setResult({value})
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
    return new ResultReadable(readable)
}

type DerivedStartStopNotifier<S extends Stores, T> = (
    values: StoresValues<S>,
    set: (value: T) => void,
    error: (error: Error) => void
) => Unsubscriber | void

type DerivedPromise<S extends Stores, T> = (values: StoresValues<S>) => Promise<T>

/** Like svelte/store's derived but acts only when all results have resolved to a value. */
export function derived<S extends Stores, T>(
    stores: S,
    fn: DerivedStartStopNotifier<S, T> | DerivedPromise<S, T>
): ResultReadable<T> {
    const single = !Array.isArray(stores)
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
                        values as StoresValues<S>,
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
                    } else {
                        return rv
                    }
                } catch (error) {
                    set({error})
                }
            } else {
                set({})
            }
        }
    })
    return new ResultReadable(store)
}
