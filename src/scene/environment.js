import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BG_COLOR = 0x06070a;
const CAMERA_TARGET = new THREE.Vector3(0, 1.55, 0);

export function createEnvironment(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, 0.055);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(
    36,
    window.innerWidth / window.innerHeight,
    0.1,
    60
  );
  camera.position.set(6.2, 3.4, 7.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(CAMERA_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 13;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = 1.48;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;

  addLights(scene);
  addFloor(scene);
  addBackdrop(scene);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42, // strength
    0.65, // radius
    0.8   // threshold: only emissives bloom
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls, composer, bloom };
}

function addLights(scene) {
  const ambient = new THREE.AmbientLight(0x232838, 3.2);
  scene.add(ambient);

  const key = new THREE.SpotLight(0xfff2dd, 140, 32, Math.PI / 4.6, 0.5, 1.55);
  key.position.set(5, 8, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7fa8d8, 2.8);
  rim.position.set(-6, 5, -7);
  scene.add(rim);

  const fill = new THREE.PointLight(0xc9a86a, 10, 16, 2);
  fill.position.set(-3.5, 1.4, 3.5);
  scene.add(fill);
}

function addFloor(scene) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(28, 72),
    new THREE.MeshStandardMaterial({
      color: 0x101218,
      metalness: 0.85,
      roughness: 0.28,
      envMapIntensity: 0.85,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Concentric hairline rings etched into the floor around the machine
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc9a86a,
    transparent: true,
    opacity: 0.1,
  });
  [2.4, 3.4, 4.8].forEach((radius, i) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.008, 128),
      ringMat.clone()
    );
    ring.material.opacity = 0.12 - i * 0.035;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);
  });
}

/* Giant inverted gradient cylinder: lifts the horizon out of pure black */
function addBackdrop(scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    uniforms: {
      uBottom: { value: new THREE.Color(0x11141c) },
      uTop: { value: new THREE.Color(0x05060a) },
    },
    vertexShader: /* glsl */ `
      varying float vH;
      void main() {
        vH = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBottom;
      uniform vec3 uTop;
      varying float vH;
      void main() {
        float t = smoothstep(0.0, 0.55, vH);
        gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
      }
    `,
  });
  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 30, 40, 48, 1, true),
    material
  );
  backdrop.position.y = 10;
  scene.add(backdrop);
}
