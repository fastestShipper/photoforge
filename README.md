# PHOTOFORGE MK·III

Futuristic 3D printer UI in Three.js. Upload a photo, the machine analyzes it
as a hologram, prints the piece layer by layer with a levitating materializer
ring, and exports a real binary glTF (.glb).

State machine: `idle → analyzing → printing → complete`

## Requirements

- Node.js 20+ (tested on 22)

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Structure

```
index.html              UI markup (ES copy), favicon, overlay panels
src/main.js             bootstrap, render loop, window.__pf debug handle
src/scene/environment.js  renderer, camera, lights, floor, backdrop, bloom
src/scene/printer.js      the machine: plinth, towers, crown, glass, ring
src/scene/printjob.js     print state machine, hologram, clipping build-up
src/ui/overlay.js         upload, progress, GLB export (GLTFExporter)
src/styles/main.css       design tokens + glass HUD
```

## Backend wiring (pending)

The printed piece is a placeholder (lathe amphora). To wire a real
photo→3D backend, replace `buildModel()` in `src/scene/printjob.js` and
swap `job.model` when your mesh arrives. `job.start(texture)` kicks off
the sequence; `PRINT_PROFILE` controls phase durations and easing.

## Gotchas baked into this code

- Glass is deliberately NOT `transmission`: three.js's transmission pass
  hides transparent objects (hologram, sparks) behind it.
- `renderer.localClippingEnabled` must stay on for the layer build-up.
- Fonts are self-hosted via @fontsource — no CDN dependency.
