/**
 * The whole disc in one fragment shader: the passive film, the traces that wake under a lifted puck, the glowing dock
 * pads and the concentric bands. Working in stage units (centre 0,0, y up, rim at 50) keeps every shape resolution-free.
 * Colours are linear; anything above 1 is picked up by the bloom pass.
 */
export const filmVertex = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const filmFragment = /* glsl */ `
precision highp float;
varying vec2 vP;

uniform float uTime, uPx;
uniform float uWake, uWakeR;
uniform vec2 uWakeO;
uniform vec3 uAccent, uGold;

uniform vec2 uDock[2];
uniform float uDockR;
uniform vec2 uDockGlow, uDockNear, uDockTaken;
uniform vec3 uDockCol[2];
uniform vec4 uShock[2];       // age in s (below 0 = off), rgb

uniform vec2 uSeat[2];        // where the puck on each dock really is
uniform vec4 uPucks[7];       // simulated pucks only: x, y, radius, lift
uniform vec4 uSockets[7];     // x, y, light, pulse
uniform vec3 uSocketCol[7];
uniform float uPuckR;

uniform float uR0, uW, uG;
uniform float uFrac[8];       // lane * 4 + track
uniform float uMarks[28];     // track * 7 + chip
uniform vec2 uSpan, uGain, uStreams;
uniform vec3 uCol[2];
uniform vec4 uTrackHi;

const float PI = 3.14159265;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float ring(float d, float w) { return 1.0 - smoothstep(w - uPx, w + uPx, abs(d)); }
float sdRound(vec2 p, vec2 b, float c) {
  vec2 q = abs(p) - b + c;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - c;
}

/** Dormant silicon: a soft pool of light, a faint reticle and a slow diffraction sheen, as on a real wafer. */
vec3 substrate(vec2 p, float r, float a) {
  vec3 c = mix(vec3(0.0085, 0.0105, 0.0175), vec3(0.0022, 0.0026, 0.0048), smoothstep(4.0, 50.0, r));
  float sheen = pow(0.5 + 0.5 * cos(a * 2.0 - uTime * 0.07), 5.0) * smoothstep(50.0, 14.0, r);
  vec3 iri = 0.5 + 0.5 * cos(6.283 * (r * 0.021 + a * 0.16 + vec3(0.0, 0.33, 0.67)) + uTime * 0.04);
  c += iri * sheen * 0.007;
  vec2 g = abs(fract(p / 7.0 + 0.5) - 0.5) * 7.0;
  c += vec3(0.55, 0.6, 0.78) * (1.0 - smoothstep(0.0, uPx * 1.3, min(g.x, g.y))) * 0.0042;
  return c;
}

/** Traces wake in a ripple spreading from the lifted puck, and light runs along them toward the docks. */
vec3 wake(vec2 p) {
  if (uWake < 0.002) return vec3(0.0);
  float dO = distance(p, uWakeO);
  float reveal = smoothstep(uWakeR, uWakeR - 14.0, dO) * uWake;
  vec2 q = p / 2.8;
  vec2 id = floor(q), f = fract(q) - 0.5;
  if (hash(id) < 0.5) f.x = -f.x;
  float d = abs(abs(f.x + f.y) - 0.5) / 1.414 * 2.8;
  float trace = (1.0 - smoothstep(0.055, 0.055 + uPx * 1.3, d)) * step(0.42, hash(id + 7.0));
  float dockD = min(distance(p, uDock[0]), distance(p, uDock[1]));
  float run = pow(0.5 + 0.5 * sin(dockD * 0.42 + uTime * 3.0), 14.0);
  float toward = smoothstep(46.0, 9.0, dockD);
  float outsidePad = smoothstep(uDockR - 0.4, uDockR + 1.6, dockD);
  vec3 c = uAccent * trace * reveal * outsidePad * (0.012 + 0.026 * toward + run * 0.42 * toward);
  c += uAccent * reveal * 0.0028 * (0.4 + toward);
  c += uAccent * ring(dO - uWakeR + 1.0, 0.3) * uWake * (1.0 - smoothstep(24.0, 100.0, uWakeR)) * 0.55;
  return c;
}

vec3 dockPad(vec2 p, int i) {
  vec2 v = p - uDock[i];
  float d = length(v), ang = atan(v.y, v.x);
  float glow = uDockGlow[i], near = uDockNear[i], taken = uDockTaken[i];
  vec3 col = uDockCol[i];
  float R = uDockR - near * 0.35;
  float breathe = 0.72 + 0.28 * sin(uTime * 2.5 + float(i) * 1.7);

  // Asleep, the pad is only an engraving in the film.
  vec3 c = mix(uGold, col, taken) * ring(d - uDockR, 0.09) * (0.075 + 0.05 * sin(uTime * 0.9));
  c += col * exp(-pow(max(d - R, 0.0) / (2.3 + near * 2.4), 2.0)) * step(R, d) * glow * breathe * 0.2;
  c += col * smoothstep(R, 0.0, d) * glow * (0.022 + near * 0.11);
  c += col * ring(d - R, 0.13) * glow * (0.85 + near * 1.5) * breathe;
  float dash = smoothstep(0.42, 0.5, abs(fract((ang + uTime * (0.32 + near * 1.3)) * 14.0 / 6.283) - 0.5));
  c += col * ring(d - (R - 1.15), 0.085) * dash * glow * 0.5;
  // A seated puck stands in light that leaks from under it, centred on where it was actually put down.
  float ds = length(p - uSeat[i]);
  c += col * exp(-pow((ds - uPuckR) / 1.5, 2.0)) * step(uPuckR - 0.5, ds) * taken * (0.3 + 0.07 * sin(uTime * 1.4));
  c += col * ring(ds - uPuckR - 0.5, 0.1) * taken * 0.85;

  float age = uShock[i].x;
  if (age >= 0.0) {
    vec3 s = uShock[i].yzw;
    float fade = exp(-age * 3.4);
    c += s * ring(d - (uDockR + age * 36.0), 0.16 + age * 0.24) * fade * 1.6;
    c += s * ring(d - (uDockR + max(age - 0.12, 0.0) * 24.0), 0.1 + age * 0.14) * fade * 0.7;
    c += s * exp(-d * d / 90.0) * exp(-age * 5.0) * 0.7;
  }
  return c;
}

/** One lane of colour along a track. The motion carries data: streams count processors, flow rate follows reach. */
vec3 band(float phi, float dr, float rc, float hw, int lane, int track, float eps) {
  float f = uFrac[lane * 4 + track];
  float gain = uGain[lane];
  if (f < 0.001 || gain < 0.002) return vec3(0.0);
  vec3 col = uCol[lane];
  float L = max(f * uSpan[lane] * rc, 1.6);
  float s = phi * rc;
  float d = sdRound(vec2(s - L * 0.5, dr), vec2(L * 0.5, hw), 1.05);
  float inside = 1.0 - smoothstep(-eps, eps, d);
  vec3 c = col * exp(-max(d, 0.0) / 0.55) * 0.05 * gain * step(0.0, d);
  if (inside <= 0.0) return c;

  float t = clamp(s / L, 0.0, 1.0);
  // The first stretch stays dark so the words printed there can be read.
  float body = mix(0.11, 0.66, smoothstep(0.0, 1.0, t) * smoothstep(5.0, 24.0, s));
  vec3 fill = col * body;
  float rate = 0.3 + f * f * 2.6;

  if (track == 2) {                       // processors: one stream per core
    float n = uStreams[lane];
    float v = (dr / hw * 0.5 + 0.5) * n;
    float id = floor(v);
    float groove = smoothstep(0.0, 0.14, 0.5 - abs(fract(v) - 0.5));
    float beat = fract((s - uTime * (5.0 + 3.0 * hash(vec2(id, 3.0))) + hash(vec2(id, 9.0)) * 40.0) / (13.0 + 8.0 * hash(vec2(id, 5.0))));
    fill = fill * mix(0.34, 1.0, groove) + col * smoothstep(0.0, 0.9, beat) * smoothstep(1.0, 0.94, beat) * groove * 1.1 * t;
  } else if (track == 1) {                // speed: pulses whose pace is the clock
    float beat = fract((s - uTime * rate * 8.0) / 8.0);
    fill += col * smoothstep(0.0, 0.8, beat) * smoothstep(1.0, 0.84, beat) * 0.62 * t;
  } else if (track == 0) {                // power: heat shimmer that grows with the watts
    float h = noise(vec2(s * 0.3 - uTime * 0.9, dr * 0.75 + uTime * 0.55)) * noise(vec2(s * 0.11 + uTime * 0.35, dr * 0.3));
    fill += mix(col, vec3(1.0, 0.86, 0.72), 0.35) * h * h * f * 3.4 * t;
  } else {                                // year: a long slow swell
    fill += col * pow(0.5 + 0.5 * sin(s * 0.3 - uTime * 0.9), 3.0) * 0.42 * t;
  }

  // The leading edge runs hot, which is what the bloom catches.
  float head = exp(-pow(max(L - s, 0.0) / 1.2, 2.0)) * smoothstep(1.6, 14.0, L);
  fill += col * head * 1.15 + vec3(1.0) * head * head * 0.3;
  return mix(c, fill * gain, inside);
}

vec3 dial(vec2 p, float r) {
  float pitch = uW + uG;
  float outer = uR0 + 4.0 * pitch;
  if (r < uR0 - 3.0 || r > outer + 3.0 || p.y < -3.0) return vec3(0.0);
  int track = int(clamp(floor((r - uR0 + uG * 0.5) / pitch), 0.0, 3.0));
  float rc = uR0 + uW * 0.5 + float(track) * pitch;
  float hw = uW * 0.5;
  float dr = r - rc;
  float phiL = atan(p.y, -p.x);
  if (phiL < -PI * 0.5) phiL += 2.0 * PI;
  float phiR = PI - phiL;
  float eps = uPx * 0.9;

  // The empty groove.
  float half_ = PI * 0.5 * rc;
  float dT = sdRound(vec2(phiL * rc - half_, dr), vec2(half_, hw), 1.05);
  float inT = 1.0 - smoothstep(-eps, eps, dT);
  float hi = uTrackHi[track];
  vec3 c = vec3(0.0085, 0.0105, 0.0175) * inT * (1.0 + hi * 3.0);
  c += vec3(0.42, 0.45, 0.56) * ring(dT, 0.045) * (0.03 + hi * 0.3);

  vec3 l0 = band(phiL, dr, rc, hw, 0, track, eps);
  vec3 l1 = band(phiR, dr, rc, hw, 1, track, eps);
  c = c + l0 + l1;

  // A notch for every chip, so a band's reach reads against the whole family.
  for (int lane = 0; lane < 2; lane++) {
    float gain = uGain[lane];
    if (gain < 0.01) continue;
    float s = (lane == 0 ? phiL : phiR) * rc;
    for (int j = 0; j < 7; j++) {
      float ms = uMarks[track * 7 + j] * uSpan[lane] * rc;
      float md = length(vec2(s - ms, dr - hw + 0.72));
      c += vec3(0.9, 0.92, 1.0) * (1.0 - smoothstep(0.21 - uPx, 0.21 + uPx, md)) * 0.15 * gain * inT;
    }
  }
  return c * smoothstep(-2.6, -0.2, p.y);
}

/** Each puck at rest glows at its edge in its era's colour; a socket waiting for its puck pulses gently. */
vec3 sockets(vec2 p) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    vec4 k = uSockets[i];
    float d = length(p - k.xy) - uPuckR;
    c += uSocketCol[i] * exp(-pow(max(d, 0.0) / 1.0, 2.0)) * step(-0.5, d) * k.z * 0.42;
    c += uSocketCol[i] * ring(d - 0.5, 0.09) * k.w * (0.4 + 0.3 * sin(uTime * 2.4));
  }
  return c;
}

void main() {
  vec2 p = vP;
  float r = length(p);
  if (r > 50.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float a = atan(p.y, p.x);

  vec3 c = substrate(p, r, a);
  c += wake(p);
  c += dockPad(p, 0) + dockPad(p, 1);
  c += sockets(p);
  c += dial(p, r);

  // Shadows fall last, so a lifted puck darkens the bands it passes over too.
  for (int i = 0; i < 7; i++) {
    vec4 k = uPucks[i];
    float d = length(p - k.xy - vec2(k.w * 0.5, -k.w * 0.85)) - k.z;
    float soft = 0.75 + k.w * 1.5;
    c *= 1.0 - (1.0 - smoothstep(-soft, soft, d)) * mix(0.88, 0.62, clamp(k.w * 0.25, 0.0, 1.0));
  }

  c += uGold * ring(r - 49.55, 0.05) * 0.045;
  c *= 1.0 - smoothstep(49.7, 50.05, r);
  gl_FragColor = vec4(c, 1.0);
}`;

/** A trace from a dock to the foot of a band. `uReach` draws it out; pulses then keep running along it. */
export const conduitVertex = /* glsl */ `
attribute float along;
varying float vS;
void main() {
  vS = along;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const conduitFragment = /* glsl */ `
precision highp float;
varying float vS;
uniform float uTime, uReach, uLen, uGain;
uniform vec3 uColor;
void main() {
  float s = vS * uLen;
  float shown = 1.0 - smoothstep(uReach * uLen - 1.0, uReach * uLen, s);
  float beat = pow(fract((s - uTime * 14.0) / 11.0), 6.0);
  vec3 c = uColor * (0.12 + beat * 1.0);
  gl_FragColor = vec4(c * shown * uGain, 1.0);
}`;
