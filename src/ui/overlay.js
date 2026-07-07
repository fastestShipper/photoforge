import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { TOTAL_LAYERS, PRINT_PROFILE } from '../scene/printjob.js';

const STATUS_TEXT = {
  idle: 'EN ESPERA',
  analyzing: 'ANALIZANDO FOTOGRAFÍA',
  printing: 'IMPRIMIENDO',
  complete: 'PIEZA LISTA',
};

const PHASE_BY_STATE = {
  idle: 'upload',
  analyzing: 'analyze',
  printing: 'print',
  complete: 'export',
};

export function createOverlay(job) {
  const el = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    statusText: document.getElementById('status-text'),
    jobCard: document.getElementById('job-card'),
    jobThumb: document.getElementById('job-thumb'),
    jobName: document.getElementById('job-name'),
    jobSize: document.getElementById('job-size'),
    layerCount: document.getElementById('layer-count'),
    timeLeft: document.getElementById('time-left'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    progressSpark: document.getElementById('progress-spark'),
    progressPct: document.getElementById('progress-pct'),
    btnExport: document.getElementById('btn-export'),
    btnReset: document.getElementById('btn-reset'),
    phases: [...document.querySelectorAll('.phases li')],
  };

  bindUpload(el, job);
  bindActions(el, job);

  return {
    onStateChange(state) {
      document.body.dataset.state = state;
      el.statusText.textContent = STATUS_TEXT[state];
      el.btnExport.disabled = state !== 'complete';
      el.btnReset.classList.toggle('hidden', state === 'idle');
      updatePhases(el.phases, state);

      if (state === 'idle') {
        el.jobCard.classList.add('hidden');
        el.fileInput.value = '';
        setProgress(el, 0);
        el.layerCount.textContent = '000';
        el.timeLeft.textContent = '—';
      }
      if (state === 'complete') {
        setProgress(el, 1);
        el.layerCount.textContent = String(TOTAL_LAYERS);
        el.timeLeft.textContent = '00:00';
      }
    },

    onProgress(progress) {
      setProgress(el, progress);
      const layer = Math.min(
        Math.floor(progress * TOTAL_LAYERS),
        TOTAL_LAYERS
      );
      el.layerCount.textContent = String(layer).padStart(3, '0');
      const remaining = Math.max(
        PRINT_PROFILE.printDuration * (1 - progress),
        0
      );
      el.timeLeft.textContent = formatTime(remaining);
    },
  };
}

function bindUpload(el, job) {
  const openPicker = () => el.fileInput.click();
  el.dropzone.addEventListener('click', openPicker);
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openPicker();
  });

  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('dragover');
  });
  el.dropzone.addEventListener('dragleave', () =>
    el.dropzone.classList.remove('dragover')
  );
  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(el, job, file);
  });

  el.fileInput.addEventListener('change', () => {
    const file = el.fileInput.files?.[0];
    if (file) handleFile(el, job, file);
  });
}

function handleFile(el, job, file) {
  if (!file.type.startsWith('image/')) return;

  const url = URL.createObjectURL(file);
  el.jobThumb.src = url;
  el.jobName.textContent = file.name;
  el.jobSize.textContent = formatBytes(file.size);
  el.jobCard.classList.remove('hidden');

  new THREE.TextureLoader().load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    job.start(texture);
    URL.revokeObjectURL(url);
  });
}

function bindActions(el, job) {
  el.btnExport.addEventListener('click', () => exportModel(job.model));
  el.btnReset.addEventListener('click', () => job.reset());
}

function exportModel(model) {
  // Export a clean clone: no clipping planes, centered at origin
  const clone = model.clone();
  clone.material = model.material.clone();
  clone.material.clippingPlanes = [];
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);

  new GLTFExporter().parse(
    clone,
    (buffer) => {
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'photoforge-piece.glb';
      a.click();
      URL.revokeObjectURL(a.href);
    },
    (error) => console.error('[photoforge] export failed:', error),
    { binary: true }
  );
}

function updatePhases(phaseEls, state) {
  const order = ['upload', 'analyze', 'print', 'export'];
  const activeIdx = order.indexOf(PHASE_BY_STATE[state]);
  phaseEls.forEach((li) => {
    const idx = order.indexOf(li.dataset.phase);
    li.classList.toggle('active', idx === activeIdx);
    li.classList.toggle('done', idx < activeIdx);
  });
}

function setProgress(el, progress) {
  const pct = progress * 100;
  el.progressFill.style.width = `${pct}%`;
  el.progressSpark.style.left = `${pct}%`;
  el.progressPct.textContent = `${pct.toFixed(1).padStart(4, '0')}%`;
  el.progressBar.setAttribute('aria-valuenow', Math.round(pct));
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
