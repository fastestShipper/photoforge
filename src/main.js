import '@fontsource/syne/500.css';
import '@fontsource/syne/600.css';
import '@fontsource/syne/700.css';
import '@fontsource/syne/800.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import * as THREE from 'three';
import { createEnvironment } from './scene/environment.js';
import { createPrinter } from './scene/printer.js';
import { createPrintJob } from './scene/printjob.js';
import { createOverlay } from './ui/overlay.js';

const container = document.getElementById('scene-container');
const env = createEnvironment(container);
const printer = createPrinter(env.scene);

let overlay;
const job = createPrintJob(env.scene, printer, {
  onStateChange: (state) => overlay?.onStateChange(state),
  onProgress: (progress) => overlay?.onProgress(progress),
});
overlay = createOverlay(job);
overlay.onStateChange('idle');

// Debug/wiring handle: lets QA scripts and the future backend integration
// reach the scene graph without touching module internals
window.__pf = { env, printer, job };

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  job.update(dt, elapsed);
  env.controls.update();
  env.composer.render();
}

animate();
