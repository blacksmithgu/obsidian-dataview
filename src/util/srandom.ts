import { Context } from "expression/context";

/* This seeded random generator is based upon this stackoverflow answer:
 *   https://stackoverflow.com/a/47593316
 *
 *  And the sfc32() and cyrb128() functions copied directrly from it,
 *  so thanks to https://stackoverflow.com/users/815680/bryc
 */

function sfc32(a: number, b: number, c: number, d: number): () => number {
    return function (): number {
        a |= 0;
        b |= 0;
        c |= 0;
        d |= 0;
        var t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}

function cyrb128(str: string): number[] {
    let h1 = 1779033703,
        h2 = 3144134277,
        h3 = 1013904242,
        h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    (h1 ^= h2 ^ h3 ^ h4), (h2 ^= h1), (h3 ^= h1), (h4 ^= h1);
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/* Return the unique srandom function for a given query,
 * using the provided seed
 */
export function executeSrandom(seed: string, ctx: Context): number {
    const internalKey = (ctx.get("queryUUID") as string) + "§" + seed;

    // If key not present, generate new srandom function
    if (!ctx.globals.hasOwnProperty(internalKey)) {
        const [a, b, c, d] = cyrb128(seed);
        ctx.set(internalKey, sfc32(a, b, c, d));
    }

    return (ctx.get(internalKey) as () => number)();
}
