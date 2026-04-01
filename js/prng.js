// Mulberry32 PRNG — deterministic, seed-based
let _seed = 987654321;
let _prng = null;

function mulberry32(a) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function random() {
    if (!_prng) _prng = mulberry32(_seed);
    return _prng();
}

export function getSeed() {
    return _seed;
}

/** Set seed and reset the PRNG to its beginning */
export function setSeed(seed) {
    _seed = seed;
    _prng = mulberry32(seed);
}

/** Generate a new random seed, set it, return it */
export function newSeed() {
    _seed = Math.floor(Math.random() * 0xffffffff);
    _prng = mulberry32(_seed);
    return _seed;
}
