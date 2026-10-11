import * as THREE from "three";
import { EffectComposer } from "./vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "./vendor/three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "./vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./vendor/three/addons/postprocessing/OutputPass.js";

const WORKS = [
  {
    file: "cartography",
    title: "Chart of the Headland",
    movement: "Cartography",
    note: "A coast drawn by moonlight, the light marked before the walk.",
  },
  {
    file: "arts-and-crafts",
    title: "The Garden Path",
    movement: "Arts and Crafts",
    note: "Patterned surf and a tiled road, pale under the night sky.",
  },
  {
    file: "california-impressionism",
    title: "Last Light, California",
    movement: "California Impressionism",
    note: "The cliff path after the sun has gone, still warm with paint.",
  },
  {
    file: "baroque",
    title: "Climbing the Gale",
    movement: "Baroque",
    note: "A figure climbing toward the lantern through a night storm.",
  },
  {
    file: "black-and-white",
    title: "The Keeper’s Walk",
    movement: "Black and White",
    note: "Wet stone, a coat, and one hard light in the dark.",
  },
  {
    file: "beatniks",
    title: "Night Watch",
    movement: "Beatniks",
    note: "Ink and a cigarette above black water.",
  },
  {
    file: "bauhaus",
    title: "Primary Structure",
    movement: "Bauhaus",
    note: "Geometry, a red figure, a sea measured at night.",
  },
  {
    file: "atomic-age",
    title: "Tomorrow’s Beacon",
    movement: "Atomic Age",
    note: "A pastel tower on a promenade under a violet dusk.",
  },
  {
    file: "avant-pop",
    title: "Signal",
    movement: "Avant-pop",
    note: "A fractured lantern and a blue figure against the dark.",
  },
];

const TOTAL = WORKS.length;
const DEG = Math.PI / 180;

const EYE = 1.6;
const RING = 3.2;
const ROOM_RADIUS = 5.6;
const SOFFIT_RADIUS = 4.6;
const SOFFIT_Y = 3.68;
const CEILING_Y = 3.8;
const ART_RADIUS = 3.8;
const ART_Y = 1.45;
const FOCUS_GAP = 1.5;
const LAMP_Y = 2.8;
const LENS_RADIUS = 0.35;
const LENS_HALF = 0.37;
const DRUM_BOTTOM = 3.45;
const INLAY_RADIUS = 3.55;
const FIXTURE_RADIUS = 2.55;

const PITCH_MIN = -15 * DEG;
const PITCH_MAX = 35 * DEG;
const PITCH_REST = 4 * DEG;
const BEAM_SPEED = (Math.PI * 2) / 25;
const IDLE_DELAY = 8000;
const IDLE_SPEED = 0.035;

const PANO_RADIUS = 12;
const PANO_ASPECT = 1280 / 2720;
const PANO_HORIZON = 0.433;
const MOON_ELEVATION = 9 * DEG;
const MOON_OFFSET = 0.5;
const BLOOM_LAYER = 1;

const grid = document.querySelector("#grid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxTitle = document.querySelector("#lightbox-title");
const lightboxCaption = document.querySelector("#lightbox-caption");
const hoverLabel = document.querySelector("#hover-label");
const backButton = document.querySelector("#room-back");
const canvas = document.querySelector("#room-view");
const listButtons = [];

let current = 0;
let lastTrigger = null;

WORKS.forEach((work, index) => {
  const item = document.createElement("li");
  const button = document.createElement("button");
  const mat = document.createElement("span");
  const image = document.createElement("img");
  const copy = document.createElement("span");
  const movement = document.createElement("span");
  const title = document.createElement("span");
  const note = document.createElement("span");

  mat.className = "mat";
  image.src = `images/thumbs/${work.file}.jpg`;
  image.alt = "";
  copy.className = "card-copy";
  movement.className = "movement";
  movement.textContent = work.movement;
  title.className = "piece-title";
  title.textContent = work.title;
  note.className = "note";
  note.textContent = work.note;

  mat.append(image);
  copy.append(movement, title, note);
  button.type = "button";
  button.setAttribute("aria-label", `${work.title}. ${work.movement}. ${work.note}`);
  button.append(mat, copy);
  button.addEventListener("click", () => openAt(index, button));
  item.append(button);
  grid.append(item);
  listButtons.push(button);
});

document.querySelector(".prev").addEventListener("click", () => step(-1));
document.querySelector(".next").addEventListener("click", () => step(1));
document.querySelector(".lightbox figure").addEventListener("click", (event) => {
  event.stopPropagation();
});
backButton.addEventListener("click", () => leaveArtwork());

lightbox.addEventListener("click", (event) => {
  if (event.target.closest("figure, .nav")) return;
  if (event.target.closest("[data-close], .lightbox-dialog")) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (!lightbox.hidden) {
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
    return;
  }

  if (!document.body.classList.contains("is-3d")) return;
  noteInteraction();
  if (event.key === "Escape") leaveArtwork();
  if (view.mode === "focus") {
    if (event.key === "ArrowLeft") visitArtwork((view.focus - 1 + TOTAL) % TOTAL);
    if (event.key === "ArrowRight") visitArtwork((view.focus + 1) % TOTAL);
    if (event.key === "Enter" && document.activeElement === document.body) openAt(view.focus);
  } else if (view.mode === "ring") {
    if (event.key === "ArrowLeft") view.thetaGoal += 0.16;
    if (event.key === "ArrowRight") view.thetaGoal -= 0.16;
    if (event.key === "ArrowUp") view.pitchGoal = clamp(view.pitchGoal + 0.08, PITCH_MIN, PITCH_MAX);
    if (event.key === "ArrowDown") view.pitchGoal = clamp(view.pitchGoal - 0.08, PITCH_MIN, PITCH_MAX);
  }
  if (event.key.startsWith("Arrow")) event.preventDefault();
});

function openAt(index, trigger) {
  current = index;
  lastTrigger = trigger || listButtons[index];
  showCurrent();
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  hoverLabel.hidden = true;
  lightbox.querySelector(".close").focus();
  pauseRoom();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  lastTrigger?.focus();
  resumeRoom();
  if (view.mode === "focus" && view.focus !== current) visitArtwork(current);
  else updateFocusLabel();
}

function step(direction) {
  current = (current + direction + TOTAL) % TOTAL;
  showCurrent();
}

function showCurrent() {
  const work = WORKS[current];
  lightboxImage.src = `images/full/${work.file}.jpg`;
  lightboxImage.alt = `${work.title}. ${work.note}`;
  lightboxTitle.textContent = `${current + 1} / ${TOTAL} · ${work.title}`;
  lightboxCaption.textContent = `${work.movement}. ${work.note}`;
}

const view = {
  mode: "ring",
  theta: 0,
  thetaGoal: 0,
  pitch: PITCH_REST,
  pitchGoal: PITCH_REST,
  focus: -1,
  glide: null,
  ringReturn: null,
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const poseHelper = new THREE.PerspectiveCamera();
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

let renderer;
let scene;
let camera;
let finalComposer;
let bloomComposer;
let panoGroup;
let beam;
let lampCore;
let lampCoreColor;
let lampHalo;
let floorMaterial;
let reflection;
const artSpots = [];
const bloomTints = [];
let artMeshes = [];
let artAngles = [];
let darkenInBloom = [];
let hideInBloom = [];
let raf = 0;
let running = false;
let lastInput = performance.now();
let beamAngle = 0.64;
const shared = {
  time: { value: 0 },
  motion: { value: reduceMotion.matches ? 0 : 1 },
  beamDir: { value: new THREE.Vector3(1, 0, 0) },
  beamFade: { value: 1 },
  flash: { value: 0 },
  approach: { value: 0 },
  bloomMode: { value: 0 },
  pixelRatio: { value: 1 },
};
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
const navy = new THREE.Color(0x050b18);

if (hasWebGL()) {
  buildRoom().catch((error) => {
    console.error(error);
    document.body.classList.remove("is-3d");
  });
}

function hasWebGL() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

async function buildRoom() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = navy;
  camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.05, 120);

  const brass = new THREE.MeshStandardMaterial({
    color: 0xe2b765,
    metalness: 1,
    roughness: 0.22,
  });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 });

  addLights();
  addFloor(brass);
  addCeiling();
  addGlassWall(white);
  addLamp(brass);
  await addPanorama();
  await addArtworks(brass);
  floorMaterial.lightMap = bakeFloorPools();

  captureEnvironment();
  setupComposers();
  sortBloomObjects();
  resize();

  applyRingPose();
  document.body.classList.add("is-3d");
  bindLook();
  window.addEventListener("resize", resize);
  resumeRoom();
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0x3a4c6e, 0x6e5a44, 0.35));
}

function addFloor(brass) {
  floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8dfcf,
    roughness: 0.3,
    metalness: 0,
    envMapIntensity: 0.9,
  });
  reflection = {
    target: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }),
    camera: new THREE.PerspectiveCamera(),
    matrix: new THREE.Matrix4(),
    texel: new THREE.Vector2(1, 1),
    hidden: [],
  };
  floorMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.reflectMap = { value: reflection.target.texture };
    shader.uniforms.reflectMatrix = { value: reflection.matrix };
    shader.uniforms.reflectTexel = { value: reflection.texel };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 reflectMatrix;\nvarying vec4 vReflect;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvReflect = reflectMatrix * modelMatrix * vec4(transformed, 1.0);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D reflectMap;\nuniform vec2 reflectTexel;\nvarying vec4 vReflect;",
      )
      .replace(
        "#include <lights_fragment_begin>",
        THREE.ShaderChunk.lights_fragment_begin.replace(
          "#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )",
          "#if 0",
        ),
      )
      .replace(
        "#include <opaque_fragment>",
        `vec2 mirrorUv = vReflect.xy / vReflect.w;
        vec3 mirrored = texture2D(reflectMap, mirrorUv).rgb * 0.28;
        mirrored += texture2D(reflectMap, mirrorUv + reflectTexel * vec2(1.2, 2.0)).rgb * 0.18;
        mirrored += texture2D(reflectMap, mirrorUv + reflectTexel * vec2(-1.2, -2.0)).rgb * 0.18;
        mirrored += texture2D(reflectMap, mirrorUv + reflectTexel * vec2(-1.2, 2.0)).rgb * 0.18;
        mirrored += texture2D(reflectMap, mirrorUv + reflectTexel * vec2(1.2, -2.0)).rgb * 0.18;
        float mirrorView = abs(dot(normal, normalize(vViewPosition)));
        float mirrorAmount = 0.1 + 0.4 * pow(1.0 - mirrorView, 4.0);
        outgoingLight = outgoingLight * (1.0 - 0.5 * mirrorAmount) + mirrored * mirrorAmount;
        #include <opaque_fragment>`,
      );
  };
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS + 0.05, 96), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const inlay = new THREE.Mesh(new THREE.TorusGeometry(INLAY_RADIUS, 0.012, 6, 192), brass);
  inlay.rotation.x = Math.PI / 2;
  inlay.scale.z = 0.25;
  inlay.position.y = 0.002;
  scene.add(inlay);
  reflection.hidden.push(floor, inlay);
}

const mirrorTarget = new THREE.Vector3();
const mirrorUp = new THREE.Vector3();

function renderReflection() {
  const mirror = reflection.camera;
  camera.updateMatrixWorld();
  mirror.projectionMatrix.copy(camera.projectionMatrix);
  mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  mirror.position.set(camera.position.x, -camera.position.y, camera.position.z);
  camera.getWorldDirection(mirrorTarget).add(camera.position);
  mirrorTarget.y = -mirrorTarget.y;
  mirrorUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  mirrorUp.y = -mirrorUp.y;
  mirror.up.copy(mirrorUp);
  mirror.lookAt(mirrorTarget);
  mirror.updateMatrixWorld();
  reflection.matrix.set(
    0.5, 0, 0, 0.5,
    0, 0.5, 0, 0.5,
    0, 0, 0.5, 0.5,
    0, 0, 0, 1,
  ).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

  const wasVisible = reflection.hidden.map((object) => object.visible);
  reflection.hidden.forEach((object) => {
    object.visible = false;
  });
  panoGroup.position.y = mirror.position.y;
  renderer.setRenderTarget(reflection.target);
  renderer.clear();
  renderer.render(scene, mirror);
  renderer.setRenderTarget(null);
  panoGroup.position.y = EYE;
  reflection.hidden.forEach((object, index) => {
    object.visible = wasVisible[index];
  });
}

// Same falloff as three's SpotLight, evaluated once for the floor so its
// shader can skip the per-pixel spot loop.
function bakeFloorPools() {
  const size = 256;
  const half = ROOM_RADIUS + 0.05;
  const toHalf = THREE.DataUtils.toHalfFloat;
  const data = new Uint16Array(size * size * 4);
  const ray = new THREE.Vector3();
  const lights = artSpots.map((spot) => ({
    position: spot.position.clone(),
    direction: spot.target.position.clone().sub(spot.position).normalize(),
    coneCos: Math.cos(spot.angle),
    penumbraCos: Math.cos(spot.angle * (1 - spot.penumbra)),
    color: spot.color.clone().multiplyScalar(spot.intensity),
    distance: spot.distance,
    decay: spot.decay,
  }));

  for (let row = 0; row < size; row += 1) {
    const z = -(((row + 0.5) / size) * 2 - 1) * half;
    for (let column = 0; column < size; column += 1) {
      const x = (((column + 0.5) / size) * 2 - 1) * half;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const light of lights) {
        ray.set(x - light.position.x, -light.position.y, z - light.position.z);
        const distance = ray.length();
        ray.divideScalar(distance);
        const cone = smooth(light.coneCos, light.penumbraCos, ray.dot(light.direction));
        if (cone <= 0) continue;
        const cutoff = Math.max(0, 1 - (distance / light.distance) ** 4) ** 2;
        const energy = (cone * cutoff * -ray.y) / Math.max(distance ** light.decay, 0.01);
        r += light.color.r * energy;
        g += light.color.g * energy;
        b += light.color.b * energy;
      }
      const index = (row * size + column) * 4;
      data[index] = toHalf(r);
      data[index + 1] = toHalf(g);
      data[index + 2] = toHalf(b);
      data[index + 3] = toHalf(1);
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function addCeiling() {
  const warm = new THREE.Color(1, 0.97, 0.92);

  const inner = new THREE.RingGeometry(0.33, SOFFIT_RADIUS + 0.02, 160, 28);
  shadeRadially(inner, (r) => {
    const cove = Math.exp(-(SOFFIT_RADIUS - r) / 0.7);
    const lamp = Math.exp(-(r - 0.33) / 0.8);
    return 0.46 + cove * 0.36 + lamp * 0.1;
  }, warm);
  const ceiling = new THREE.Mesh(inner, new THREE.MeshBasicMaterial({ vertexColors: true }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  scene.add(ceiling);

  const soffitGeometry = new THREE.RingGeometry(SOFFIT_RADIUS, ROOM_RADIUS + 0.05, 160, 6);
  shadeRadially(soffitGeometry, (r) => 0.36 + 0.2 * Math.exp(-(r - SOFFIT_RADIUS) / 0.35), warm);
  const soffit = new THREE.Mesh(soffitGeometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  soffit.rotation.x = Math.PI / 2;
  soffit.position.y = SOFFIT_Y;
  scene.add(soffit);

  const coveHeight = CEILING_Y - SOFFIT_Y;
  const coveGeometry = new THREE.CylinderGeometry(SOFFIT_RADIUS, SOFFIT_RADIUS, coveHeight, 160, 6, true);
  shadeVertically(coveGeometry, coveHeight, (t) => 0.55 + 0.32 * t * t, warm);
  const cove = new THREE.Mesh(
    coveGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
  );
  cove.position.y = SOFFIT_Y + coveHeight / 2;
  scene.add(cove);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(SOFFIT_RADIUS, 0.012, 6, 192),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.86, 0.82, 0.74) }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = SOFFIT_Y;
  scene.add(lip);

  const drumHeight = CEILING_Y - DRUM_BOTTOM;
  const drumGeometry = new THREE.CylinderGeometry(0.33, 0.33, drumHeight, 48, 4, true);
  shadeVertically(drumGeometry, drumHeight, (t) => 0.7 - 0.2 * t, warm);
  const drum = new THREE.Mesh(drumGeometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  drum.position.y = DRUM_BOTTOM + drumHeight / 2;
  scene.add(drum);
  const drumBase = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.58, 0.54, 0.48) }),
  );
  drumBase.rotation.x = Math.PI / 2;
  drumBase.position.y = DRUM_BOTTOM;
  scene.add(drumBase);
}

function addGlassWall(white) {
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, SOFFIT_Y, 96, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xc8d6e4,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.05,
      envMapIntensity: 0.25,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  glass.position.y = SOFFIT_Y / 2;
  glass.renderOrder = 1;
  scene.add(glass);

  const mullionGeometry = new THREE.BoxGeometry(0.05, SOFFIT_Y, 0.07);
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + 0.11;
    const mullion = new THREE.Mesh(mullionGeometry, white);
    mullion.position.set(
      Math.sin(angle) * (ROOM_RADIUS - 0.03),
      SOFFIT_Y / 2,
      Math.cos(angle) * (ROOM_RADIUS - 0.03),
    );
    mullion.rotation.y = angle;
    scene.add(mullion);
  }

  const sill = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS - 0.04, ROOM_RADIUS - 0.04, 0.1, 128, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.5, side: THREE.BackSide }),
  );
  sill.position.y = 0.05;
  scene.add(sill);
}

function addLamp(brass) {
  const lamp = new THREE.Group();
  lamp.position.y = LAMP_Y;

  const lens = new THREE.Mesh(lensGeometry(), lensMaterial());
  lens.renderOrder = 5;
  lamp.add(lens);

  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.34, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.8, 0.55),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  chimney.position.y = 0.02;
  chimney.renderOrder = 4;
  lamp.add(chimney);

  lampCoreColor = new THREE.Color(1.0, 0.84, 0.6);
  lampCore = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.05, 0.09, 6, 16),
    new THREE.MeshBasicMaterial({ color: lampCoreColor.clone().multiplyScalar(7) }),
  );
  lampCore.position.y = 0.01;
  lampCore.layers.enable(BLOOM_LAYER);
  lamp.add(lampCore);

  lampHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture([
        [0, "rgba(255,236,200,0.95)"],
        [0.18, "rgba(255,214,150,0.4)"],
        [0.45, "rgba(255,200,130,0.06)"],
        [1, "rgba(255,200,130,0)"],
      ]),
      color: new THREE.Color(1, 0.86, 0.62),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  lampHalo.scale.setScalar(0.55);
  lampHalo.position.y = 0.01;
  lampHalo.renderOrder = 6;
  lamp.add(lampHalo);

  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 20), brass);
  burner.position.y = -0.13;
  lamp.add(burner);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.012, 32), brass);
  plate.position.y = -0.215;
  lamp.add(plate);

  [LENS_HALF + 0.03, -LENS_HALF - 0.03].forEach((y) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.378, 0.378, 0.06, 64, 1, true),
      brass,
    );
    band.position.y = y;
    lamp.add(band);
    [y + 0.03, y - 0.03].forEach((edgeY) => {
      const edge = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.009, 8, 64), brass);
      edge.rotation.x = Math.PI / 2;
      edge.position.y = edgeY;
      lamp.add(edge);
    });
  });

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.368, 0.006, 6, 64), brass);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.075;
  lamp.add(belt);

  const uprightGeometry = new THREE.BoxGeometry(0.014, LENS_HALF * 2 + 0.02, 0.014);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const upright = new THREE.Mesh(uprightGeometry, brass);
    upright.position.set(Math.sin(angle) * 0.372, 0, Math.cos(angle) * 0.372);
    upright.rotation.y = angle;
    lamp.add(upright);
  }

  const capTop = LENS_HALF + 0.06;
  const cap = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.378, capTop),
      new THREE.Vector2(0.36, capTop + 0.03),
      new THREE.Vector2(0.24, capTop + 0.08),
      new THREE.Vector2(0.11, capTop + 0.11),
      new THREE.Vector2(0.07, capTop + 0.12),
    ], 48),
    brass,
  );
  lamp.add(cap);
  const mountHeight = DRUM_BOTTOM - LAMP_Y - (capTop + 0.12);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, mountHeight, 24), brass);
  mount.position.y = capTop + 0.12 + mountHeight / 2;
  lamp.add(mount);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.035, 40), brass);
  canopy.position.y = DRUM_BOTTOM - LAMP_Y - 0.018;
  lamp.add(canopy);

  const baseTop = -LENS_HALF - 0.06;
  const base = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.0, baseTop - 0.115),
      new THREE.Vector2(0.03, baseTop - 0.115),
      new THREE.Vector2(0.04, baseTop - 0.09),
      new THREE.Vector2(0.17, baseTop - 0.07),
      new THREE.Vector2(0.2, baseTop - 0.04),
      new THREE.Vector2(0.36, baseTop - 0.025),
      new THREE.Vector2(0.378, baseTop),
    ], 48),
    brass,
  );
  lamp.add(base);

  scene.add(lamp);

  beam = new THREE.Group();
  beam.position.copy(lamp.position);
  const length = 60;
  const near = 0.22;
  const far = near + Math.tan(2.5 * DEG) * length;
  const shaft = new THREE.CylinderGeometry(far, near, length, 40, 1, true);
  shaft.rotateZ(-Math.PI / 2);
  shaft.translate(length / 2 + LENS_RADIUS - 0.03, 0, 0);
  const shaftMesh = new THREE.Mesh(shaft, beamMaterial());
  shaftMesh.renderOrder = 6;
  shaftMesh.frustumCulled = false;
  shaftMesh.layers.enable(BLOOM_LAYER);
  beam.add(shaftMesh);
  scene.add(beam);
  reflection.hidden.push(beam);
}

function lensGeometry() {
  const base = (y) => LENS_RADIUS - 0.03 * (y / LENS_HALF) ** 2;
  const beltHalf = 0.075;
  const prisms = 6;
  const prismHeight = (LENS_HALF - beltHalf) / prisms;
  const points = [];
  for (let i = prisms - 1; i >= 0; i -= 1) {
    const outer = -(beltHalf + (i + 1) * prismHeight);
    const inner = -(beltHalf + i * prismHeight);
    points.push(new THREE.Vector2(base(outer) + 0.004, outer));
    points.push(new THREE.Vector2(base(inner) - 0.016, inner));
  }
  for (let i = 0; i <= 8; i += 1) {
    const y = -beltHalf + (i / 8) * beltHalf * 2;
    points.push(new THREE.Vector2(base(y) + 0.012 * Math.cos((y / beltHalf) * Math.PI * 0.5), y));
  }
  for (let i = 0; i < prisms; i += 1) {
    const inner = beltHalf + i * prismHeight;
    const outer = beltHalf + (i + 1) * prismHeight;
    points.push(new THREE.Vector2(base(inner) - 0.016, inner));
    points.push(new THREE.Vector2(base(outer) + 0.004, outer));
  }
  return new THREE.LatheGeometry(points, 64);
}

function lensMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      glow: { value: new THREE.Color(1.0, 0.8, 0.52) },
      beamDir: shared.beamDir,
      flash: shared.flash,
      approach: shared.approach,
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 glow;
      uniform vec3 beamDir;
      uniform float flash;
      uniform float approach;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying vec3 vLocal;
      void main() {
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vWorld);
        float ndv = abs(dot(n, v));
        float fresnel = 0.04 + 0.96 * pow(1.0 - ndv, 4.0);

        float ay = abs(vLocal.y);
        float belt = 1.0 - smoothstep(0.065, 0.08, ay);
        float f = fract((ay - 0.075) / ${((LENS_HALF - 0.075) / 6).toFixed(5)});
        float prism = (1.0 - belt) * step(0.075, ay);
        float line = exp(-pow((f - 0.74) / 0.06, 2.0)) * prism;
        float edge = smoothstep(0.9, 1.0, f) * prism;
        float beltGlow = belt * exp(-pow(vLocal.y / 0.05, 2.0));
        float core = exp(-pow(vLocal.y / 0.26, 2.0));

        vec3 radial = normalize(vec3(n.x, 0.0, n.z) + 1e-5);
        float side = pow(max(dot(radial, beamDir), 0.0), 10.0);
        float through = 0.35 + 0.65 * pow(ndv, 1.5);
        float face = gl_FrontFacing ? 1.0 : 0.55;
        float boost = 1.0 + flash * 2.2;

        float light = (line * (0.8 + 1.6 * core) + beltGlow * 1.6) * through * face * boost;
        light += (line + beltGlow) * side * 2.0;
        vec3 color = glow * (0.08 + 0.12 * core + light);
        color += vec3(0.82, 0.88, 1.0) * fresnel * 0.25;
        color += vec3(1.0, 0.9, 0.72) * edge * 0.7;
        float exitPatch = pow(max(dot(radial, beamDir), 0.0), 6.0) * exp(-pow(vLocal.y / 0.2, 2.0));
        float inner = core * (0.3 + 0.7 * through) * approach;
        color += glow * (inner * 1.1 + exitPatch * (0.45 + 0.8 * approach));
        float alpha = clamp(0.05 + fresnel * 0.25 + line * 0.55 + beltGlow * 0.35 + edge * 0.45
          + inner * 0.22 + exitPatch * 0.3, 0.0, 0.9);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      glow: { value: new THREE.Color(1.0, 0.9, 0.74) },
      lampPos: { value: new THREE.Vector3(0, LAMP_Y, 0) },
      beamDir: shared.beamDir,
      beamFade: shared.beamFade,
      bloomMode: shared.bloomMode,
      wallRadius: { value: ROOM_RADIUS },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 glow;
      uniform vec3 lampPos;
      uniform vec3 beamDir;
      uniform float beamFade;
      uniform float bloomMode;
      uniform float wallRadius;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        float along = dot(vWorld - lampPos, beamDir);
        vec3 v = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormal), v));
        float axial = abs(dot(v, beamDir));
        float widest = max(sqrt(max(1.0 - axial * axial, 0.0)), 0.06);
        float soft = clamp(facing / widest, 0.0, 1.0);
        soft *= soft;
        float start = smoothstep(${(LENS_RADIUS - 0.03).toFixed(2)}, ${(LENS_RADIUS + 0.08).toFixed(2)}, along);
        float outside = smoothstep(wallRadius - 0.2, wallRadius + 1.4, along);
        float exitGlow = exp(-(along - ${LENS_RADIUS.toFixed(2)}) / 0.45);
        float haze = mix(0.2, 1.0, outside) + 0.55 * exitGlow;
        float tail = 1.0 - smoothstep(wallRadius + 3.0, 55.0, along);
        tail *= tail;
        float endOn = 1.0 - 0.6 * smoothstep(0.8, 0.98, axial);
        float alpha = start * haze * tail * soft * endOn * 0.34 * beamFade;
        alpha = mix(alpha, max(alpha - 0.15, 0.0) * 0.9, bloomMode);
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(glow, alpha);
      }
    `,
  });
}

async function addPanorama() {
  const source = await loadImage("images/pano-night.jpg");
  const moon = findMoon(source);
  const painted = paintOutMoon(source, moon);
  const texture = new THREE.Texture(painted);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;

  panoGroup = new THREE.Group();
  panoGroup.position.y = EYE;
  scene.add(panoGroup);

  const bandHeight = Math.PI * 2 * PANO_RADIUS * PANO_ASPECT;
  const moonU = moon.x / source.width;
  const moonAzimuth = Math.PI + MOON_OFFSET;
  const rotation = moonAzimuth - moonU * Math.PI * 2;

  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(PANO_RADIUS, PANO_RADIUS, bandHeight, 128, 1, true),
    panoramaMaterial(texture),
  );
  pano.position.y = -bandHeight * (PANO_HORIZON - 0.5);
  pano.rotation.y = rotation;
  pano.renderOrder = -10;
  panoGroup.add(pano);

  const moonDistance = PANO_RADIUS - 0.4;
  const moonRadius = (moon.radius / 4.5) * (bandHeight / source.height) * (moonDistance / PANO_RADIUS);
  const moonPosition = new THREE.Vector3(
    Math.sin(moonAzimuth) * moonDistance,
    Math.tan(MOON_ELEVATION) * moonDistance,
    Math.cos(moonAzimuth) * moonDistance,
  );

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(moonRadius * 14, moonRadius * 14),
    new THREE.MeshBasicMaterial({
      map: radialTexture([
        [0, "rgba(255,255,255,0.3)"],
        [0.075, "rgba(230,236,250,0.2)"],
        [0.16, "rgba(205,216,240,0.08)"],
        [0.4, "rgba(190,205,235,0.025)"],
        [1, "rgba(190,205,235,0)"],
      ]),
      color: new THREE.Color(0.75, 0.82, 0.95),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.copy(moonPosition).multiplyScalar(1.01);
  halo.rotation.y = moonAzimuth + Math.PI;
  halo.renderOrder = -8;
  panoGroup.add(halo);

  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(moonRadius * 2, moonRadius * 2),
    new THREE.MeshBasicMaterial({
      map: moonTexture(source, moon),
      color: new THREE.Color(0.96, 0.96, 0.94),
      transparent: true,
      depthWrite: false,
    }),
  );
  disc.position.copy(moonPosition);
  disc.rotation.y = moonAzimuth + Math.PI;
  disc.renderOrder = -7;
  disc.layers.enable(BLOOM_LAYER);
  bloomTints.push({
    material: disc.material,
    color: disc.material.color.clone(),
    bloom: new THREE.Color(0.3, 0.31, 0.34),
  });
  panoGroup.add(disc);

  const stars = starField(moonAzimuth);
  panoGroup.add(stars);
  reflection.hidden.push(stars);
}

function panoramaMaterial(texture) {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      map: { value: texture },
      time: shared.time,
      motion: shared.motion,
      beamDir: shared.beamDir,
      horizon: { value: PANO_HORIZON },
      sweepColor: { value: new THREE.Color(1.0, 0.86, 0.66) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vDir;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float time;
      uniform float motion;
      uniform vec3 beamDir;
      uniform float horizon;
      uniform vec3 sweepColor;
      varying vec2 vUv;
      varying vec3 vDir;
      void main() {
        vec2 uv = vUv;
        float below = clamp((horizon - uv.y) / horizon, 0.0, 1.0);
        float sea = step(uv.y, horizon);
        float near = pow(smoothstep(0.0, 0.18, below), 1.6);

        float depth = 1.5 / (below + 0.03);
        vec2 p = vec2(uv.x * 6.2832 * depth, depth);
        float t = time * motion;
        float swell1 = sin(dot(p, vec2(0.35, 0.6)) - t * 0.5);
        float swell2 = sin(dot(p, vec2(-0.45, 0.5)) - t * 0.36 + 1.3);
        float chop1 = sin(dot(p, vec2(1.5, 3.0)) - t * 0.95 + 2.1);
        float chop2 = sin(dot(p, vec2(-2.0, 3.4)) - t * 1.1 + 4.7);
        float ripple1 = sin(dot(p, vec2(4.4, 7.6)) - t * 1.7);
        float ripple2 = sin(dot(p, vec2(-5.2, 6.4)) - t * 1.9 + 0.9);
        vec2 shift = vec2(
          swell1 * 0.45 - swell2 * 0.25 + chop1 * 0.2 - chop2 * 0.15 + ripple1 * 0.08,
          swell1 * 0.5 + swell2 * 0.4 + chop1 * 0.25 + chop2 * 0.2 + ripple1 * 0.08 + ripple2 * 0.07
        );
        float lift = near * sea * motion;
        uv += shift * vec2(0.0035, 0.0055) * lift;
        if (sea > 0.5) uv.y = min(uv.y, horizon - 0.0015);

        vec3 color = texture2D(map, uv).rgb;

        float path = smoothstep(0.03, 0.16, dot(color, vec3(0.3, 0.5, 0.2)));
        color *= 1.0 + (chop1 * 0.22 + ripple1 * 0.14 + swell1 * 0.1) * path * lift;
        vec2 g = p * vec2(3.1, 2.3);
        float glint = max(sin(g.x * 1.7 + t * 1.3 + swell1 * 2.0) * sin(g.y * 2.9 - t * 1.1 + chop2 * 1.5), 0.0);
        glint = pow(glint, 12.0);
        float glintFade = smoothstep(0.015, 0.09, below);
        color += vec3(0.85, 0.9, 1.0) * glint * path * glintFade * sea * motion * 0.55;

        vec2 heading = normalize(vDir.xz);
        float angle = acos(clamp(dot(heading, normalize(beamDir.xz)), -1.0, 1.0));
        float wedge = exp(-pow(angle / 0.09, 2.0)) * 0.75 + exp(-pow(angle / 0.28, 2.0)) * 0.25;
        float rise = uv.y - horizon;
        float vertical = rise > 0.0 ? exp(-rise / 0.07) : exp(rise / 0.05) * 0.6;
        float ripple = sea > 0.5 ? 0.8 + 0.4 * glint + 0.2 * swell1 * motion : 1.0;
        color += sweepColor * wedge * vertical * ripple * 0.11;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function starField(moonAzimuth) {
  const count = 150;
  const brightCount = 8;
  const radius = PANO_RADIUS - 0.8;
  const stars = [];
  while (stars.length < count) {
    const azimuth = Math.random() * Math.PI * 2;
    const rise = Math.random() ** 1.4;
    const elevation = (2.5 + rise * 30) * DEG;
    const fromMoon = Math.abs(Math.atan2(Math.sin(azimuth - moonAzimuth), Math.cos(azimuth - moonAzimuth)));
    if (fromMoon < 0.12 && Math.abs(elevation - MOON_ELEVATION) < 0.12) continue;
    const bright = stars.length < brightCount;
    stars.push({
      position: [
        Math.sin(azimuth) * radius * Math.cos(elevation),
        Math.sin(elevation) * radius,
        Math.cos(azimuth) * radius * Math.cos(elevation),
      ],
      seed: [
        bright ? 2 + Math.random() * 0.5 : 1 + Math.random(),
        bright ? 1.3 + Math.random() * 0.3 : 0.5 + Math.random() * 0.5,
        0.7 + Math.random() * 0.8,
        Math.random() * 100,
      ],
      extra: [rise, Math.random() < 0.15 ? 1 : 0],
    });
  }

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: shared.time,
      motion: shared.motion,
      pixelRatio: shared.pixelRatio,
      bloomMode: shared.bloomMode,
    },
    vertexShader: `
      attribute vec4 seed;
      attribute vec2 extra;
      uniform float time;
      uniform float motion;
      uniform float pixelRatio;
      uniform float bloomMode;
      varying vec3 vColor;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(float x) {
        float i = floor(x);
        float f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(hash(i), hash(i + 1.0), f);
      }
      void main() {
        float low = 1.0 - extra.x;
        float rate = seed.z * mix(0.6, 1.5, low);
        float t = time * motion * rate + seed.w;
        float n = noise(t * 7.0) * 0.6 + noise(t * 17.0 + 11.0) * 0.4;
        float depth = mix(0.15, 0.85, low * low);
        float flicker = mix(1.0, 1.0 + depth * (n * 2.0 - 1.0) * 1.3, motion);
        vec3 tint = vec3(0.82, 0.88, 1.0);
        if (extra.y > 0.5) {
          vec3 shifted = mix(vec3(1.0, 0.76, 0.62), vec3(0.62, 0.8, 1.0), noise(t * 9.0 + 5.0));
          tint = mix(tint, shifted, 0.75 * motion);
        }
        vColor = tint * seed.y * max(flicker, 0.05) * mix(1.0, 0.35, bloomMode);
        gl_PointSize = seed.x * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.4, 1.0, d);
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

  const group = new THREE.Group();
  [stars.slice(brightCount), stars.slice(0, brightCount)].forEach((set, index) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(set.flatMap((star) => star.position), 3));
    geometry.setAttribute("seed", new THREE.Float32BufferAttribute(set.flatMap((star) => star.seed), 4));
    geometry.setAttribute("extra", new THREE.Float32BufferAttribute(set.flatMap((star) => star.extra), 2));
    const points = new THREE.Points(geometry, material);
    points.renderOrder = -9;
    points.frustumCulled = false;
    if (index === 1) points.layers.enable(BLOOM_LAYER);
    group.add(points);
  });
  return group;
}

async function addArtworks(brass) {
  const loader = new THREE.TextureLoader();
  const panelGlass = new THREE.MeshStandardMaterial({
    color: 0xd8ebe4,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.06,
    envMapIntensity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassEdge = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.52, 0.49) });
  const matte = new THREE.MeshStandardMaterial({ color: 0xece8df, roughness: 0.9, envMapIntensity: 0.6 });
  const fixtures = spotFixtureParts();

  await Promise.all(WORKS.map((work, index) => new Promise((resolve, reject) => {
    loader.load(
      `images/full/${work.file}.jpg`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const [width, height] = fit(texture.image.width, texture.image.height, 0.98, 0.86);
        const angle = artAngle(index);
        artAngles[index] = angle;

        const group = new THREE.Group();
        group.position.set(Math.sin(angle) * ART_RADIUS, 0, Math.cos(angle) * ART_RADIUS);
        group.rotation.y = angle + Math.PI;

        const panelWidth = width + 0.5;
        const panelBottom = 0.1;
        const panelTop = 2.15;
        const panelHeight = panelTop - panelBottom;
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth, panelHeight), panelGlass);
        sheet.position.y = panelBottom + panelHeight / 2;
        sheet.renderOrder = 2;
        group.add(sheet);
        addGlassEdge(group, panelWidth, panelHeight, panelBottom + panelHeight / 2, glassEdge);

        const matWidth = width + 0.2;
        const matHeight = height + 0.24;
        const matBoard = new THREE.Mesh(new THREE.PlaneGeometry(matWidth, matHeight), matte);
        matBoard.position.set(0, ART_Y, 0.012);
        matBoard.userData.index = index;
        group.add(matBoard);

        const spot = addSpot(angle, brass, fixtures);
        const painting = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          pooledArtMaterial(texture, spot),
        );
        painting.position.set(0, ART_Y, 0.017);
        painting.userData.index = index;
        group.add(painting);
        artMeshes.push(painting, matBoard);

        addFrame(group, matWidth, matHeight, ART_Y, brass);
        addFoot(group, brass);
        scene.add(group);
        resolve();
      },
      undefined,
      reject,
    );
  })));
}

function spotAim(angle) {
  const fixture = new THREE.Vector3(
    Math.sin(angle) * FIXTURE_RADIUS,
    CEILING_Y - 0.07,
    Math.cos(angle) * FIXTURE_RADIUS,
  );
  const target = new THREE.Vector3(Math.sin(angle) * ART_RADIUS, ART_Y + 0.05, Math.cos(angle) * ART_RADIUS);
  const direction = target.clone().sub(fixture).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
  const origin = fixture.clone().addScaledVector(direction, 0.05);
  return { fixture, target, tilt, origin };
}

function spotFixtureParts() {
  const warm = new THREE.Color(1.0, 0.8, 0.55);
  const lensMaterial = new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(2.6) });
  bloomTints.push({
    material: lensMaterial,
    color: lensMaterial.color.clone(),
    bloom: warm.clone().multiplyScalar(0.8),
  });
  const lens = new THREE.SphereGeometry(0.043, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  lens.scale(1, 0.4, 1);

  const { origin, target } = spotAim(0);
  const length = origin.distanceTo(target);
  const cone = new THREE.CylinderGeometry(0.04, 0.45, length, 32, 1, true);
  cone.translate(0, -length / 2, 0);

  return {
    can: new THREE.CylinderGeometry(0.04, 0.05, 0.1, 20),
    lens,
    lensMaterial,
    cone,
    coneMaterial: spotConeMaterial(length),
  };
}

function addSpot(angle, brass, parts) {
  const { fixture, target, tilt, origin } = spotAim(angle);

  const can = new THREE.Mesh(parts.can, brass);
  can.position.copy(fixture);
  can.quaternion.copy(tilt);
  const lens = new THREE.Mesh(parts.lens, parts.lensMaterial);
  lens.position.copy(origin);
  lens.quaternion.copy(tilt);
  lens.layers.enable(BLOOM_LAYER);
  const cone = new THREE.Mesh(parts.cone, parts.coneMaterial);
  cone.position.copy(origin);
  cone.quaternion.copy(tilt);
  cone.renderOrder = 3;
  reflection.hidden.push(cone);

  const spot = new THREE.SpotLight(0xffe2bd, 58, 8, 0.3, 0.8, 2);
  spot.position.copy(origin);
  spot.target.position.copy(target);
  scene.add(can, lens, cone, spot, spot.target);
  artSpots.push(spot);
  return spot;
}

function spotConeMaterial(length) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { glow: { value: new THREE.Color(1.0, 0.86, 0.66) } },
    vertexShader: `
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vAlong = -position.y / ${length.toFixed(3)};
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 glow;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 v = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormal), v));
        float soft = facing * facing * facing;
        float fade = smoothstep(0.0, 0.08, vAlong) * (1.0 - smoothstep(0.7, 1.0, vAlong)) * (1.0 - 0.5 * vAlong);
        gl_FragColor = vec4(glow, soft * fade * 0.06);
      }
    `,
  });
}

function pooledArtMaterial(texture, spot) {
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const origin = spot.position.clone();
  const direction = spot.target.position.clone().sub(origin).normalize();
  const cone = new THREE.Vector2(Math.cos(spot.angle * 0.72), Math.cos(spot.angle * 0.08));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.spotOrigin = { value: origin };
    shader.uniforms.spotDirection = { value: direction };
    shader.uniforms.spotCone = { value: cone };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPoolWorld;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvPoolWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 spotOrigin;\nuniform vec3 spotDirection;\nuniform vec2 spotCone;\nvarying vec3 vPoolWorld;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float pool = smoothstep(spotCone.x, spotCone.y, dot(normalize(vPoolWorld - spotOrigin), spotDirection));
        diffuseColor.rgb *= mix(vec3(0.62), vec3(0.93, 0.9, 0.84), pool);`,
      );
  };
  return material;
}

function addGlassEdge(group, width, height, y, material) {
  const t = 0.012;
  const bars = [
    [width, t, 0, y + height / 2 - t / 2],
    [width, t, 0, y - height / 2 + t / 2],
    [t, height, -width / 2 + t / 2, y],
    [t, height, width / 2 - t / 2, y],
  ];
  bars.forEach(([w, h, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), material);
    bar.position.set(x, barY, 0);
    group.add(bar);
  });
}

function addFrame(group, width, height, y, brass) {
  const z = 0.016;
  const thick = 0.016;
  const bars = [
    [width + thick * 2, thick, 0, y + height / 2 + thick / 2],
    [width + thick * 2, thick, 0, y - height / 2 - thick / 2],
    [thick, height, -width / 2 - thick / 2, y],
    [thick, height, width / 2 + thick / 2, y],
  ];
  bars.forEach(([w, h, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.014), brass);
    bar.position.set(x, barY, z);
    group.add(bar);
  });
}

function addFoot(group, brass) {
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.045), brass);
  clip.position.y = 0.1;
  group.add(clip);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.07, 16), brass);
  post.position.y = 0.04;
  group.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.018, 32), brass);
  base.position.y = 0.009;
  group.add(base);
}

function artAngle(index) {
  return Math.PI + Math.PI / 9 - index * ((Math.PI * 2) / TOTAL);
}

function captureEnvironment() {
  beam.visible = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02, 0.05, 60, {
    size: 128,
    position: new THREE.Vector3(0, 1.7, 0),
  });
  pmrem.dispose();
  scene.environment = target.texture;
  scene.environmentIntensity = 2.7;
  beam.visible = true;
}

function setupComposers() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const sceneTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    samples: small ? 2 : 4,
  });
  const bloomTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
  });

  bloomComposer = new EffectComposer(renderer, bloomTarget);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 1.1, 0.55, 0.0));

  const mix = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
        }
      `,
    }),
    "baseTexture",
  );
  mix.needsSwap = true;

  finalComposer = new EffectComposer(renderer, sceneTarget);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(mix);
  finalComposer.addPass(new OutputPass());
}

function sortBloomObjects() {
  scene.traverse((object) => {
    if (!object.isMesh && !object.isPoints && !object.isSprite) return;
    if (object.layers.test(bloomLayer)) return;
    if (object.isPoints || object.material.transparent || object.renderOrder === -10) {
      hideInBloom.push(object);
    } else {
      object.userData.material = object.material;
      darkenInBloom.push(object);
    }
  });
}

function renderFrame() {
  renderReflection();

  darkenInBloom.forEach((mesh) => {
    mesh.material = darkMaterial;
  });
  hideInBloom.forEach((object) => {
    object.visible = false;
  });
  scene.background = null;
  shared.bloomMode.value = 1;
  bloomTints.forEach((tint) => tint.material.color.copy(tint.bloom));
  bloomComposer.render();
  bloomTints.forEach((tint) => tint.material.color.copy(tint.color));

  darkenInBloom.forEach((mesh) => {
    mesh.material = mesh.userData.material;
  });
  hideInBloom.forEach((object) => {
    object.visible = true;
  });
  scene.background = navy;
  shared.bloomMode.value = 0;
  finalComposer.render();
}

function bindLook() {
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    if (!lightbox.hidden || !event.isPrimary) return;
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    noteInteraction();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!event.isPrimary) return;
    if (!dragging) {
      showHover(event);
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = event.clientX;
    lastY = event.clientY;
    noteInteraction();
    if (view.mode !== "ring") return;
    view.thetaGoal += dx * 0.004;
    view.pitchGoal = clamp(view.pitchGoal - dy * 0.003, PITCH_MIN, PITCH_MAX);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!event.isPrimary) return;
    if (dragging && moved < 7) clickRoom(event);
    dragging = false;
  });

  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });

  canvas.addEventListener("pointerleave", () => {
    if (view.mode === "ring") hoverLabel.hidden = true;
    canvas.style.cursor = "";
  });

  canvas.addEventListener("wheel", noteInteraction, { passive: true });
}

function showHover(event) {
  if (view.mode === "gliding") return;
  const hit = cast(event)[0];
  canvas.style.cursor = hit ? "pointer" : "";
  if (view.mode === "focus") return;
  if (!hit) {
    hoverLabel.hidden = true;
    return;
  }
  hoverLabel.hidden = false;
  hoverLabel.textContent = WORKS[hit.object.userData.index].title;
}

function clickRoom(event) {
  if (view.mode === "gliding") return;
  const hit = cast(event)[0];
  if (!hit) return;
  const index = hit.object.userData.index;
  if (view.mode === "focus" && index === view.focus) openAt(index);
  else visitArtwork(index);
}

function cast(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(artMeshes, false);
}

function visitArtwork(index) {
  if (view.mode === "ring") view.ringReturn = { theta: view.theta, pitch: view.pitch };
  const angle = artAngles[index];
  const standAt = ART_RADIUS - FOCUS_GAP;
  const position = new THREE.Vector3(Math.sin(angle) * standAt, EYE, Math.cos(angle) * standAt);
  const target = new THREE.Vector3(Math.sin(angle) * ART_RADIUS, ART_Y, Math.cos(angle) * ART_RADIUS);
  current = index;
  view.focus = index;
  hoverLabel.hidden = true;
  glideTo(position, target, "focus");
}

function leaveArtwork() {
  if (view.mode === "ring" || !view.ringReturn) return;
  const { theta, pitch } = view.ringReturn;
  view.theta = view.thetaGoal = theta;
  view.pitch = view.pitchGoal = pitch;
  const { position, target } = ringPose(theta, pitch);
  view.focus = -1;
  hoverLabel.hidden = true;
  glideTo(position, target, "ring");
}

function glideTo(position, target, endMode) {
  poseHelper.position.copy(position);
  poseHelper.lookAt(target);
  const distance = camera.position.distanceTo(position);
  view.glide = {
    fromPosition: camera.position.clone(),
    fromQuaternion: camera.quaternion.clone(),
    toPosition: position.clone(),
    toQuaternion: poseHelper.quaternion.clone(),
    progress: 0,
    duration: reduceMotion.matches ? 0 : 1.3 + distance * 0.18,
    endMode,
  };
  view.mode = "gliding";
  backButton.hidden = endMode !== "focus";
  if (!running) advanceGlide(0);
}

function advanceGlide(delta) {
  const glide = view.glide;
  glide.progress = glide.duration ? Math.min(1, glide.progress + delta / glide.duration) : 1;
  const t = glide.progress;
  const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  camera.position.lerpVectors(glide.fromPosition, glide.toPosition, eased);
  camera.quaternion.slerpQuaternions(glide.fromQuaternion, glide.toQuaternion, eased);
  if (t >= 1) {
    view.mode = glide.endMode;
    view.glide = null;
    updateFocusLabel();
  }
}

function updateFocusLabel() {
  if (view.mode !== "focus") return;
  const action = coarsePointer.matches ? "Tap" : "Click";
  hoverLabel.textContent = `${WORKS[view.focus].title} · ${action} to enlarge`;
  hoverLabel.hidden = false;
}

function ringPose(theta, pitch) {
  const position = new THREE.Vector3(Math.sin(theta) * RING, EYE, Math.cos(theta) * RING);
  const cos = Math.cos(pitch);
  const target = new THREE.Vector3(
    position.x - Math.sin(theta) * cos,
    EYE + Math.sin(pitch),
    position.z - Math.cos(theta) * cos,
  );
  return { position, target };
}

function applyRingPose() {
  const { position, target } = ringPose(view.theta, view.pitch);
  camera.position.copy(position);
  camera.lookAt(target);
}

function noteInteraction() {
  lastInput = performance.now();
}

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

function fitFov() {
  const aspect = window.innerWidth / window.innerHeight;
  const minimumHorizontal = 80 * DEG;
  const vertical = 2 * Math.atan(Math.tan(minimumHorizontal / 2) / aspect) / DEG;
  return clamp(vertical, 55, 82);
}

function resize() {
  if (!renderer) return;
  const ratio = pixelRatio();
  shared.pixelRatio.value = ratio;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = fitFov();
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const mirrorScale = Math.min(window.innerWidth, window.innerHeight) < 700 ? 0.25 : 0.35;
  const mirrorWidth = Math.max(1, Math.round(window.innerWidth * ratio * mirrorScale));
  const mirrorHeight = Math.max(1, Math.round(window.innerHeight * ratio * mirrorScale));
  reflection.target.setSize(mirrorWidth, mirrorHeight);
  reflection.texel.set(1 / mirrorWidth, 1 / mirrorHeight);
  if (!finalComposer) return;
  finalComposer.setPixelRatio(ratio);
  finalComposer.setSize(window.innerWidth, window.innerHeight);
  bloomComposer.setPixelRatio(ratio * 0.5);
  bloomComposer.setSize(window.innerWidth, window.innerHeight);
}

function resumeRoom() {
  if (running || !renderer) return;
  running = true;
  clock.getDelta();
  raf = requestAnimationFrame(tick);
}

function pauseRoom() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

const towardCamera = new THREE.Vector3();

function tick() {
  if (!running || !lightbox.hidden) {
    running = false;
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(tick);
  const delta = Math.min(clock.getDelta(), 0.05);
  const still = reduceMotion.matches;
  shared.motion.value = still ? 0 : 1;
  if (!still) {
    shared.time.value += delta;
    beamAngle += delta * BEAM_SPEED;
  }

  if (view.mode === "gliding") {
    advanceGlide(delta);
  } else if (view.mode === "ring") {
    if (!still && performance.now() - lastInput > IDLE_DELAY) view.thetaGoal += delta * IDLE_SPEED;
    const ease = 1 - Math.exp(-delta * 9);
    view.theta += (view.thetaGoal - view.theta) * ease;
    view.pitch += (view.pitchGoal - view.pitch) * ease;
    applyRingPose();
  }

  panoGroup.position.x = camera.position.x;
  panoGroup.position.z = camera.position.z;

  beam.rotation.y = beamAngle;
  const beamDir = shared.beamDir.value.set(Math.cos(beamAngle), 0, -Math.sin(beamAngle));
  towardCamera.set(camera.position.x, 0, camera.position.z).normalize();
  const facing = beamDir.dot(towardCamera);
  shared.beamFade.value = 1 - smooth(0.45, 0.88, facing);
  const flash = smooth(0.9, 1, facing) ** 2;
  const approach = smooth(0.15, 1, facing) ** 1.5;
  shared.flash.value = flash;
  shared.approach.value = approach;
  lampCore.material.color.copy(lampCoreColor).multiplyScalar(7 + approach * 5 + flash * 12);
  lampHalo.material.opacity = Math.min(1, 0.6 + approach * 0.3 + flash * 0.3);
  lampHalo.scale.setScalar(0.5 + approach * 0.3 + flash * 0.35);

  renderFrame();
}

function findMoon(image) {
  const sample = document.createElement("canvas");
  sample.width = image.width;
  sample.height = Math.floor(image.height * 0.55);
  const context = sample.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, sample.width, sample.height);
  const luminance = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
  };

  const block = 32;
  let best = -1;
  let blockX = 0;
  let blockY = 0;
  for (let y = 0; y + block <= height; y += block / 2) {
    for (let x = 0; x + block <= width; x += block / 2) {
      let sum = 0;
      for (let dy = 0; dy < block; dy += 4) {
        for (let dx = 0; dx < block; dx += 4) sum += luminance(x + dx, y + dy);
      }
      if (sum > best) {
        best = sum;
        blockX = x + block / 2;
        blockY = y + block / 2;
      }
    }
  }

  let count = 0;
  let sumX = 0;
  let sumY = 0;
  const reach = 220;
  for (let y = Math.max(0, blockY - reach); y < Math.min(height, blockY + reach); y += 1) {
    for (let x = Math.max(0, blockX - reach); x < Math.min(width, blockX + reach); x += 1) {
      if (luminance(x, y) > 120) {
        count += 1;
        sumX += x;
        sumY += y;
      }
    }
  }
  const x = count ? sumX / count : blockX;
  const y = count ? sumY / count : blockY;
  const radius = Math.max(24, Math.sqrt(count / Math.PI));

  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let turn = 0; turn < 48; turn += 1) {
    const angle = (turn / 48) * Math.PI * 2;
    const sx = Math.round(x + Math.cos(angle) * radius * 2.6);
    const sy = Math.round(y + Math.sin(angle) * radius * 2.6);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
    const i = (sy * width + sx) * 4;
    red += data[i];
    green += data[i + 1];
    blue += data[i + 2];
    samples += 1;
  }
  return { x, y, radius, sky: [red / samples, green / samples, blue / samples] };
}

function paintOutMoon(image, moon) {
  const output = document.createElement("canvas");
  output.width = image.width;
  output.height = image.height;
  const context = output.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);

  const reach = moon.radius * 2.4;
  const left = Math.max(0, Math.floor(moon.x - reach));
  const top = Math.max(0, Math.floor(moon.y - reach));
  const size = Math.ceil(reach * 2);
  const patch = context.getImageData(left, top, size, size);
  const { data } = patch;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(left + x - moon.x, top + y - moon.y);
      if (distance > reach) continue;
      const keep = smooth(moon.radius * 1.05, reach, distance);
      const i = (y * size + x) * 4;
      data[i] = data[i] * keep + moon.sky[0] * (1 - keep);
      data[i + 1] = data[i + 1] * keep + moon.sky[1] * (1 - keep);
      data[i + 2] = data[i + 2] * keep + moon.sky[2] * (1 - keep);
    }
  }
  context.putImageData(patch, left, top);

  const stars = Math.round((Math.PI * reach * reach) / 1400);
  for (let i = 0; i < stars; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * reach * 0.95;
    context.fillStyle = `rgba(225, 232, 245, ${0.35 + Math.random() * 0.5})`;
    context.fillRect(moon.x + Math.cos(angle) * distance, moon.y + Math.sin(angle) * distance, 1.5, 1.5);
  }
  return output;
}

function moonTexture(image, moon) {
  const size = 256;
  const crop = moon.radius * 1.04;
  const output = document.createElement("canvas");
  output.width = size;
  output.height = size;
  const context = output.getContext("2d");
  context.drawImage(image, moon.x - crop, moon.y - crop, crop * 2, crop * 2, 0, 0, size, size);
  const limb = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  limb.addColorStop(0, "rgb(255,255,255)");
  limb.addColorStop(0.6, "rgb(240,240,242)");
  limb.addColorStop(1, "rgb(165,168,178)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = limb;
  context.fillRect(0, 0, size, size);
  const mask = context.createRadialGradient(size / 2, size / 2, size * 0.33, size / 2, size / 2, size * 0.5);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(0.55, "rgba(0,0,0,0.75)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = mask;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(output);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function radialTexture(stops) {
  const size = 256;
  const output = document.createElement("canvas");
  output.width = size;
  output.height = size;
  const context = output.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(output);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function shadeRadially(geometry, shade, tint) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const value = shade(Math.hypot(position.getX(i), position.getY(i)));
    colors.set([tint.r * value, tint.g * value, tint.b * value], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function shadeVertically(geometry, height, shade, tint) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const value = shade(position.getY(i) / height + 0.5);
    colors.set([tint.r * value, tint.g * value, tint.b * value], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fit(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return [width * scale, height * scale];
}

function smooth(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
