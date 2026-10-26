// Real-time model of the twin towers: the home-page hero and the full-screen 3D explorer.
// Everything is procedural (no texture files), so it also runs when the site is opened from disk.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sunPosition } from './sun.js';
import { PROJECT, ZONES, TOWER_STACK, zoneAt } from '../data/project.js';

// ---------------------------------------------------------------- massing (metres)
const M = PROJECT.massing;
const FLOOR_H = M.floorHeight;
const TOWER_H = M.floors * FLOOR_H;
const TOP_H = TOWER_H + M.crown;
const PODIUM_H = M.podiumFloors * M.podiumFloorHeight;
const SITE_ROTATION = THREE.MathUtils.degToRad(M.siteRotationDeg);

// Camera keyframes for the hero; scroll progress blends between them.
const SHOTS = [
  { pos: [235, 52, 255], target: [0, 78, 0], fov: 36 },
  { pos: [150, 120, 175], target: [0, 112, 0], fov: 38 },
  { pos: [70, 205, 120], target: [-60, 135, -260], fov: 46 },
];
const INTRO = { pos: [62, 4, 92], target: [0, 92, 0], fov: 52 };

// ---------------------------------------------------------------- sky palette by sun altitude (deg)
const SKY_KEYS = [
  { alt: -18, top: '#03050a', horizon: '#0b1220', sun: '#000000', hemi: 0.12, sunI: 0, night: 1, bloom: 1.05, exposure: 1.15 },
  { alt: -6, top: '#0a1430', horizon: '#3d3a5c', sun: '#2a2140', hemi: 0.22, sunI: 0, night: 0.92, bloom: 0.95, exposure: 1.1 },
  { alt: -1, top: '#1d3263', horizon: '#c0746a', sun: '#ff8a5c', hemi: 0.38, sunI: 0.5, night: 0.7, bloom: 0.75, exposure: 1.02 },
  { alt: 4, top: '#36598f', horizon: '#f2a26b', sun: '#ffb27a', hemi: 0.6, sunI: 2.0, night: 0.25, bloom: 0.45, exposure: 0.95 },
  { alt: 12, top: '#3e69a3', horizon: '#f0c9a0', sun: '#ffd8b0', hemi: 0.85, sunI: 3.0, night: 0, bloom: 0.22, exposure: 0.92 },
  { alt: 35, top: '#2f63a6', horizon: '#c4d8e8', sun: '#fff6ea', hemi: 1.0, sunI: 3.4, night: 0, bloom: 0.14, exposure: 0.9 },
];

function samplePalette(altDeg) {
  const keys = SKY_KEYS;
  const clamped = THREE.MathUtils.clamp(altDeg, keys[0].alt, keys[keys.length - 1].alt);
  let i = 0;
  while (i < keys.length - 2 && clamped > keys[i + 1].alt) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const f = (clamped - a.alt) / (b.alt - a.alt);
  const mixColor = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), f);
  const mixNum = (x, y) => x + (y - x) * f;
  return {
    top: mixColor(a.top, b.top),
    horizon: mixColor(a.horizon, b.horizon),
    sun: mixColor(a.sun, b.sun),
    hemi: mixNum(a.hemi, b.hemi),
    sunI: mixNum(a.sunI, b.sunI),
    night: mixNum(a.night, b.night),
    bloom: mixNum(a.bloom, b.bloom),
    exposure: mixNum(a.exposure, b.exposure),
  };
}

// ---------------------------------------------------------------- shaders
const FACADE_VERTEX_PARS = /* glsl */ `
varying vec3 vAxLocal;
varying vec3 vAxNormal;
varying float vAxSeed;
#ifdef AX_ATTR
attribute vec2 aFacade;
#endif
`;

const FACADE_VERTEX = /* glsl */ `
#include <begin_vertex>
#ifdef AX_ATTR
  // twisted towers: u runs along the (untwisted) perimeter, y is height above ground
  vAxLocal = vec3(aFacade, 0.0);
  vAxNormal = vec3(1.0, 0.0, 0.0);
  vAxSeed = 0.0;
#else
  vAxLocal = transformed;
  vAxNormal = objectNormal;
  vAxSeed = 0.0;
  #ifdef USE_INSTANCING
    vAxLocal *= vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vAxSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  #endif
#endif
`;

const FACADE_FRAGMENT_PARS = /* glsl */ `
varying vec3 vAxLocal;
varying vec3 vAxNormal;
varying float vAxSeed;
uniform float uFloorH;
uniform float uColW;
uniform vec2 uHalf;
uniform float uNight;
uniform float uHover;
uniform float uMode;
uniform float uScan;
uniform float uRow;
uniform float uTime;
uniform sampler2D uFuncTex;
uniform float uTopH;

float axHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

struct AxSurface { vec3 color; float rough; float metal; vec3 emit; };

AxSurface axSurface() {
  AxSurface s;
#ifdef AX_ATTR
  float horizontal = 0.0;
  float y = vAxLocal.y;
  float u = vAxLocal.x;
  float face = 0.0;
#else
  vec3 n = normalize(vAxNormal);
  float horizontal = step(0.5, abs(n.y));
  float y = vAxLocal.y;
  float sideX = step(0.5, abs(n.x));
  float u = mix(vAxLocal.x + uHalf.x, vAxLocal.z + uHalf.y, sideX);
  float face = sideX > 0.5 ? (n.x > 0.0 ? 1.0 : 2.0) : (n.z > 0.0 ? 3.0 : 4.0);
#endif
  float fl = floor(y / uFloorH);
  float fy = fract(y / uFloorH);
  float col = floor(u / uColW);
  float fx = fract(u / uColW);
  float rnd = axHash(vec2(col + face * 97.0 + vAxSeed * 131.0, fl * 1.7 + vAxSeed * 71.0));
  vec3 warm = mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.84, 0.62), axHash(vec2(rnd * 31.0, fl)));

#if AX_TYPE == 0
  // dark glass curtain wall: slab spandrels + slim mullions
  vec4 fn = texture2D(uFuncTex, vec2((fl + 0.5) / 64.0, (uRow + 0.5) / 4.0));
  float slab = step(fy, 0.075);
  float mull = max(step(fx, 0.03), step(0.97, fx));
  float frame = max(slab, mull);
  float lit = step(1.0 - fn.a, rnd) * uNight * (1.0 - frame);
  s.color = mix(vec3(0.012, 0.016, 0.022), vec3(0.045, 0.048, 0.052), frame);
  s.rough = mix(0.035, 0.42, frame);
  s.metal = mix(0.12, 0.7, frame);
  s.emit = warm * lit * (0.55 + 1.1 * smoothstep(0.15, 0.95, fy)) * 1.7;
#elif AX_TYPE == 1
  // white stone frame with punched windows; every second pier reads slightly deeper
  vec4 fn = texture2D(uFuncTex, vec2((fl + 0.5) / 64.0, (uRow + 0.5) / 4.0));
  float win = step(0.17, fx) * step(fx, 0.83) * step(0.14, fy) * step(fy, 0.9);
  float pier = step(fx, 0.07) * step(mod(col, 2.0), 0.5);
  vec3 stone = vec3(0.78, 0.74, 0.66) * (0.95 + 0.05 * axHash(vec2(col * 3.1, fl * 1.3)));
  stone *= 1.0 - 0.14 * pier - 0.1 * step(fy, 0.05);
  float lit = step(1.0 - fn.a, rnd) * uNight * win;
  s.color = mix(stone, vec3(0.018, 0.022, 0.028), win);
  s.rough = mix(0.86, 0.05, win);
  s.metal = mix(0.0, 0.25, win);
  s.emit = warm * lit * (0.6 + 0.9 * smoothstep(0.2, 0.9, fy)) * 1.5;
#elif AX_TYPE == 2
  // podium: double-height shopfronts at street level, stone bands above
  vec4 fn = vec4(0.0);
  float street = step(y, uFloorH * 1.35);
  float glassBand = street * step(0.06, fx) * step(fx, 0.94) * step(0.08, y / (uFloorH * 1.35));
  float band = (1.0 - street) * step(0.55, fy) * step(fy, 0.92) * step(0.08, fx) * step(fx, 0.92);
  float glass = max(glassBand, band);
  vec3 stone = vec3(0.70, 0.66, 0.59);
  float lit = uNight * glass * (street > 0.5 ? 1.0 : step(0.55, rnd));
  s.color = mix(stone, vec3(0.02, 0.025, 0.03), glass);
  s.rough = mix(0.8, 0.06, glass);
  s.metal = mix(0.0, 0.2, glass);
  s.emit = mix(warm, vec3(1.0, 0.9, 0.78), street) * lit * (street > 0.5 ? 2.2 : 1.2);
#else
  // surrounding city blocks
  vec4 fn = vec4(0.0);
  float win = step(0.22, fx) * step(fx, 0.78) * step(0.32, fy) * step(fy, 0.86);
  vec3 wall = mix(vec3(0.30, 0.28, 0.26), vec3(0.56, 0.52, 0.46), vAxSeed);
  float lit = step(0.7, rnd) * uNight * win;
  s.color = mix(wall, vec3(0.05, 0.055, 0.06), win * 0.85);
  s.rough = mix(0.92, 0.35, win);
  s.metal = 0.0;
  s.emit = warm * lit * 0.85;
#endif

  // roofs and soffits
  s.color = mix(s.color, vec3(0.09, 0.09, 0.095), horizontal);
  s.rough = mix(s.rough, 0.92, horizontal);
  s.metal = mix(s.metal, 0.0, horizontal);
  s.emit *= 1.0 - horizontal;

#if AX_TYPE < 2
  // crown: solid parapet above the last floor, with a thin light line on top at night
  float crown = step(uTopH, y);
  vec3 crownCol = AX_TYPE == 0 ? vec3(0.03, 0.032, 0.036) : vec3(0.74, 0.70, 0.62);
  s.color = mix(s.color, crownCol, crown);
  s.rough = mix(s.rough, AX_TYPE == 0 ? 0.3 : 0.85, crown);
  s.metal = mix(s.metal, AX_TYPE == 0 ? 0.6 : 0.0, crown);
  s.emit = mix(s.emit, vec3(1.0, 0.8, 0.55) * uNight * 1.6 * step(uTopH + 3.9, y), crown);
  // hovered floor glows, with brighter slab edges
  float hov = (1.0 - step(0.5, abs(fl - uHover))) * (1.0 - crown);
  vec3 accent = vec3(1.0, 0.72, 0.38);
  s.emit += accent * hov * (0.5 + 1.6 * step(fy, 0.05) + 1.6 * step(0.95, fy));
  // colour-coded uses
  float tint = uMode * (1.0 - crown);
  s.color = mix(s.color, fn.rgb * 0.55, tint * 0.85);
  s.emit += fn.rgb * tint * (0.28 + 0.5 * step(fy, 0.04));
#endif

  // scanner line sweeping up the facades during the intro
  float scan = exp(-pow((y - uScan) * 0.45, 2.0)) * step(0.0, uScan) * (1.0 - horizontal);
  s.emit += vec3(1.0, 0.78, 0.5) * scan * 3.0;
  return s;
}
`;

function facadeMaterial(type, uniforms, options = {}) {
  const Material = type === 0 ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const { facadeAttr, ...params } = options;
  const material = new Material({ color: 0xffffff, roughness: 1, metalness: 0, ...params });
  if (type === 0) material.ior = 2.0; // coated glazing: stronger reflections than plain glass
  material.defines = { ...material.defines, AX_TYPE: type }; // keep STANDARD/PHYSICAL
  if (options.facadeAttr) material.defines.AX_ATTR = '';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = FACADE_VERTEX_PARS + shader.vertexShader.replace('#include <begin_vertex>', FACADE_VERTEX);
    shader.fragmentShader = FACADE_FRAGMENT_PARS + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nAxSurface ax = axSurface();\ndiffuseColor.rgb = ax.color;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = ax.rough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = ax.metal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ax.emit;');
  };
  return material;
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // keep the dome on the far plane
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uHorizon * 0.35, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 1400.0) * 30.0 + pow(s, 18.0) * 0.45 + pow(s, 3.0) * 0.08);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------------------------------------------------------------- helpers
function valueNoise(x, y, seed) {
  const h = (i, j) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y) {
  let total = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 5; o++) {
    total += amp * valueNoise(x * freq, y * freq, o);
    freq *= 2.03;
    amp *= 0.5;
  }
  return total;
}

// Hills around Tbilisi: higher towards the Trialeti ridge (south-west of Vake).
function hillHeight(x, z) {
  const r = Math.hypot(x, z);
  const bearing = Math.atan2(x, -z); // 0 = north, clockwise
  const ridge = 0.55 + 0.45 * Math.cos(bearing - THREE.MathUtils.degToRad(225));
  const rise = THREE.MathUtils.smoothstep(r, 1500, 3800);
  return rise * (120 + 520 * ridge) * (0.45 + fbm(x / 1400, z / 1400));
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the scene
export function createTowers(canvas, { onHover, onSelect, reducedMotion = false } = {}) {
  const small = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
  // ?shot keeps the drawing buffer so automated screenshots can read the canvas back
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__AXIS_SHOT || /[?&]shot\b/.test(location.search) });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(INTRO.fov, 1, 1, 30000);
  camera.position.set(...INTRO.pos);
  const lookTarget = new THREE.Vector3(...INTRO.target);
  camera.lookAt(lookTarget);

  // shared uniforms for every facade material
  const shared = {
    uNight: { value: 0 },
    uMode: { value: 0 },
    uScan: { value: -1 },
    uTime: { value: 0 },
    uFuncTex: { value: buildFunctionTexture() },
  };
  const towerUniforms = (row, colW, hover) => ({
    ...shared,
    uFloorH: { value: FLOOR_H },
    uColW: { value: colW },
    uHalf: { value: new THREE.Vector2(0, 0) },
    uRow: { value: row },
    uHover: hover,
    uTopH: { value: TOWER_H },
  });

  // --- sky + stars
  const skyUniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 48, 24), skyMaterial);
  sky.frustumCulled = false;
  scene.add(sky);

  const stars = buildStars();
  scene.add(stars);

  // --- site group (rotated so the massing sits on the avenue at its real bearing)
  const site = new THREE.Group();
  site.rotation.y = SITE_ROTATION;
  scene.add(site);

  const hover = { stone: { value: -10 }, glass: { value: -10 } };
  const towers = {};
  const slabs = {};
  for (const [id, cfg] of Object.entries(M.towers)) {
    const type = id === 'glass' ? 0 : 1;
    const twist = cfg.twist * THREE.MathUtils.degToRad(PROJECT.rotationPerFloorDeg);
    const mesh = new THREE.Mesh(
      twistedTower(cfg.w, cfg.d, M.cornerRadius, twist),
      facadeMaterial(type, towerUniforms(type, cfg.bay, hover[id]), { facadeAttr: true }),
    );
    mesh.position.set(cfg.x, 0, cfg.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { tower: id, twist };
    site.add(mesh);
    towers[id] = mesh;

    // roof deck inside the parapet, turned with the top floor, plus plant rooms
    const roof = new THREE.Mesh(roundedPlate(cfg.w - 1.2, cfg.d - 1.2, M.cornerRadius - 0.6), new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.95 }));
    roof.position.set(cfg.x, TOP_H - 1.2, cfg.z);
    roof.rotation.y = twist * (TOP_H / FLOOR_H);
    roof.receiveShadow = true;
    site.add(roof);
    const plant = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.42, 3.2, cfg.d * 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8 }));
    plant.position.set(cfg.x, TOP_H - 1.2 + 1.6, cfg.z);
    plant.rotation.y = roof.rotation.y;
    plant.castShadow = true;
    site.add(plant);

    // selected floor: a glowing band that hugs the facade at that floor's rotation
    const slab = new THREE.Mesh(
      twistedTower(cfg.w * 1.045, cfg.d * 1.045, M.cornerRadius * 1.045, 0, FLOOR_H * 0.94, false),
      new THREE.MeshBasicMaterial({ color: 0xffb46a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    slab.visible = false;
    slab.position.set(cfg.x, 0, cfg.z);
    site.add(slab);
    slabs[id] = slab;
  }

  // podium joins the two towers at street level
  const podium = new THREE.Mesh(
    (() => {
      const g = new THREE.BoxGeometry(M.podium.w, PODIUM_H, M.podium.d);
      g.translate(0, PODIUM_H / 2, 0);
      return g;
    })(),
    facadeMaterial(2, { ...shared, uFloorH: { value: M.podiumFloorHeight }, uColW: { value: 6 }, uHalf: { value: new THREE.Vector2(M.podium.w / 2, M.podium.d / 2) }, uRow: { value: 2 }, uHover: { value: -10 }, uTopH: { value: 1e6 } }),
  );
  podium.position.set(M.podium.x, 0, M.podium.z);
  podium.castShadow = true;
  podium.receiveShadow = true;
  site.add(podium);

  // the 25 × 9 m pool on the podium roof (glows at night)
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(M.pool.w, M.pool.d),
    new THREE.MeshStandardMaterial({ color: 0x1f8fb0, roughness: 0.08, metalness: 0.1, emissive: 0x23b5e0, emissiveIntensity: 0 }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(M.pool.x, PODIUM_H + 0.06, M.pool.z);
  site.add(pool);
  // --- ground, avenue, traffic
  const ground = buildGround(shared);
  site.add(ground);
  const traffic = buildTraffic(shared);
  site.add(traffic);
  const city = buildCity(shared, small ? 650 : 1400);
  site.add(city);

  // --- distant hills and the Mtatsminda TV tower
  const hills = buildHills();
  scene.add(hills);
  const tvTower = buildTvTower();
  scene.add(tvTower);

  // --- lights
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x2a241c, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 2200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  sun.target.position.set(0, 40, 0);

  scene.fog = new THREE.Fog(0x8899aa, 700, 9000);

  // --- environment map from the sky (glass reflections follow the time of day)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, skyMaterial));
  let envTarget = null;
  let envDirty = true;
  let lastEnvUpdate = 0;

  // --- post-processing
  let composer = null;
  let bloom = null;
  if (!small) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.55, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ------------------------------------------------------------ time of day
  const sunDir = new THREE.Vector3();
  const state = {
    date: new Date(),
    palette: null,
    scroll: 0,
    mode: 0,
    explore: false,
    introDone: reducedMotion,
    introT: reducedMotion ? 1 : 0,
    pointer: new THREE.Vector2(0, 0),
    pointerSmooth: new THREE.Vector2(0, 0),
    orbit: 0,
  };

  function setDate(date) {
    state.date = date;
    const { altitude, bearing } = sunPosition(date, PROJECT.coords.lat, PROJECT.coords.lng);
    // world: -Z = north, +X = east
    sunDir.set(Math.sin(bearing) * Math.cos(altitude), Math.sin(altitude), -Math.cos(bearing) * Math.cos(altitude)).normalize();
    const p = samplePalette(THREE.MathUtils.radToDeg(altitude));
    state.palette = p;
    skyUniforms.uTop.value.copy(p.top);
    skyUniforms.uHorizon.value.copy(p.horizon);
    skyUniforms.uSunColor.value.copy(p.sun);
    skyUniforms.uSunDir.value.copy(sunDir);
    scene.fog.color.copy(p.horizon).multiplyScalar(0.9);
    hemi.intensity = p.hemi;
    hemi.color.copy(p.top).lerp(new THREE.Color(0xffffff), 0.5);
    sun.intensity = altitude > 0 ? p.sunI : 0;
    sun.color.copy(p.sun);
    // moonlight-ish fill so the towers never vanish at night
    if (altitude <= 0) {
      sun.intensity = 0.25 * (1 - p.night) + 0.08;
      sun.color.set(0x8ea6d8);
      sunDir.set(-0.4, 0.6, 0.3).normalize();
    }
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 1200);
    shared.uNight.value = p.night;
    renderer.toneMappingExposure = p.exposure;
    stars.material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(p.night, 0.6, 1.0);
    tvTower.userData.beacons.forEach((b) => (b.material.opacity = 0.25 + 0.75 * p.night));
    if (bloom) bloom.strength = p.bloom;
    pool.material.emissiveIntensity = 0.9 * p.night;
    envDirty = true;
  }

  // ------------------------------------------------------------ interaction
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  let selected = null;
  const towerMeshes = Object.values(towers);

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(towerMeshes, false)[0];
    if (!hit) return null;
    const tower = hit.object.userData.tower;
    const local = hit.object.worldToLocal(hit.point.clone());
    const floor = THREE.MathUtils.clamp(Math.floor(local.y / FLOOR_H), 0, M.floors - 1) + 1;
    return { tower, floor, zone: zoneAt(tower, floor) };
  }

  function setHovered(info) {
    hover.stone.value = -10;
    hover.glass.value = -10;
    if (info) hover[info.tower].value = info.floor - 1;
    if (selected) hover[selected.tower].value = selected.floor - 1;
    hovered = info;
  }

  function onPointerMove(e) {
    state.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    if (e.pointerType === 'touch') return;
    const info = pick(e.clientX, e.clientY);
    const changed = (info && (!hovered || info.floor !== hovered.floor || info.tower !== hovered.tower)) || (!info && hovered);
    if (changed) setHovered(info);
    canvas.style.cursor = info ? 'pointer' : '';
    onHover?.(info, e);
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const info = pick(e.clientX, e.clientY);
    if (info) select(info.tower, info.floor);
    onSelect?.(info);
  });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', () => {
    setHovered(null);
    onHover?.(null);
  });

  function select(tower, floor) {
    Object.values(slabs).forEach((s) => (s.visible = false));
    if (!tower) {
      selected = null;
      setHovered(hovered);
      return;
    }
    selected = { tower, floor };
    const slab = slabs[tower];
    const base = (floor - 1) * FLOOR_H + FLOOR_H * 0.03;
    slab.position.y = base;
    slab.rotation.y = towers[tower].userData.twist * (base / FLOOR_H);
    slab.visible = true;
    slab.material.color.set(ZONES[zoneAt(tower, floor)]?.color || '#ffb46a');
    setHovered(hovered);
  }

  // ------------------------------------------------------------ explore mode
  let controls = null;
  function setExplore(on) {
    state.explore = on;
    if (on) {
      controls = new OrbitControls(camera, canvas);
      controls.target.copy(lookTarget);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 70;
      controls.maxDistance = 1100;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.enablePan = true;
      controls.screenSpacePanning = false;
      controls.autoRotate = !reducedMotion;
      controls.autoRotateSpeed = 0.35;
      controls.addEventListener('start', () => (controls.autoRotate = false));
    } else if (controls) {
      controls.dispose();
      controls = null;
    }
  }

  function focusTower(id) {
    if (!controls) return;
    const cfg = id ? M.towers[id] : { x: 0, z: 0 };
    const local = new THREE.Vector3(cfg.x, 75, cfg.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), SITE_ROTATION);
    tweenVector(controls.target, local, 1.2);
  }

  function tweenVector(vec, to, seconds) {
    const from = vec.clone();
    const start = performance.now();
    const step = () => {
      const t = Math.min((performance.now() - start) / (seconds * 1000), 1);
      const e = 1 - Math.pow(1 - t, 3);
      vec.lerpVectors(from, to, e);
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }

  // ------------------------------------------------------------ camera choreography
  // Shots are authored relative to the massing, then turned with it.
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpPos = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  const turn = (v) => new THREE.Vector3(...v).applyAxisAngle(UP, SITE_ROTATION);
  const shotPos = SHOTS.map((s) => turn(s.pos));
  const shotTarget = SHOTS.map((s) => turn(s.target));
  const introPos = turn(INTRO.pos);
  const introTarget = turn(INTRO.target);

  function heroCamera(time) {
    const p = THREE.MathUtils.clamp(state.scroll, 0, 1) * (SHOTS.length - 1);
    const i = Math.min(Math.floor(p), SHOTS.length - 2);
    const f = THREE.MathUtils.smootherstep(p - i, 0, 1);
    tmpPos.lerpVectors(shotPos[i], shotPos[i + 1], f);
    tmpTarget.lerpVectors(shotTarget[i], shotTarget[i + 1], f);
    let fov = SHOTS[i].fov + (SHOTS[i + 1].fov - SHOTS[i].fov) * f;

    // slow drift + pointer parallax
    if (!reducedMotion) {
      state.orbit = Math.sin(time * 0.00006) * 0.22;
      state.pointerSmooth.lerp(state.pointer, 0.04);
    }
    const angle = state.orbit - state.pointerSmooth.x * 0.08;
    tmpPos.sub(tmpTarget).applyAxisAngle(UP, angle).add(tmpTarget);
    tmpPos.y += -state.pointerSmooth.y * 8;

    // intro: rise from street level
    if (state.introT < 1) {
      const e = 1 - Math.pow(1 - state.introT, 4);
      tmpPos.lerpVectors(introPos, tmpPos, e);
      tmpTarget.lerpVectors(introTarget, tmpTarget, e);
      fov = INTRO.fov + (fov - INTRO.fov) * e;
    }
    camera.position.copy(tmpPos);
    lookTarget.copy(tmpTarget);
    camera.lookAt(lookTarget);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  function playIntro(duration = 4.2) {
    if (reducedMotion) {
      state.introT = 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const step = () => {
        const t = Math.min((performance.now() - start) / (duration * 1000), 1);
        state.introT = t;
        shared.uScan.value = t < 0.95 ? t * (TOP_H + 30) - 10 : -1;
        if (t < 1) requestAnimationFrame(step);
        else {
          state.introDone = true;
          resolve();
        }
      };
      step();
    });
  }

  // ------------------------------------------------------------ loop
  let running = false;
  let visible = true;
  let lastFrame = performance.now();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    // keep the towers framed on portrait screens
    camera.zoom = camera.aspect < 0.8 ? 0.62 + camera.aspect * 0.3 : 1;
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    shared.uTime.value += dt;
    traffic.material.uniforms.uTime.value = shared.uTime.value;
    stars.material.uniforms.uTime.value = shared.uTime.value;

    if (envDirty && now - lastEnvUpdate > 200) {
      envTarget?.dispose();
      envTarget = pmrem.fromScene(envScene, 0.02, 1, 30000);
      scene.environment = envTarget.texture;
      envDirty = false;
      lastEnvUpdate = now;
    }

    if (controls) controls.update();
    else heroCamera(now);

    if (selected) slabs[selected.tower].material.opacity = 0.2 + 0.1 * Math.sin(now * 0.004);

    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
  }

  function start() {
    if (running || !visible) return;
    running = true;
    lastFrame = performance.now();
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !document.hidden) start();
    else stop();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : visible && start()));
  window.addEventListener('resize', resize);

  setDate(new Date());
  resize();
  renderer.compile(scene, camera);
  start();

  return {
    renderer,
    setDate,
    setScroll(p) {
      state.scroll = p;
    },
    setMode(mode) {
      const to = mode === 'functions' ? 1 : 0;
      const from = shared.uMode.value;
      const begin = performance.now();
      const step = () => {
        const t = Math.min((performance.now() - begin) / 600, 1);
        shared.uMode.value = from + (to - from) * t;
        if (t < 1) requestAnimationFrame(step);
      };
      step();
    },
    setExplore,
    focusTower,
    select,
    playIntro,
    resize,
    get date() {
      return state.date;
    },
    get palette() {
      return state.palette;
    },
    // camera heading (deg) so the UI compass can point north
    heading() {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z));
    },
    dispose() {
      stop();
      io.disconnect();
      window.removeEventListener('resize', resize);
      controls?.dispose();
      composer?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

// ---------------------------------------------------------------- tower geometry
// Rounded-square outline sampled by arc length: [{ x, z, nx, nz, u }], closed (last = first, u = perimeter).
function outline(w, d, r, step = 1.0) {
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  const pts = [];
  let u = 0;
  const push = (x, z, nx, nz) => {
    const last = pts[pts.length - 1];
    if (last) u += Math.hypot(x - last.x, z - last.z);
    pts.push({ x, z, nx, nz, u });
  };
  const edge = (x0, z0, x1, z1, nx, nz) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let i = 0; i < n; i++) push(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, nx, nz);
  };
  const arc = (cx, cz, a0) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n);
      push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a));
    }
  };
  edge(hw + r, -hd, hw + r, hd, 1, 0);
  arc(hw, hd, 0);
  edge(hw, hd + r, -hw, hd + r, 0, 1);
  arc(-hw, hd, Math.PI / 2);
  edge(-hw - r, hd, -hw - r, -hd, -1, 0);
  arc(-hw, -hd, Math.PI);
  edge(-hw, -hd - r, hw, -hd - r, 0, -1);
  arc(hw, -hd, Math.PI * 1.5);
  push(pts[0].x, pts[0].z, pts[0].nx, pts[0].nz);
  return pts;
}

// Facade skin of a tower whose floors each turn by `twist` radians (continuous between rings).
// aFacade = (perimeter distance, height) so the shader can draw floors and mullions.
function twistedTower(w, d, r, twist, height = TOP_H, withRings = true) {
  const ring = outline(w, d, r);
  const n = ring.length;
  const levels = [];
  if (withRings) for (let y = 0; y < height - 1e-3; y += FLOOR_H / 2) levels.push(y);
  else levels.push(0);
  levels.push(height);
  const pos = new Float32Array(levels.length * n * 3);
  const nor = new Float32Array(levels.length * n * 3);
  const fac = new Float32Array(levels.length * n * 2);
  levels.forEach((y, j) => {
    const a = twist * (y / FLOOR_H);
    const c = Math.cos(a);
    const s = Math.sin(a);
    ring.forEach((p, i) => {
      const k = j * n + i;
      pos.set([p.x * c + p.z * s, y, -p.x * s + p.z * c], k * 3);
      nor.set([p.nx * c + p.nz * s, 0, -p.nx * s + p.nz * c], k * 3);
      fac.set([p.u, y], k * 2);
    });
  });
  const index = [];
  for (let j = 0; j < levels.length - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c2 = a + n;
      const d2 = c2 + 1;
      index.push(a, c2, b, b, c2, d2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aFacade', new THREE.BufferAttribute(fac, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

function roundedPlate(w, d, r) {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const g = new THREE.ShapeGeometry(shape, 4);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------- builders
function buildFunctionTexture() {
  const width = 64;
  const rows = 4;
  const data = new Uint8Array(width * rows * 4);
  const rowOf = { glass: 0, stone: 1 };
  for (const [tower, row] of Object.entries(rowOf)) {
    for (let floor = 1; floor <= PROJECT.massing.floors; floor++) {
      const zone = ZONES[zoneAt(tower, floor)] || ZONES.retail;
      const c = new THREE.Color(zone.color);
      const i = (row * width + (floor - 1)) * 4;
      // the texture is tagged sRGB, so store sRGB bytes
      const srgb = c.clone().convertLinearToSRGB();
      data[i] = Math.round(srgb.r * 255);
      data[i + 1] = Math.round(srgb.g * 255);
      data[i + 2] = Math.round(srgb.b * 255);
      data[i + 3] = Math.round((zone.lit ?? 0.4) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, width, rows, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function buildGround(shared) {
  const material = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 1, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.vertexShader = 'varying vec2 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position.xy;');
    shader.fragmentShader =
      'varying vec2 vGround;\nuniform float uNight;\n' +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // local plane coords: x along the avenue, y = -z (towards the street is negative)
          vec2 g = vGround;
          float avenue = 1.0 - smoothstep(13.0, 14.0, abs(g.y + ${M.avenueZ.toFixed(1)}));
          vec2 cell = abs(fract(g / 150.0 + 0.5) - 0.5) * 150.0;
          float street = (1.0 - smoothstep(5.0, 6.0, min(cell.x, cell.y))) * step(80.0, length(g));
          float road = max(avenue, street);
          float plaza = 1.0 - smoothstep(70.0, 72.0, max(abs(g.x), abs(g.y - 4.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.056, 0.06), road);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.40, 0.37), plaza * (1.0 - avenue));
          float lamps = road * step(0.86, fract((abs(g.x) + abs(g.y)) / 28.0));
          `,
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * lamps * uNight * 0.9;');
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

function buildTraffic(shared) {
  const count = 520;
  const length = 3400;
  const positions = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const offset = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const rand = mulberry32(7);
  for (let i = 0; i < count; i++) {
    const eastbound = i % 2 === 0;
    const lane = eastbound ? 3 + rand() * 4 : -3 - rand() * 4;
    positions.set([0, 1.1, M.avenueZ + lane], i * 3);
    speed[i] = (eastbound ? 1 : -1) * (9 + rand() * 7);
    offset[i] = rand() * length;
    const c = eastbound ? [1.0, 0.92, 0.8] : [1.0, 0.12, 0.08];
    color.set(c, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offset, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLen: { value: length }, uNight: shared.uNight, uScale: { value: window.devicePixelRatio || 1 } },
    vertexShader: /* glsl */ `
      attribute float aSpeed; attribute float aOffset; attribute vec3 aColor;
      uniform float uTime; uniform float uLen; uniform float uScale;
      varying vec3 vColor;
      void main() {
        vec3 p = position;
        p.x = mod(aOffset + aSpeed * uTime, uLen) - uLen * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * 900.0 / -mv.z, 1.0, 9.0);
        vColor = aColor;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * (0.08 + 0.92 * uNight);
        gl_FragColor = vec4(vColor * 2.5 * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function buildCity(shared, count) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const material = facadeMaterial(3, { ...shared, uFloorH: { value: 3.1 }, uColW: { value: 3.4 }, uHalf: { value: new THREE.Vector2(0, 0) }, uRow: { value: 3 }, uHover: { value: -10 } });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const rand = mulberry32(42);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 20) {
    const r = 95 + Math.pow(rand(), 0.75) * 1700;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const tall = rand() < 0.06;
    const h = tall ? 55 + rand() * 60 : 12 + Math.pow(rand(), 1.6) * 34;
    s.set(16 + rand() * 30, h, 14 + rand() * 26);
    if (Math.abs(z - M.avenueZ) < 20 + s.z / 2) continue; // keep the avenue clear
    // keep blocks off the street grid (streets every 150 m, matching the ground shader)
    const cx = Math.abs((((x / 150 + 0.5) % 1) + 1) % 1 - 0.5) * 150;
    const cz = Math.abs((((-z / 150 + 0.5) % 1) + 1) % 1 - 0.5) * 150;
    if (cx < s.x / 2 + 7 || cz < s.z / 2 + 7) continue;
    p.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() < 0.8 ? 0 : (rand() - 0.5) * 0.6);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildHills() {
  const inner = 1500;
  const outer = 9500;
  const geometry = new THREE.RingGeometry(inner, outer, 220, 40);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, hillHeight(x, z) - 2);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x3b3a33, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  return mesh;
}

function buildTvTower() {
  // Mtatsminda TV tower, south-east of Vake on the ridge above the old town
  const group = new THREE.Group();
  const bearing = THREE.MathUtils.degToRad(118);
  const dist = 3300;
  const x = Math.sin(bearing) * dist;
  const z = -Math.cos(bearing) * dist;
  const base = hillHeight(x, z);
  const red = new THREE.MeshStandardMaterial({ color: 0xb8332b, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.7 });
  const segments = 9;
  const height = 274;
  for (let i = 0; i < segments; i++) {
    const h = height / segments;
    const r0 = 20 * (1 - i / segments) + 2;
    const r1 = 20 * (1 - (i + 1) / segments) + 2;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 4, 1, true), i % 2 ? white : red);
    seg.position.y = base + h * (i + 0.5);
    group.add(seg);
  }
  const beacons = [];
  for (const y of [height * 0.55, height * 0.8, height]) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 1 }),
    );
    beacon.position.y = base + y;
    group.add(beacon);
    beacons.push(beacon);
  }
  group.position.set(x, 0, z);
  group.userData.beacons = beacons;
  return group;
}

function buildStars() {
  const count = 1600;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const rand = mulberry32(3);
  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = rand() * 0.92 + 0.08;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(v);
    const r = 18000;
    positions.set([Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(theta) * r], i * 3);
    seeds[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w * 0.9999;
        gl_PointSize = 1.0 + aSeed * 2.2;
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(0.9, 0.93, 1.0), smoothstep(0.5, 0.0, d) * vA * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
