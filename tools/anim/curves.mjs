// Animation curve helpers: monotone cubic key curves and spring follow-through.

// Monotone piecewise-cubic Hermite curve (Fritsch–Butland slopes).
// No overshoot between keys, zero slope at local extrema and at both ends,
// so every pose eases in and out naturally.
export class Curve {
  constructor(keys) {
    const ks = [...keys].sort((a, b) => a[0] - b[0]);
    this.t = ks.map((k) => k[0]);
    this.v = ks.map((k) => k[1]);
    const n = this.t.length;
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((this.v[i + 1] - this.v[i]) / (this.t[i + 1] - this.t[i]));
    const m = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) continue;
      const h0 = this.t[i] - this.t[i - 1];
      const h1 = this.t[i + 1] - this.t[i];
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
    // Optional explicit slopes: keys may carry a third element (slope).
    ks.forEach((k, i) => {
      if (k.length > 2 && k[2] !== undefined) m[i] = k[2];
    });
    this.m = m;
  }

  at(x) {
    const { t, v, m } = this;
    const n = t.length;
    if (n === 1 || x <= t[0]) return v[0];
    if (x >= t[n - 1]) return v[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= x) lo = mid;
      else hi = mid;
    }
    const h = t[hi] - t[lo];
    const s = (x - t[lo]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * v[lo] +
      (s3 - 2 * s2 + s) * h * m[lo] +
      (-2 * s3 + 3 * s2) * v[hi] +
      (s3 - s2) * h * m[hi]
    );
  }
}

export const K = (...keys) => new Curve(keys);

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, s) => a + (b - a) * s;
export const smoothstep = (a, b, x) => {
  const s = clamp((x - a) / (b - a), 0, 1);
  return s * s * (3 - 2 * s);
};
export const smootherstep = (a, b, x) => {
  const s = clamp((x - a) / (b - a), 0, 1);
  return s * s * s * (s * (s * 6 - 15) + 10);
};

// Damped spring that follows a target signal: gives organic lag, overshoot
// and settle (follow-through / overlapping action) to secondary channels.
// Returns a function of time sampled from a fine pre-simulated table.
export function spring(targetFn, { hz = 3, zeta = 0.6, t0 = 0, t1 = 2.5, dt = 1 / 1200 } = {}) {
  const w = 2 * Math.PI * hz;
  const n = Math.ceil((t1 - t0) / dt) + 1;
  const xs = new Float64Array(n);
  let x = targetFn(t0);
  let vel = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt;
    xs[i] = x;
    const acc = w * w * (targetFn(t) - x) - 2 * zeta * w * vel;
    vel += acc * dt;
    x += vel * dt;
  }
  return (t) => {
    const f = clamp((t - t0) / dt, 0, n - 1);
    const i = Math.floor(f);
    const j = Math.min(n - 1, i + 1);
    return lerp(xs[i], xs[j], f - i);
  };
}
