/** Currency helpers — all money is rounded to 2 decimals at every boundary. */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const toNumber = (n) => (n === null || n === undefined || n === '' ? 0 : Number(n));
module.exports = { round2, toNumber };
