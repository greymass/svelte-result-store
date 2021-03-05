import {strict as assert} from 'assert'
import 'mocha'

import {derived, flatten, readable} from '../src'

suite('result store', function () {
    test('subscribe', function (done) {
        const store = readable<number>((set) => {
            set(42)
        })
        store.subscribe((value) => {
            assert.equal(value.value, 42)
            assert.equal(value.error, undefined)
            done()
        })
    })

    test('derived value', function (done) {
        const store = readable<number>((set) => {
            set(42)
        })
        store.error.subscribe((error) => {
            assert.equal(error, undefined)
        })
        store.value.subscribe((value) => {
            assert.equal(value, 42)
            done()
        })
    })

    test('derived error', function (done) {
        const store = readable<number>((set, error) => {
            error(new Error('fail'))
        })
        store.value.subscribe((value) => {
            assert.equal(value, undefined)
        })
        store.error.subscribe((error) => {
            assert.equal(String(error), 'Error: fail')
            done()
        })
    })

    test('throwing', function (done) {
        const store = readable<number>(() => {
            throw new Error('fail')
        })
        store.error.subscribe((error) => {
            assert.equal(String(error), 'Error: fail')
            done()
        })
    })

    test('delayed', function (done) {
        const store = readable<number>((set) => {
            setTimeout(() => {
                set(100)
            }, 10)
        })
        let update = 0
        store.value.subscribe((value) => {
            update++
            switch (update) {
                case 1:
                    assert.equal(value, undefined)
                    break
                case 2:
                    assert.equal(value, 100)
                    done()
                    break
                default:
                    assert.fail()
            }
        })
    })

    test('async', function (done) {
        const store = readable<number>(async () => {
            await sleep(10)
            return 42
        })
        let update = 0
        store.value.subscribe((value) => {
            update++
            switch (update) {
                case 1:
                    assert.equal(value, undefined)
                    break
                case 2:
                    assert.equal(value, 42)
                    done()
                    break
                default:
                    assert.fail()
            }
        })
    })

    test('async throwing', function (done) {
        const store = readable<number>(async () => {
            throw new Error('fail')
        })
        store.error.subscribe((error) => {
            if (error) {
                assert.equal(String(error), 'Error: fail')
                done()
            }
        })
    })

    test('async setter', function (done) {
        const store = readable<number>(async (set) => {
            await sleep(5)
            set(1)
            await sleep(5)
            set(42)
        })
        let update = 0
        store.value.subscribe((value) => {
            update++
            switch (update) {
                case 1:
                    assert.equal(value, undefined)
                    break
                case 2:
                    assert.equal(value, 1)
                    break
                case 3:
                    assert.equal(value, 42)
                    done()
                    break
                default:
                    assert.fail()
            }
        })
    })

    test('derived', function (done) {
        const a = readable<number>((set) => {
            set(1)
        })
        const b = readable<number>((set) => {
            setTimeout(() => {
                set(2)
            }, 10)
        })
        const store = derived([a, b], ([va, vb], set) => {
            set(va + vb)
        })
        store.value.subscribe((v) => {
            if (v) {
                assert.equal(v, 3)
                done()
            }
        })
    })

    test('derived upstream error', function (done) {
        const a = readable<number>((set) => {
            set(1)
        })
        const b = readable<number>(() => {
            throw new Error('fail')
        })
        const store = derived([a, b], ([va, vb], set) => {
            set(va + vb)
        })
        store.error.subscribe((error) => {
            if (error) {
                assert.equal(String(error), 'Error: fail')
                done()
            }
        })
    })

    test('derived error', function (done) {
        const a = readable<number>((set) => {
            set(1)
        })
        const b = readable<number>((set) => {
            set(2)
        })
        const store = derived([a, b], ([va, vb], set, error) => {
            set(va + vb)
            setTimeout(() => {
                error(new Error('fail'))
            }, 10)
        })
        store.error.subscribe((error) => {
            if (error) {
                assert.equal(String(error), 'Error: fail')
                done()
            }
        })
    })

    test('derived throwing', function (done) {
        const a = readable<number>((set) => {
            set(1)
        })
        const b = readable<number>((set) => {
            setTimeout(() => {
                set(2)
            }, 10)
        })
        const store = derived([a, b], () => {
            throw new Error('fail')
        })
        store.error.subscribe((error) => {
            if (error) {
                assert.equal(String(error), 'Error: fail')
                done()
            }
        })
    })

    test('derived async', function (done) {
        const a = readable<number>((set) => {
            set(1)
        })
        const b = readable<number>(async () => {
            await sleep(1)
            return 2
        })
        const store = derived([a, b], async ([va, vb]) => {
            return va + vb
        })
        store.value.subscribe((v) => {
            if (v) {
                assert.equal(v, 3)
                done()
            }
        })
    })

    test('derived async throwing', function (done) {
        const a = readable<number>(async () => {
            await sleep(1)
            return 2
        })
        const store = derived(a, async () => {
            throw new Error('fail')
        })
        store.error.subscribe((error) => {
            if (error) {
                assert.equal(String(error), 'Error: fail')
                done()
            }
        })
    })

    test('derived auto', function (done) {
        const a = readable<number>((set) => {
            set(1)
        })
        const b = readable<number>(async () => {
            await sleep(1)
            return 2
        })
        const store = derived([a, b], ([va, vb]) => {
            return va + vb
        })
        store.value.subscribe((value) => {
            if (value) {
                assert.equal(value, 3)
                done()
            }
        })
    })

    test('result promise', async function () {
        let error: any
        const store = readable<number>((set, e) => {
            set(123)
            error = e
        })
        const result = await store.promise
        assert.equal(result, 123)
        error(new Error('fail'))
        assert.rejects(async () => {
            await store.promise
        })
    })

    test('result resolved', function (done) {
        let set: any
        const store = readable<number>((s) => {
            set = s
        })
        let n = 0
        store.resolved.subscribe((v) => {
            n++
            if (n === 1) {
                assert.equal(v, false)
                set(1)
                store.resolved.subscribe((v) => {
                    assert.equal(v, true)
                    done()
                })
            }
        })
    })

    test('flatten', function (done) {
        const a = readable<number>(async () => 10)
        const b = readable(async () => a)
        const c = readable((set) => {
            const timer = setInterval(() => {
                set(b)
            }, 10)
            return () => {
                clearInterval(timer)
            }
        })
        const d = flatten(c)
        const unsub = d.value.subscribe((v) => {
            if (v) {
                assert.equal(v, 10)
                unsub()
                done()
            }
        })
    })

    test('flatten error', function (done) {
        const a = readable<number>(async () => 10)
        const b = readable(async () => {
            throw new Error('fail')
        })
        const c = readable(async () => b)
        const d = flatten(c)
        d.error.subscribe((e) => {
            if (e) {
                assert.equal(String(e), 'Error: fail')
                done()
            }
        })
    })
})

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })
}
