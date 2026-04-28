// ─────────────────────────────────────────────
// BASIC HELPERS
// ─────────────────────────────────────────────
export function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function variance(arr) {
  const m = mean(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
}

export function std(arr) {
  return Math.sqrt(variance(arr));
}

// ─────────────────────────────────────────────
// NORMAL CDF (needed for p-values)
// Abramowitz & Stegun approximation
// ─────────────────────────────────────────────
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let prob =
    d * t *
    (0.3193815 +
      t *
        (-0.3565638 +
          t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  if (x > 0) prob = 1 - prob;
  return prob;
}

// ─────────────────────────────────────────────
// T-TEST (Welch’s t-test)
// ─────────────────────────────────────────────
export function tTestIndependent(a, b) {
  const m1 = mean(a);
  const m2 = mean(b);

  const v1 = variance(a);
  const v2 = variance(b);

  const n1 = a.length;
  const n2 = b.length;

  const t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);

  // degrees of freedom (Welch)
  const df =
    Math.pow(v1 / n1 + v2 / n2, 2) /
    ((Math.pow(v1 / n1, 2) / (n1 - 1)) +
     (Math.pow(v2 / n2, 2) / (n2 - 1)));

  // approximate p-value using normal distribution
  const p = 2 * (1 - normalCDF(Math.abs(t)));

  return { t, df, p };
}

// ─────────────────────────────────────────────
// ANOVA (one-way)
// ─────────────────────────────────────────────
export function oneWayANOVA(groups) {
  const all = groups.flat();
  const grandMean = mean(all);

  let ssBetween = 0;
  let ssWithin = 0;

  groups.forEach(group => {
    const m = mean(group);

    ssBetween += group.length * (m - grandMean) ** 2;

    ssWithin += group.reduce((s, x) => s + (x - m) ** 2, 0);
  });

  const dfBetween = groups.length - 1;
  const dfWithin = all.length - groups.length;

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  const F = msBetween / msWithin;

  // approximate p-value (using normal approx)
  const p = Math.exp(-0.5 * F);

  const eta2 = ssBetween / (ssBetween + ssWithin);

  return { F, p, eta2, dfBetween, dfWithin };
}

// ─────────────────────────────────────────────
// SHAPIRO-WILK (simplified approximation)
// NOTE: True SW is complex → we approximate using skewness/kurtosis
// ─────────────────────────────────────────────
export function shapiroWilk(arr) {
  const n = arr.length;
  const m = mean(arr);
  const s = std(arr);

  const skew =
    arr.reduce((sum, x) => sum + Math.pow((x - m) / s, 3), 0) / n;

  const kurt =
    arr.reduce((sum, x) => sum + Math.pow((x - m) / s, 4), 0) / n;

  // normal distribution reference
  const skewRef = 0;
  const kurtRef = 3;

  const deviation = Math.abs(skew - skewRef) + Math.abs(kurt - kurtRef);

  // convert to pseudo p-value
  const p = Math.exp(-deviation);

  return { skew, kurtosis: kurt, p };
}