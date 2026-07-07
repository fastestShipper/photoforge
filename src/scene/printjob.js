import * as THREE from 'three';
import { PLATE_Y, RING_IDLE_Y } from './printer.js';

export const TOTAL_LAYERS = 512;
const MODEL_HEIGHT = 1.45;
const MODEL_TOP_Y = PLATE_Y + MODEL_HEIGHT;

/*
 * Print choreography profile.
 * TODO(user): tune phase durations and the progress easing curve here.
 * `ease` maps linear time t (0..1) to build progress — the current curve
 * starts slow (warm-up), cruises, and lands softly.
 */
export const PRINT_PROFILE = {
  analyzeDuration: 3.4,
  printDuration: 16,
  completeSettle: 1.2,
  ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const STATE_COLORS = {
  idle: new THREE.Color(0xc9a86a),
  analyzing: new THREE.Color(0x9fd8ff),
  printing: new THREE.Color(0x9fd8ff),
  complete: new THREE.Color(0xd8b878),
};

export function createPrintJob(scene, printer, callbacks = {}) {
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), PLATE_Y);
  const model = buildModel(clipPlane);
  model.visible = false;
  scene.add(model);

  const hologram = buildHologram();
  hologram.visible = false;
  scene.add(hologram);

  const buildFront = buildFrontDisc();
  buildFront.visible = false;
  scene.add(buildFront);

  const sparks = buildSparks();
  sparks.visible = false;
  scene.add(sparks);

  const job = {
    state: 'idle',
    stateTime: 0,
    progress: 0,
    photoTexture: null,
    model,
    clipPlane,

    start(texture) {
      this.photoTexture = texture;
      hologram.material.uniforms.uMap.value = texture;
      this.setState('analyzing');
    },

    reset() {
      if (this.photoTexture) this.photoTexture.dispose();
      this.photoTexture = null;
      this.progress = 0;
      model.visible = false;
      hologram.visible = false;
      buildFront.visible = false;
      sparks.visible = false;
      clipPlane.constant = PLATE_Y;
      this.setState('idle');
    },

    setState(next) {
      this.state = next;
      this.stateTime = 0;
      callbacks.onStateChange?.(next);
    },

    update(dt, elapsed) {
      this.stateTime += dt;
      updateStatusRing(printer.statusRing, this.state, elapsed);

      if (this.state === 'idle') this.updateIdle(elapsed);
      else if (this.state === 'analyzing') this.updateAnalyzing(elapsed);
      else if (this.state === 'printing') this.updatePrinting(dt, elapsed);
      else if (this.state === 'complete') this.updateComplete(dt, elapsed);
    },

    updateIdle(elapsed) {
      const breathe = RING_IDLE_Y + Math.sin(elapsed * 0.7) * 0.04;
      printer.ringAssembly.position.y = lerp(printer.ringAssembly.position.y, breathe, 0.04);
      printer.ringMat.emissiveIntensity = 0.5 + Math.sin(elapsed * 1.4) * 0.15;
      printer.ringLight.intensity = 0;
    },

    updateAnalyzing(elapsed) {
      hologram.visible = true;
      const t = Math.min(this.stateTime / PRINT_PROFILE.analyzeDuration, 1);
      hologram.material.uniforms.uTime.value = elapsed;
      hologram.material.uniforms.uReveal.value = smoothstep(0, 0.25, t) * (1 - smoothstep(0.85, 1, t));
      hologram.rotation.y = elapsed * 0.35;

      // Ring descends to the plate while the photo is scanned
      const targetY = PLATE_Y + 0.1;
      printer.ringAssembly.position.y = lerp(printer.ringAssembly.position.y, targetY, 0.035);
      printer.ringMat.emissiveIntensity = 1.2 + Math.sin(elapsed * 9) * 0.4;
      printer.ringLight.intensity = 2;

      if (t >= 1) {
        hologram.visible = false;
        model.visible = true;
        buildFront.visible = true;
        sparks.visible = true;
        this.setState('printing');
      }
    },

    updatePrinting(dt, elapsed) {
      const t = Math.min(this.stateTime / PRINT_PROFILE.printDuration, 1);
      this.progress = PRINT_PROFILE.ease(t);

      const frontY = PLATE_Y + this.progress * MODEL_HEIGHT;
      clipPlane.constant = frontY;
      printer.ringAssembly.position.y = frontY + 0.06;
      buildFront.position.y = frontY + 0.004;
      buildFront.material.opacity = 0.18 + Math.sin(elapsed * 14) * 0.05;

      printer.ringMat.emissiveIntensity = 1.7 + Math.sin(elapsed * 18) * 0.35;
      printer.ringLight.intensity = 3.5 + Math.sin(elapsed * 18) * 0.8;
      printer.ringLight.position.y = 0.02;

      updateSparks(sparks, dt, frontY);
      callbacks.onProgress?.(this.progress);

      if (t >= 1) {
        buildFront.visible = false;
        sparks.visible = false;
        clipPlane.constant = MODEL_TOP_Y + 0.2;
        this.setState('complete');
      }
    },

    updateComplete(dt, elapsed) {
      const rise = RING_IDLE_Y;
      printer.ringAssembly.position.y = lerp(printer.ringAssembly.position.y, rise, 0.02);
      printer.ringMat.emissiveIntensity = lerp(printer.ringMat.emissiveIntensity, 0.7, 0.03);
      printer.ringLight.intensity = lerp(printer.ringLight.intensity, 0, 0.03);
      model.rotation.y += dt * 0.35; // showcase turntable
    },
  };

  return job;
}

/* Placeholder piece: an elegant lathe vessel in pearl resin.
 * The wiring stage will swap this for the mesh generated from the photo. */
function buildModel(clipPlane) {
  // Amphora silhouette: wide foot, low belly, slender neck, flared lip
  const profile = [
    [0.001, 0.0], [0.3, 0.0], [0.36, 0.03], [0.44, 0.18],
    [0.48, 0.4], [0.42, 0.68], [0.28, 0.92], [0.16, 1.1],
    [0.13, 1.24], [0.15, 1.34], [0.2, 1.41], [0.21, 1.45],
  ].map(([r, y]) => new THREE.Vector2(r, (y / 1.45) * MODEL_HEIGHT));

  const curve = new THREE.SplineCurve(profile);
  // Catmull-Rom can overshoot below r=0 near the axis; lathe needs r >= 0
  const points = curve
    .getPoints(72)
    .map((p) => new THREE.Vector2(Math.max(p.x, 0.001), p.y));

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf2ede2,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffe4c0),
    side: THREE.DoubleSide,
    clippingPlanes: [clipPlane],
    clipShadows: true,
  });

  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, 96), material);
  mesh.position.y = PLATE_Y;
  mesh.castShadow = true;
  mesh.name = 'printed-model';
  return mesh;
}

/* Holographic photo panel shown during analysis */
function buildHologram() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: null },
      uTime: { value: 0 },
      uReveal: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uReveal;
      varying vec2 vUv;
      void main() {
        vec3 tex = texture2D(uMap, vUv).rgb;
        float luma = dot(tex, vec3(0.299, 0.587, 0.114));
        vec3 holo = mix(vec3(0.08, 0.35, 0.55), vec3(0.65, 0.9, 1.0), luma);
        float scan = 0.75 + 0.25 * sin(vUv.y * 160.0 + uTime * 6.0);
        float sweep = smoothstep(0.0, 0.06,
          abs(fract(uTime * 0.25) - vUv.y)) * 0.4 + 0.6;
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x)
                   * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        gl_FragColor = vec4(holo * scan * sweep, uReveal * 0.85 * edge);
      }
    `,
  });

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.3), material);
  panel.position.set(0, PLATE_Y + 0.85, 0);
  return panel;
}

/* Energy plane slicing the piece at the build front */
function buildFrontDisc() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.66, 64),
    new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  return disc;
}

/* Micro-sparks drifting up from the fusion line */
const SPARK_COUNT = 140;
function buildSparks() {
  const positions = new Float32Array(SPARK_COUNT * 3);
  const seeds = new Float32Array(SPARK_COUNT);
  for (let i = 0; i < SPARK_COUNT; i++) {
    respawnSpark(positions, i, PLATE_Y);
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xbfe6ff,
      size: 0.016,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  points.userData.seeds = seeds;
  return points;
}

function respawnSpark(positions, i, frontY) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.15 + Math.random() * 0.55;
  positions[i * 3] = Math.cos(angle) * radius;
  positions[i * 3 + 1] = frontY + Math.random() * 0.03;
  positions[i * 3 + 2] = Math.sin(angle) * radius;
}

function updateSparks(sparks, dt, frontY) {
  const positions = sparks.geometry.attributes.position.array;
  const seeds = sparks.userData.seeds;
  for (let i = 0; i < SPARK_COUNT; i++) {
    positions[i * 3 + 1] += dt * (0.25 + seeds[i] * 0.45);
    if (positions[i * 3 + 1] > frontY + 0.28) respawnSpark(positions, i, frontY);
  }
  sparks.geometry.attributes.position.needsUpdate = true;
}

function updateStatusRing(statusRing, state, elapsed) {
  const target = STATE_COLORS[state] ?? STATE_COLORS.idle;
  statusRing.material.color.lerp(target, 0.05);
  const pulse = state === 'idle' ? 0.4 + Math.sin(elapsed * 1.2) * 0.15
    : state === 'complete' ? 0.75
    : 0.6 + Math.sin(elapsed * 6) * 0.2;
  statusRing.material.opacity = pulse;
}

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
