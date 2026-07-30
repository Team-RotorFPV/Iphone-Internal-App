// Opaque short-code generation for physical QR asset tags.
//
// Design decisions (see QR tagging spec):
//  - Codes are opaque and random, NOT sequential — a sequential id leaks total
//    inventory size and is guessable.
//  - Alphabet is Crockford base32 (no I, L, O, U) so the code stays readable
//    when printed under the QR and typos are less likely.
//  - A trailing check character (Luhn mod 32) is appended so a hand-typed or
//    mis-OCR'd code can be rejected instead of silently resolving to the wrong
//    tag.
//
// This module is intentionally pure: randomness is injected so it is fully
// testable, and it pulls in no native modules (expo-crypto is lazy-required
// only by the default RNG at call time on-device).

export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 chars, Crockford
const N = CODE_ALPHABET.length;

// Number of random data characters (excludes the check char).
// 8 base32 chars = 40 bits of entropy — collision-safe for batches in the
// thousands and not enumerable.
export const CODE_DATA_LENGTH = 8;

// Crockford-style normalisation: uppercase, drop separators, and fold the
// visually ambiguous letters onto their digit twins so a human re-typing a
// scratched label still resolves.
export const normalizeCode = (raw) => {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
};

// Luhn mod N check character over CODE_ALPHABET. Catches every single-character
// error and most adjacent transpositions.
const luhnCheckChar = (input) => {
  let factor = 2;
  let sum = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    let addend = factor * CODE_ALPHABET.indexOf(input[i]);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  const remainder = sum % N;
  return CODE_ALPHABET[(N - remainder) % N];
};

// Validate a full code (data + check char). Normalises first, so it accepts
// lower-case / hyphenated / ambiguous-letter input.
export const isValidCode = (raw) => {
  const code = normalizeCode(raw);
  if (code.length !== CODE_DATA_LENGTH + 1) return false;
  if (![...code].every((c) => CODE_ALPHABET.includes(c))) return false;
  const data = code.slice(0, -1);
  const check = code.slice(-1);
  return luhnCheckChar(data) === check;
};

// Default randomness — Web Crypto (available in every modern browser and in
// Node 18+). Tests inject their own RNG instead.
const defaultRandomBytes = (n) => {
  const out = new Uint8Array(n);
  (globalThis.crypto || window.crypto).getRandomValues(out);
  return out;
};

// Generate one code: `CODE_DATA_LENGTH` random data chars + a check char.
// `getRandomBytes(n) -> Uint8Array|number[]` is injectable for tests.
export const generateShortCode = (getRandomBytes = defaultRandomBytes) => {
  const bytes = getRandomBytes(CODE_DATA_LENGTH);
  let data = '';
  for (let i = 0; i < CODE_DATA_LENGTH; i++) {
    data += CODE_ALPHABET[bytes[i] % N];
  }
  return data + luhnCheckChar(data);
};

// Generate `count` distinct codes. `seen` lets a caller carry over IDs already
// present in the datastore so a batch mint never re-issues an existing code.
export const generateUniqueCodes = (count, getRandomBytes = defaultRandomBytes, seen = new Set()) => {
  const out = [];
  let guard = 0;
  const maxAttempts = count * 20 + 50;
  while (out.length < count && guard < maxAttempts) {
    guard++;
    const code = generateShortCode(getRandomBytes);
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  if (out.length < count) {
    throw new Error(`Could not generate ${count} unique codes after ${guard} attempts`);
  }
  return out;
};
