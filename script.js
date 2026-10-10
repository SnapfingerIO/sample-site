import * as THREE from "three";
import { RoomEnvironment } from "./vendor/three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "./vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./vendor/three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "./vendor/three/addons/postprocessing/ShaderPass.js";

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
const EYE = 1.6;
const RING = 1.8;
const ART_RADIUS = 4.45;
const ROOM_RADIUS = 7;
const ROOM_HEIGHT = 4;
const VIEW_RADIUS = 12;
const PITCH_MIN = -15 * Math.PI / 180;
const PITCH_MAX = 35 * Math.PI / 180;
const HORIZON = 0.57;
const PANO_ASPECT = 1280 / 2720;
const BLOOM_LAYER = 1;

const grid = document.querySelector("#grid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxTitle = document.querySelector("#lightbox-title");
const lightboxCaption = document.querySelector("#lightbox-caption");
const hoverLabel = document.querySelector("#hover-label");
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
  if (event.key === "Escape") {
    retreat();
    return;
  }
  const turn = 0.08;
  if (event.key === "ArrowLeft") changeLook(turn, 0);
  if (event.key === "ArrowRight") changeLook(-turn, 0);
  if (event.key === "ArrowUp") changeLook(0, 0.04);
  if (event.key === "ArrowDown") changeLook(0, -0.04);
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const backButton = document.querySelector("#back-to-ring");
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const bloomHidden = [];
const bloomSwapped = [];
const black = new THREE.Color(0x000000);

let renderer;
let scene;
let camera;
let bloomComposer;
let finalComposer;
let mixPass;
let beam;
const beamFaces = [];
let coreMaterial;
let panoMesh;
let panoTime;
let panoMotion;
let beamUv;
let stars;
let starTime;
let artMeshes = [];
let raf = 0;
let running = false;
let autoOrbit = false;
let idleAt = performance.now() + 8000;
let orbit = 0;
let pitch = 0.16;
let focusIndex = null;
let ringOrbit = 0;
let ringPitch = 0.16;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const lookAt = new THREE.Vector3();
const beamDirection = new THREE.Vector3();
const glide = { active: false, t: 0, duration: 1.15, from: null, to: null, index: null };

backButton.addEventListener("click", retreat);

if (hasWebGL()) {
  buildRoom().catch(() => {
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

function artAngle(index) {
  return Math.PI / 9 + index * ((Math.PI * 2) / TOTAL);
}

function ringPose(yaw, tilt) {
  const x = -Math.sin(yaw) * RING;
  const z = Math.cos(yaw) * RING;
  const cos = Math.cos(tilt);
  return {
    x,
    y: EYE,
    z,
    lx: x + Math.sin(yaw) * cos,
    ly: EYE + Math.sin(tilt),
    lz: z - Math.cos(yaw) * cos,
  };
}

function artPose(index, tilt) {
  const angle = artAngle(index);
  const dist = ART_RADIUS - 1.5;
  return {
    x: Math.sin(angle) * dist,
    y: EYE,
    z: -Math.cos(angle) * dist,
    lx: Math.sin(angle) * ART_RADIUS,
    ly: 1.58 + Math.sin(tilt) * 1.1,
    lz: -Math.cos(angle) * ART_RADIUS,
  };
}

function setCamera(pose) {
  camera.position.set(pose.x, pose.y, pose.z);
  lookAt.set(pose.lx, pose.ly, pose.lz);
  camera.lookAt(lookAt);
}

function currentPose() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    lx: camera.position.x + dir.x,
    ly: camera.position.y + dir.y,
    lz: camera.position.z + dir.z,
  };
}

function lerpPose(from, to, k) {
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    z: from.z + (to.z - from.z) * k,
    lx: from.lx + (to.lx - from.lx) * k,
    ly: from.ly + (to.ly - from.ly) * k,
    lz: from.lz + (to.lz - from.lz) * k,
  };
}

function applyCamera() {
  if (glide.active) return;
  setCamera(focusIndex === null ? ringPose(orbit, pitch) : artPose(focusIndex, pitch));
}

function startGlide(to, index) {
  glide.active = true;
  glide.t = 0;
  glide.from = currentPose();
  glide.to = to;
  glide.index = index;
  autoOrbit = false;
  updateBack();
}

function approachArt(index) {
  if (glide.active) return;
  if (focusIndex === index) {
    openAt(index, null);
    return;
  }
  ringOrbit = orbit;
  ringPitch = pitch;
  pitch = 0;
  startGlide(artPose(index, 0), index);
}

function retreat() {
  if (!glide.active && focusIndex === null) return;
  startGlide(ringPose(ringOrbit, ringPitch), null);
}

function updateBack() {
  const approaching = glide.active && glide.index !== null;
  backButton.hidden = lightbox.hidden === false || (focusIndex === null && !approaching);
}

function updateGlide(delta, still) {
  if (!glide.active) return;
  glide.t = Math.min(1, glide.t + (still ? 1 : delta / glide.duration));
  const k = glide.t * glide.t * (3 - 2 * glide.t);
  setCamera(lerpPose(glide.from, glide.to, k));
  if (glide.t < 1) return;
  glide.active = false;
  focusIndex = glide.index;
  if (focusIndex === null) {
    orbit = ringOrbit;
    pitch = ringPitch;
  }
  updateBack();
  applyCamera();
}

function noteInteraction() {
  autoOrbit = false;
  idleAt = performance.now() + 8000;
}

function changeLook(dYaw, dPitch) {
  if (glide.active) return;
  noteInteraction();
  if (focusIndex === null) orbit += dYaw;
  pitch = clamp(pitch + dPitch, PITCH_MIN, PITCH_MAX);
  applyCamera();
}

async function buildRoom() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  scene.environmentIntensity = 0.22;
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 80);

  const bandHeight = Math.PI * 2 * VIEW_RADIUS * PANO_ASPECT;
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, 0.04).texture;
  pmrem.dispose();
  environment.dispose();

  scene.add(new THREE.AmbientLight(0xf3e6d2, 0.11));
  scene.add(new THREE.HemisphereLight(0x8ea4c4, 0xc2a888, 0.035));

  const brass = new THREE.MeshStandardMaterial({
    color: 0xd7a84c,
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 0.7,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xf4f1ea,
    roughness: 0.55,
    metalness: 0,
  });
  const matte = new THREE.MeshStandardMaterial({
    color: 0xf3efe6,
    roughness: 0.9,
    metalness: 0,
  });

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM_RADIUS, 80),
    new THREE.MeshPhysicalMaterial({
      color: 0xf3eadc,
      emissive: 0xf4e6d2,
      emissiveIntensity: 0.26,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.22,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);

  const inlay = new THREE.Mesh(
    new THREE.TorusGeometry(2.65, 0.01, 12, 140),
    new THREE.MeshStandardMaterial({
      color: 0xe0b45e,
      metalness: 1,
      roughness: 0.28,
      envMapIntensity: 0.6,
    }),
  );
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = 0.02;
  scene.add(inlay);

  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 80), ceilingMaterial());
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  scene.add(ceiling);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.08,
    specularIntensity: 0.06,
    transparent: true,
    opacity: 0.02,
    envMapIntensity: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, ROOM_HEIGHT, 80, 1, true),
    glass,
  );
  wall.position.y = ROOM_HEIGHT / 2;
  wall.renderOrder = 2;
  scene.add(wall);

  const mullionGeo = new THREE.BoxGeometry(0.025, ROOM_HEIGHT, 0.028);
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const mullion = new THREE.Mesh(mullionGeo, white);
    mullion.position.set(Math.sin(angle) * (ROOM_RADIUS - 0.02), ROOM_HEIGHT / 2, Math.cos(angle) * (ROOM_RADIUS - 0.02));
    mullion.lookAt(0, ROOM_HEIGHT / 2, 0);
    scene.add(mullion);
  }

  const rail = new THREE.Mesh(new THREE.TorusGeometry(ROOM_RADIUS - 0.02, 0.01, 8, 120), white);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 2.15;
  scene.add(rail);

  addLamp(brass);

  const sourceImage = await loadImage("images/pano-night.jpg");
  const panoImage = paintSmallerMoon(sourceImage);
  const panoTexture = textureFromImage(panoImage);
  panoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  panoTexture.generateMipmaps = true;
  panoTexture.minFilter = THREE.LinearMipmapLinearFilter;
  const panoMaterial = new THREE.MeshBasicMaterial({ map: panoTexture, side: THREE.BackSide });
  dressPanorama(panoMaterial);
  panoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(VIEW_RADIUS, VIEW_RADIUS, bandHeight, 128, 1, true),
    panoMaterial,
  );
  panoMesh.position.y = EYE - bandHeight * (0.5 - HORIZON);
  panoMesh.rotation.y = Math.PI - moonFraction(panoImage) * Math.PI * 2 + 0.42;
  scene.add(panoMesh);
  addMoonGlow(panoImage, bandHeight);
  addStars();

  const sky = new THREE.Mesh(
    new THREE.CylinderGeometry(VIEW_RADIUS, VIEW_RADIUS, 12, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: edgeColor(panoImage, true), side: THREE.BackSide }),
  );
  sky.position.y = panoMesh.position.y + bandHeight / 2 + 6;
  scene.add(sky);
  const sea = new THREE.Mesh(
    new THREE.CylinderGeometry(VIEW_RADIUS, VIEW_RADIUS, 12, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: edgeColor(panoImage, false), side: THREE.BackSide }),
  );
  sea.position.y = panoMesh.position.y - bandHeight / 2 - 6;
  scene.add(sea);

  const panelGlass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 0.02,
    ior: 1.5,
    specularIntensity: 0.04,
    transparent: true,
    opacity: 1,
    envMapIntensity: 0.08,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const edgeGlow = new THREE.MeshBasicMaterial({
    color: 0xfffaf4,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const loader = new THREE.TextureLoader();

  await Promise.all(WORKS.map((work, index) => new Promise((resolve, reject) => {
    loader.load(
      `images/full/${work.file}.jpg`,
      (artTexture) => {
        artTexture.colorSpace = THREE.SRGBColorSpace;
        artTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const image = artTexture.image;
        const fitted = fit(image.width, image.height, 1.28, 1.62);
        const angle = artAngle(index);
        const group = new THREE.Group();
        group.position.set(Math.sin(angle) * ART_RADIUS, 0, -Math.cos(angle) * ART_RADIUS);
        group.rotation.y = -angle;

        const sheetWidth = fitted[0] + 0.5;
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(sheetWidth, 2.55), panelGlass);
        sheet.position.y = 1.48;
        sheet.renderOrder = 2;
        group.add(sheet);
        addGlassEdge(group, sheetWidth, 2.55, 1.48, edgeGlow);

        const matBoard = new THREE.Mesh(
          new THREE.PlaneGeometry(fitted[0] + 0.28, fitted[1] + 0.34),
          matte,
        );
        matBoard.position.set(0, 1.5, 0.025);
        group.add(matBoard);

        const painting = new THREE.Mesh(
          new THREE.PlaneGeometry(fitted[0], fitted[1]),
          new THREE.MeshBasicMaterial({ map: artTexture, depthWrite: true }),
        );
        painting.position.set(0, 1.5, 0.045);
        painting.renderOrder = 1;
        painting.userData.index = index;
        group.add(painting);
        artMeshes.push(painting);
        addFrame(group, fitted[0] + 0.28, fitted[1] + 0.34, 1.5, brass);
        addFoot(group, brass);

        const spot = new THREE.SpotLight(0xffd8ae, 6, 4.2, 0.34, 0.55, 2);
        spot.position.set(Math.sin(angle) * (ART_RADIUS - 0.45), 3.72, -Math.cos(angle) * (ART_RADIUS - 0.45));
        spot.target.position.set(Math.sin(angle) * ART_RADIUS, 1.5, -Math.cos(angle) * ART_RADIUS);
        scene.add(spot, spot.target);
        scene.add(group);
        resolve();
      },
      undefined,
      reject,
    );
  })));

  const renderPass = new RenderPass(scene, camera);
  bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.16, 0);
  const bloomSetSize = bloomPass.setSize.bind(bloomPass);
  bloomPass.setSize = (width, height) => {
    const scale = Math.min(window.innerWidth, window.innerHeight) < 800 ? 0.5 : 1;
    bloomSetSize(width * scale, height * scale);
  };
  bloomComposer.addPass(bloomPass);

  mixPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      bloomTexture: { value: null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec4 glow = texture2D(bloomTexture, vUv);
        gl_FragColor = vec4(base.rgb + glow.rgb, 1.0);
      }
    `,
  });
  finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());
  resize();
  applyCamera();
  document.body.classList.add("is-3d");
  bindLook();
  window.addEventListener("resize", resize);
  resumeRoom();
}

function prepareBloom(object) {
  if (object.isPoints) {
    bloomHidden.push(object);
    object.visible = false;
    return;
  }
  if (!object.isMesh || bloomLayer.test(object.layers)) return;
  if (object.material && object.material.transparent) {
    bloomHidden.push(object);
    object.visible = false;
    return;
  }
  bloomSwapped.push([object, object.material]);
  object.material = darkMaterial;
}

function restoreBloom() {
  bloomHidden.forEach((object) => {
    object.visible = true;
  });
  bloomHidden.length = 0;
  bloomSwapped.forEach(([object, material]) => {
    object.material = material;
  });
  bloomSwapped.length = 0;
}

function renderFrame() {
  const previous = scene.background;
  scene.background = black;
  scene.traverse(prepareBloom);
  camera.layers.enable(BLOOM_LAYER);
  bloomComposer.render();
  camera.layers.set(0);
  restoreBloom();
  scene.background = previous;
  mixPass.uniforms.bloomTexture.value = bloomComposer.readBuffer.texture;
  finalComposer.render();
}

function dressPanorama(material) {
  panoTime = { value: 0 };
  panoMotion = { value: reduceMotion.matches ? 0 : 1 };
  beamUv = { value: 0.5 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.time = panoTime;
    shader.uniforms.motion = panoMotion;
    shader.uniforms.beamUv = beamUv;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float time;\nuniform float motion;\nuniform float beamUv;\nvoid main() {",
      )
      .replace(
        "#include <map_fragment>",
        `
          vec2 oceanUv = vMapUv;
          float horizon = 0.43;
          float depth = smoothstep(horizon, horizon - 0.32, oceanUv.y);
          vec2 w1 = vec2(sin(oceanUv.x * 16.0 + time * 1.35), cos(oceanUv.y * 12.0 - time * 0.85));
          vec2 w2 = vec2(sin(oceanUv.x * 8.0 - oceanUv.y * 6.0 + time * 0.8), sin(oceanUv.y * 10.0 + time * 1.15));
          vec2 w3 = vec2(cos(oceanUv.x * 22.0 + oceanUv.y * 4.0 - time * 1.9), sin(oceanUv.x * 5.0 + time * 1.55));
          vec2 w4 = vec2(sin(oceanUv.y * 15.0 - time * 1.05), cos(oceanUv.x * 11.0 + time * 0.72));
          vec2 shift = w1 * 0.36 + w2 * 0.28 + w3 * 0.2 + w4 * 0.16;
          oceanUv += shift * (0.006 + 0.004 * depth) * depth * motion;
          vec4 sampledDiffuseColor = texture2D(map, oceanUv);
          float waterBright = smoothstep(0.22, 0.62, dot(sampledDiffuseColor.rgb, vec3(0.2, 0.55, 0.25)));
          float glint = pow(0.5 + 0.5 * sin(oceanUv.x * 150.0 + time * 2.2), 10.0);
          float glint2 = pow(0.5 + 0.5 * sin(oceanUv.x * 86.0 - oceanUv.y * 34.0 - time * 1.6), 14.0);
          sampledDiffuseColor.rgb += vec3(0.75, 0.84, 0.95) * waterBright * depth * motion * (glint * 0.22 + glint2 * 0.12);
          float du = abs(oceanUv.x - beamUv);
          du = min(du, 1.0 - du);
          float wedge = exp(-du * du / 0.00028);
          float horizonDist = abs(oceanUv.y - horizon);
          float sweep = exp(-horizonDist * horizonDist / 0.014);
          sampledDiffuseColor.rgb += vec3(1.0, 0.93, 0.82) * wedge * (0.07 + 0.34 * sweep);
          diffuseColor *= sampledDiffuseColor;
        `,
      );
  };
}

function ceilingMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPos;
      void main() {
        float radius = length(vPos) / 7.0;
        vec3 color = vec3(0.42, 0.41, 0.39);
        float bands = 0.0;
        bands += exp(-pow((radius - 0.32) / 0.07, 2.0));
        bands += exp(-pow((radius - 0.54) / 0.075, 2.0)) * 0.85;
        bands += exp(-pow((radius - 0.76) / 0.08, 2.0)) * 0.65;
        color = mix(color, vec3(1.15, 0.96, 0.72), clamp(bands, 0.0, 0.92));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function addLamp(brass) {
  const lamp = new THREE.Group();
  lamp.position.y = 3;

  const lampGlass = new THREE.MeshPhysicalMaterial({
    color: 0xf7fbff,
    metalness: 0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.14,
    envMapIntensity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ribGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8f2,
    metalness: 0,
    roughness: 0.12,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 40, 1, true), lampGlass);
  shade.renderOrder = 3;
  lamp.add(shade);

  for (let i = 0; i < 8; i += 1) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.014, 8, 40), ribGlass);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = -0.32 + i * 0.09;
    rib.renderOrder = 3;
    lamp.add(rib);
  }

  coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4dc,
    emissive: 0xffe7b0,
    emissiveIntensity: 5,
    roughness: 0.3,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), coreMaterial);
  core.layers.enable(BLOOM_LAYER);
  lamp.add(core);

  [-0.4, 0.4].forEach((offset) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.028, 12, 40), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = offset;
    lamp.add(ring);
  });

  const barGeo = new THREE.BoxGeometry(0.012, 0.8, 0.012);
  for (let i = 0; i < 6; i += 1) {
    const bar = new THREE.Mesh(barGeo, brass);
    const angle = (i / 6) * Math.PI * 2;
    bar.position.set(Math.sin(angle) * 0.35, 0, Math.cos(angle) * 0.35);
    lamp.add(bar);
  }

  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.58, 16), brass);
  mount.position.y = 0.4 + 0.29;
  lamp.add(mount);
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.04, 20), brass);
  rose.position.y = 0.4 + 0.58;
  lamp.add(rose);
  scene.add(lamp);

  const glow = new THREE.PointLight(0xfff0d2, 0.55, 2.4, 2);
  glow.position.copy(lamp.position);
  scene.add(glow);
  const ceilingWash = new THREE.PointLight(0xfff6ea, 0.45, 3.4, 2);
  ceilingWash.position.set(0, 3.78, 0);
  scene.add(ceilingWash);

  beam = new THREE.Group();
  beam.position.copy(lamp.position);
  beam.rotation.y = 1.15;
  const beamLength = 11.2;
  const radiusNear = 0.035;
  const radiusFar = radiusNear + Math.tan(THREE.MathUtils.degToRad(1.4)) * beamLength;
  addShaft(radiusNear, radiusFar, beamLength, false);
  addShaft(radiusNear * 0.35, radiusFar * 0.35, beamLength, true);
  scene.add(beam);
}

function addShaft(radiusNear, radiusFar, length, bloomOnly) {
  const shaft = new THREE.CylinderGeometry(radiusFar, radiusNear, length, 40, 1, true);
  shaft.rotateZ(-Math.PI / 2);
  shaft.translate(length / 2, 0, 0);
  const material = beamMaterial(length);
  beamFaces.push(material.uniforms.face);
  const mesh = new THREE.Mesh(shaft, material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  if (bloomOnly) mesh.layers.set(BLOOM_LAYER);
  beam.add(mesh);
}

function beamMaterial(length) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      glow: { value: new THREE.Color(0xffe6c4) },
      beamLength: { value: length },
      face: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 glow;
      uniform float beamLength;
      uniform float face;
      void main() {
        float along = vUv.y * beamLength;
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float edge = smoothstep(0.0, 0.55, facing);
        float indoor = smoothstep(0.2, 1.1, along) * (1.0 - smoothstep(5.6, 6.9, along));
        float outdoor = smoothstep(6.3, 7.6, along) * (1.0 - smoothstep(8.8, 11.15, along));
        float alpha = (indoor * 0.05 + outdoor * 0.48) * edge * (1.0 - face);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(glow, alpha);
      }
    `,
  });
}

function addMoonGlow(image, bandHeight) {
  const mark = image.moon;
  if (!mark) return;
  const u = mark.x / image.width;
  const v = 1 - mark.y / image.height;
  const theta = u * Math.PI * 2;
  const local = new THREE.Vector3(
    Math.sin(theta) * (VIEW_RADIUS - 0.3),
    (v - 0.5) * bandHeight,
    Math.cos(theta) * (VIEW_RADIUS - 0.3),
  );
  local.applyAxisAngle(new THREE.Vector3(0, 1, 0), panoMesh.rotation.y);
  const sprite = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({
      map: radialTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.setScalar(0.42);
  sprite.position.set(local.x, local.y + panoMesh.position.y, local.z);
  sprite.lookAt(0, sprite.position.y, 0);
  sprite.layers.set(BLOOM_LAYER);
  scene.add(sprite);
}

function addStars() {
  const count = 150;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const az = Math.random() * Math.PI * 2;
    const elev = 0.05 + Math.random() * 0.95;
    const radius = VIEW_RADIUS - 0.45;
    positions[i * 3] = Math.sin(az) * Math.cos(elev) * radius;
    positions[i * 3 + 1] = EYE + Math.sin(elev) * radius;
    positions[i * 3 + 2] = Math.cos(az) * Math.cos(elev) * radius;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  starTime = { value: 0 };
  stars = new THREE.Points(geometry, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: starTime, motion: panoMotion },
    vertexShader: `
      attribute float phase;
      uniform float time;
      uniform float motion;
      varying float vTwinkle;
      void main() {
        float tw = 0.78 + 0.22 * sin(time * 0.65 + phase);
        vTwinkle = mix(1.0, tw, motion);
        gl_PointSize = 1.7;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        if (length(gl_PointCoord - 0.5) > 0.5) discard;
        gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * vTwinkle, 0.9);
      }
    `,
  }));
  scene.add(stars);
}

function radialTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const glow = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  glow.addColorStop(0, "rgba(255,252,244,1)");
  glow.addColorStop(0.45, "rgba(255,246,230,0.7)");
  glow.addColorStop(1, "rgba(255,246,230,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function updateBeam(still) {
  if (!beam) return;
  if (!still) beam.rotation.y += clockDelta * (Math.PI * 2 / 25);
  beamDirection.set(1, 0, 0).applyQuaternion(beam.quaternion);
  const toCamera = new THREE.Vector3().subVectors(camera.position, beam.position);
  toCamera.y = 0;
  const flat = beamDirection.clone();
  flat.y = 0;
  const align = flat.normalize().dot(toCamera.normalize());
  const flash = THREE.MathUtils.smoothstep(align, 0.4, 0.82);
  beamFaces.forEach((slot) => {
    slot.value = flash;
  });
  if (coreMaterial) coreMaterial.emissiveIntensity = 4.5 + flash * 11;
  if (panoMesh && beamUv) {
    const local = beamDirection.clone().applyQuaternion(panoMesh.quaternion.clone().invert());
    let theta = Math.atan2(local.x, local.z);
    if (theta < 0) theta += Math.PI * 2;
    beamUv.value = theta / (Math.PI * 2);
  }
}

let clockDelta = 0;

function addGlassEdge(group, width, height, y, material) {
  const z = 0.012;
  [
    [width, 0.014, 0, y + height / 2],
    [width, 0.014, 0, y - height / 2],
    [0.014, height, -width / 2, y],
    [0.014, height, width / 2, y],
  ].forEach(([w, h, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), material);
    bar.position.set(x, barY, z);
    bar.renderOrder = 3;
    group.add(bar);
  });
}

function addFrame(group, width, height, y, brass) {
  const z = 0.04;
  const thick = 0.014;
  [
    [width + thick, thick, 0, y + height / 2],
    [width + thick, thick, 0, y - height / 2],
    [thick, height, -width / 2, y],
    [thick, height, width / 2, y],
  ].forEach(([w, h, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), brass);
    bar.position.set(x, barY, z);
    group.add(bar);
  });
}

function addFoot(group, brass) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.38, 12), brass);
  post.position.y = 0.19;
  group.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 16), brass);
  base.position.y = 0.016;
  group.add(base);
}

function bindLook() {
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    if (!lightbox.hidden) return;
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    noteInteraction();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) {
      showHover(event);
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = event.clientX;
    lastY = event.clientY;
    if (!glide.active && focusIndex === null) orbit -= dx * 0.0032;
    if (!glide.active) pitch = clamp(pitch - dy * 0.0022, PITCH_MIN, PITCH_MAX);
    applyCamera();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (dragging && moved < 7) openHit(event);
    dragging = false;
  });

  canvas.addEventListener("pointerleave", () => {
    hoverLabel.hidden = true;
  });
}

function showHover(event) {
  const hit = cast(event)[0];
  if (!hit) {
    hoverLabel.hidden = true;
    return;
  }
  hoverLabel.hidden = false;
  hoverLabel.textContent = WORKS[hit.object.userData.index].title;
}

function openHit(event) {
  const hit = cast(event)[0];
  if (!hit || glide.active) return;
  approachArt(hit.object.userData.index);
}

function cast(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(artMeshes, false);
}

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

function resize() {
  if (!renderer) return;
  const ratio = pixelRatio();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  bloomComposer.setPixelRatio(ratio);
  bloomComposer.setSize(window.innerWidth, window.innerHeight);
  finalComposer.setPixelRatio(ratio);
  finalComposer.setSize(window.innerWidth, window.innerHeight);
}

function pauseRoom() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  updateBack();
}

function resumeRoom() {
  if (running || !renderer) return;
  running = true;
  clock.getDelta();
  updateBack();
  raf = requestAnimationFrame(tick);
}

function tick() {
  if (!running || !lightbox.hidden) {
    running = false;
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(tick);
  clockDelta = Math.min(clock.getDelta(), 0.05);
  const still = reduceMotion.matches;
  updateGlide(clockDelta, still);
  if (panoMotion) panoMotion.value = still ? 0 : 1;
  if (!still && panoTime) panoTime.value += clockDelta;
  if (!still && starTime) starTime.value += clockDelta;
  if (!glide.active && focusIndex === null && !still && performance.now() > idleAt) autoOrbit = true;
  if (autoOrbit && !still && !glide.active && focusIndex === null) {
    orbit += clockDelta * 0.045;
    applyCamera();
  }
  updateBeam(still);
  renderFrame();
}

function paintSmallerMoon(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const skyLimit = Math.floor(image.height * 0.52);
  const pixels = context.getImageData(0, 0, image.width, skyLimit);
  const { data } = pixels;
  let best = 0;
  let centerX = Math.floor(image.width * 0.9);
  let centerY = Math.floor(skyLimit * 0.7);
  for (let y = 16; y < skyLimit - 16; y += 4) {
    for (let x = 16; x < image.width - 16; x += 4) {
      let sum = 0;
      let count = 0;
      for (let dy = -6; dy <= 6; dy += 6) {
        for (let dx = -6; dx <= 6; dx += 6) {
          const index = ((y + dy) * image.width + (x + dx)) * 4;
          sum += data[index] + data[index + 1] + data[index + 2];
          count += 1;
        }
      }
      const average = sum / count;
      if (average > best) {
        best = average;
        centerX = x;
        centerY = y;
      }
    }
  }

  const skyPatch = context.getImageData(48, 36, 24, 24).data;
  let skyRed = 0;
  let skyGreen = 0;
  let skyBlue = 0;
  const skyCount = skyPatch.length / 4;
  for (let i = 0; i < skyPatch.length; i += 4) {
    skyRed += skyPatch[i];
    skyGreen += skyPatch[i + 1];
    skyBlue += skyPatch[i + 2];
  }
  skyRed /= skyCount;
  skyGreen /= skyCount;
  skyBlue /= skyCount;

  let radius = 48;
  for (let ring = 24; ring < 160; ring += 3) {
    let sum = 0;
    let count = 0;
    for (let turn = 0; turn < 16; turn += 1) {
      const angle = (turn / 16) * Math.PI * 2;
      const x = Math.round(centerX + Math.cos(angle) * ring);
      const y = Math.round(centerY + Math.sin(angle) * ring);
      if (x < 0 || y < 0 || x >= image.width || y >= skyLimit) continue;
      const index = (y * image.width + x) * 4;
      sum += data[index] + data[index + 1] + data[index + 2];
      count += 1;
    }
    if (count && sum / count < skyRed + skyGreen + skyBlue + 70) {
      radius = ring;
      break;
    }
  }

  const paint = context.getImageData(0, 0, image.width, skyLimit);
  const paintData = paint.data;
  const reach = radius * 2.1;
  for (let y = Math.max(0, centerY - reach); y < Math.min(skyLimit, centerY + reach); y += 1) {
    for (let x = Math.max(0, centerX - reach); x < Math.min(image.width, centerX + reach); x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > reach) continue;
      const index = (y * image.width + x) * 4;
      const fade = distance / reach;
      paintData[index] = paintData[index] * fade + skyRed * (1 - fade);
      paintData[index + 1] = paintData[index + 1] * fade + skyGreen * (1 - fade);
      paintData[index + 2] = paintData[index + 2] * fade + skyBlue * (1 - fade);
    }
  }
  context.putImageData(paint, 0, 0);

  const small = Math.max(16, radius / 3);
  const drawY = image.height * 0.535;
  const glow = context.createRadialGradient(centerX, drawY, small * 0.15, centerX, drawY, small * 1.7);
  glow.addColorStop(0, "rgba(255, 252, 246, 1)");
  glow.addColorStop(0.42, "rgba(248, 246, 240, 0.95)");
  glow.addColorStop(0.72, "rgba(220, 226, 236, 0.22)");
  glow.addColorStop(1, "rgba(220, 226, 236, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(centerX, drawY, small * 1.7, 0, Math.PI * 2);
  context.fill();
  canvas.moon = { x: centerX, y: drawY, radius: small };
  return canvas;
}

function textureFromImage(image) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function edgeColor(image, top) {
  const sample = document.createElement("canvas");
  sample.width = 24;
  sample.height = 4;
  const context = sample.getContext("2d", { willReadFrequently: true });
  const sourceY = top ? 0 : Math.max(0, image.height - 4);
  context.drawImage(image, 0, sourceY, image.width, 4, 0, 0, 24, 4);
  const data = context.getImageData(0, 0, 24, 4).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    red += data[i];
    green += data[i + 1];
    blue += data[i + 2];
  }
  return new THREE.Color(red / count / 255, green / count / 255, blue / count / 255);
}

function moonFraction(image) {
  const width = 180;
  const height = 70;
  const sample = document.createElement("canvas");
  sample.width = width;
  sample.height = height;
  const context = sample.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, image.width, image.height * 0.55, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  let best = 0;
  let bestX = width * 0.8;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const luminance = data[index] * 0.3 + data[index + 1] * 0.59 + data[index + 2] * 0.11;
      if (luminance > best) {
        best = luminance;
        bestX = x;
      }
    }
  }
  return (bestX + 0.5) / width;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
