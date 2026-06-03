/**
 * utils.js
 * Pure utility helpers with no imports.
 */

/**
 * Shallow-copies a plain array.
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function copyArray(arr) {
  return arr.slice();
}

/**
 * Returns true when two arrays have identical primitive values.
 * @param {any[]} a
 * @param {any[]} b
 * @returns {boolean}
 */
export function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Returns the index of `value` in `arr`, or -1 if not found.
 * Equivalent to Array.prototype.indexOf but used for numbers.
 * @param {number} value
 * @param {number[]} arr
 * @returns {number}
 */
export function indexInArray(value, arr) {
  return arr.indexOf(value);
}

/**
 * Returns true when `arr` contains `value`.
 * @param {any[]} arr
 * @param {any} value
 * @returns {boolean}
 */
export function includes(arr, value) {
  return arr.includes(value);
}

/**
 * Compares two [x, y, dir, status?] spot tuples.
 * @param {any[]} a
 * @param {any[]} b
 * @returns {boolean}
 */
export function spotsEqual(a, b) {
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Triggers a file download in the browser without any library dependency.
 * @param {Blob} blob
 * @param {string} filename
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
