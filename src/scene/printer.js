import * as THREE from 'three';

export const PLATE_Y = 0.53;
const TOWER_COUNT = 3;
const TOWER_RADIUS = 1.32;
const TOWER_HEIGHT = 2.9;
const CROWN_Y = 3.35;
export const RING_IDLE_Y = 3.0;

const MAT = {
  darkMetal: new THREE.MeshStandardMaterial({
    color: 0x16181d,
    metalness: 0.92,
    roughness: 0.34,
  }),
  gunmetal: new THREE.MeshStandardMaterial({
    color: 0x22252c,
    metalness: 0.85,
    roughness: 0.45,
  }),
  champagne: new THREE.MeshStandardMaterial({
    color: 0xc9a86a,
    metalness: 1.0,
    roughness: 0.24,
  }),
  // Museum glass: low-opacity + strong reflections. Deliberately NOT
  // `transmission` — three's transmission pass hides transparent objects
  // (hologram, sparks) behind the glass and darkens the chamber.
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xbfd4e2,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.045,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
};

export function createPrinter(scene) {
  const machine = new THREE.Group();
  machine.name = 'printer';

  buildPlinth(machine);
  buildTowers(machine);
  buildCrown(machine);
  buildEnclosure(machine);
  const plate = buildPlate(machine);
  const { ringAssembly, ringMat, ringLight, carriages } = buildRing(machine);
  const statusRing = buildStatusRing(machine);

  scene.add(machine);

  return { machine, plate, ringAssembly, ringMat, ringLight, carriages, statusRing };
}

/* Base plinth: layered drum with a champagne reveal line */
function buildPlinth(parent) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.68, 1.78, 0.16, 96),
    MAT.darkMetal
  );
  base.position.y = 0.08;
  base.castShadow = base.receiveShadow = true;
  parent.add(base);

  const reveal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.655, 1.655, 0.018, 96),
    MAT.champagne
  );
  reveal.position.y = 0.17;
  parent.add(reveal);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(1.58, 1.66, 0.24, 96),
    MAT.gunmetal
  );
  drum.position.y = 0.3;
  drum.castShadow = drum.receiveShadow = true;
  parent.add(drum);

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.58, 0.06, 96),
    MAT.darkMetal
  );
  deck.position.y = 0.45;
  deck.receiveShadow = true;
  parent.add(deck);
}

/* Three slim towers with an inner light strip each */
function buildTowers(parent) {
  const towerGeo = new THREE.BoxGeometry(0.13, TOWER_HEIGHT, 0.2);
  const stripGeo = new THREE.PlaneGeometry(0.02, TOWER_HEIGHT - 0.5);

  for (let i = 0; i < TOWER_COUNT; i++) {
    const angle = (i / TOWER_COUNT) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * TOWER_RADIUS;
    const z = Math.sin(angle) * TOWER_RADIUS;

    const tower = new THREE.Mesh(towerGeo, MAT.darkMetal);
    tower.position.set(x, 0.45 + TOWER_HEIGHT / 2, z);
    tower.lookAt(0, tower.position.y, 0);
    tower.castShadow = true;
    parent.add(tower);

    const strip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35 })
    );
    strip.position.set(x * 0.955, 0.45 + TOWER_HEIGHT / 2, z * 0.955);
    strip.lookAt(0, strip.position.y, 0);
    parent.add(strip);

    // Champagne cap on each tower
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.05, 0.22),
      MAT.champagne
    );
    cap.position.set(x, 0.45 + TOWER_HEIGHT + 0.025, z);
    cap.lookAt(0, cap.position.y, 0);
    parent.add(cap);
  }
}

/* Crown: floating top ring joining the towers */
function buildCrown(parent) {
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(TOWER_RADIUS, 0.055, 24, 96),
    MAT.darkMetal
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = CROWN_Y;
  crown.castShadow = true;
  parent.add(crown);

  const crownTrim = new THREE.Mesh(
    new THREE.TorusGeometry(TOWER_RADIUS, 0.012, 12, 96),
    MAT.champagne
  );
  crownTrim.rotation.x = Math.PI / 2;
  crownTrim.position.y = CROWN_Y - 0.07;
  parent.add(crownTrim);
}

/* Glass cylinder between plinth and crown */
function buildEnclosure(parent) {
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, CROWN_Y - 0.55, 96, 1, true),
    MAT.glass
  );
  glass.position.y = 0.48 + (CROWN_Y - 0.55) / 2;
  glass.renderOrder = 10; // draw after chamber contents so they show through
  parent.add(glass);

  // Warm chamber light so the interior always reads
  const chamberLight = new THREE.PointLight(0xffe8c8, 2.5, 5, 2);
  chamberLight.position.set(0, 1.7, 0);
  parent.add(chamberLight);
}

/* Build plate raised above the deck, with concentric grooves */
function buildPlate(parent) {
  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 1.0, 0.05, 96),
    MAT.gunmetal
  );
  riser.position.y = 0.485;
  parent.add(riser);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.92, 0.05, 96),
    new THREE.MeshStandardMaterial({
      color: 0x32363f,
      metalness: 0.9,
      roughness: 0.25,
    })
  );
  plate.position.y = PLATE_Y - 0.025;
  plate.receiveShadow = true;
  parent.add(plate);

  const grooveMat = new THREE.MeshBasicMaterial({
    color: 0x9fd8ff,
    transparent: true,
    opacity: 0.14,
  });
  [0.28, 0.5, 0.72].forEach((radius) => {
    const groove = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.006, 96),
      grooveMat
    );
    groove.rotation.x = -Math.PI / 2;
    groove.position.y = PLATE_Y + 0.003;
    parent.add(groove);
  });

  return plate;
}

/* The materializer ring: levitating emissive torus + tower carriages */
function buildRing(parent) {
  const ringAssembly = new THREE.Group();
  ringAssembly.position.y = RING_IDLE_Y;

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e13,
    emissive: 0x9fd8ff,
    emissiveIntensity: 1.6,
    metalness: 0.6,
    roughness: 0.3,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.026, 24, 128), ringMat);
  ring.rotation.x = Math.PI / 2;
  ringAssembly.add(ring);

  const shroud = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.035, 24, 128, Math.PI * 2),
    MAT.gunmetal
  );
  shroud.rotation.x = Math.PI / 2;
  shroud.position.y = 0.045;
  shroud.castShadow = true;
  ringAssembly.add(shroud);

  const ringLight = new THREE.PointLight(0x9fd8ff, 0, 4, 2);
  ringAssembly.add(ringLight);

  // Carriages riding the towers, magnetically synced with the ring
  const carriages = [];
  for (let i = 0; i < TOWER_COUNT; i++) {
    const angle = (i / TOWER_COUNT) * Math.PI * 2 + Math.PI / 6;
    const carriage = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.26),
      MAT.gunmetal
    );
    carriage.position.set(
      Math.cos(angle) * TOWER_RADIUS,
      0,
      Math.sin(angle) * TOWER_RADIUS
    );
    carriage.lookAt(0, 0, 0);
    carriage.castShadow = true;
    ringAssembly.add(carriage);

    const eye = new THREE.Mesh(
      new THREE.CircleGeometry(0.03, 24),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff })
    );
    eye.position.copy(carriage.position).multiplyScalar(0.9);
    eye.lookAt(0, 0, 0);
    ringAssembly.add(eye);
    carriages.push(carriage);
  }

  parent.add(ringAssembly);
  return { ringAssembly, ringMat, ringLight, carriages };
}

/* Status ring set into the plinth deck: breathes with machine state */
function buildStatusRing(parent) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc9a86a,
    transparent: true,
    opacity: 0.55,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.36, 1.395, 128), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.482;
  parent.add(ring);
  return ring;
}
