// ===============================
// 📌 General Utility Functions
// ===============================

/**
 * Group an array of objects by kommun name.
 * @param {Array} data - Array of objects containing a `kommun` field.
 * @returns {Object} - Map: kommun → array of rows.
 */
export function groupByKommun(data) {
  const map = {};

  data.forEach(row => {
    const key = row.kommun || row.municipality || row.municipality_name;
    if (!key) return;

    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(row);
  });

  return map;
}

/**
 * Compute the average of an array of numbers.
 * @param {Array<number>} arr
 * @returns {number}
 */
export function average(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, v) => sum + Number(v), 0) / arr.length;
}

/**
 * Compute Pearson correlation between two numeric arrays.
 * @param {Array<number>} xs
 * @param {Array<number>} ys
 * @returns {number}
 */
export function correlation(xs, ys) {
  if (xs.length !== ys.length || xs.length === 0) return 0;

  const n = xs.length;
  const meanX = average(xs);
  const meanY = average(ys);

  let num = 0, denX = 0, denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  return num / Math.sqrt(denX * denY);
}

/**
 * Safely extract a numeric field from an object.
 * @param {Object} obj
 * @param {string} key
 * @returns {number|null}
 */
export function num(obj, key) {
  const v = Number(obj[key]);
  return isNaN(v) ? null : v;
}

/**
 * Convert a dataset into a simple array of numbers for a given key.
 * @param {Array} data
 * @param {string} key
 * @returns {Array<number>}
 */
export function extractNumeric(data, key) {
  return data
    .map(row => num(row, key))
    .filter(v => v !== null);
}

/**
 * Group data by a custom key function.
 * @param {Array} data
 * @param {Function} keyFn
 * @returns {Object}
 */
export function groupBy(data, keyFn) {
  const map = {};
  data.forEach(row => {
    const key = keyFn(row);
    if (!map[key]) map[key] = [];
    map[key].push(row);
  });
  return map;
}

/**
 * Compute mean for each group in a grouped dataset.
 * @param {Object} groupedData - { groupName: [rows] }
 * @param {string} key - numeric field to average
 * @returns {Object} - { groupName: meanValue }
 */
export function meanByGroup(groupedData, key) {
  const result = {};
  for (const group in groupedData) {
    const values = extractNumeric(groupedData[group], key);
    result[group] = average(values);
  }
  return result;
}

/**
 * Sort an array of objects by a numeric key.
 * @param {Array} data
 * @param {string} key
 * @param {boolean} desc
 * @returns {Array}
 */
export function sortByNumeric(data, key, desc = false) {
  return [...data].sort((a, b) => {
    const x = Number(a[key]);
    const y = Number(b[key]);
    return desc ? y - x : x - y;
  });
}
