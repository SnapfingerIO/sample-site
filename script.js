import * as THREE from "three";
import { RoomEnvironment } from "./vendor/three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "./vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/three/addons/postprocessing/RenderPass.js";
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
const EYE = 1.6;
const PITCH_LIMIT = Math.PI / 3.2;
const HORIZON = 0.57;
const PANO_ASPECT = 1280 / 2720;

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
  const turn = 0.08;
  if (event.key === "ArrowLeft") changeLook(turn, 0);
  if (event.key === "ArrowRight") changeLook(-turn, 0);
  if (event.key === "ArrowUp") changeLook(0, turn);
  if (event.key === "ArrowDown") changeLook(0, -turn);
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

const look = { yaw: 0, pitch: 0 };
const lookTarget = new THREE.Vector3();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let renderer;
let scene;
let camera;
let composer;
let bloomPass;
let beam;
let panoTime;
let panoMotion;
let artMeshes = [];
let raf = 0;
let running = false;
let autoTurn = false;
let idleAt = performance.now() + 4500;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

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

async function buildRoom() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  scene.environmentIntensity = 0.28;
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.08, 90);
  camera.position.set(0, EYE, 0);

  const roomRadius = 7;
  const roomHeight = 6.5;
  const viewRadius = 12;
  const bandHeight = Math.PI * 2 * viewRadius * PANO_ASPECT;

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, 0.04).texture;
  pmrem.dispose();
  environment.dispose();

  scene.add(new THREE.AmbientLight(0xf4efe6, 0.035));
  scene.add(new THREE.HemisphereLight(0x9eb4d4, 0xc4a882, 0.05));

  const brass = new THREE.MeshStandardMaterial({
    color: 0xe0b45a,
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1.35,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xf7f5f1,
    roughness: 0.38,
    metalness: 0,
  });
  const matte = new THREE.MeshStandardMaterial({
    color: 0xf6f3ec,
    roughness: 0.86,
    metalness: 0,
  });

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(roomRadius, 80),
    new THREE.MeshPhysicalMaterial({
      color: 0xe7dfd2,
      roughness: 0.045,
      metalness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.7,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);

  const inlay = new THREE.Mesh(
    new THREE.TorusGeometry(3.35, 0.012, 12, 140),
    new THREE.MeshStandardMaterial({
      color: 0xf0c56a,
      metalness: 1,
      roughness: 0.12,
      emissive: 0x8a6230,
      emissiveIntensity: 0.35,
      envMapIntensity: 1.4,
    }),
  );
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = 0.02;
  scene.add(inlay);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(roomRadius, 80),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = roomHeight;
  scene.add(ceiling);

  const cove = new THREE.Mesh(
    new THREE.TorusGeometry(roomRadius - 0.55, 0.07, 16, 96),
    new THREE.MeshStandardMaterial({
      color: 0xfff6e8,
      emissive: 0xfff3df,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }),
  );
  cove.rotation.x = Math.PI / 2;
  cove.position.y = roomHeight - 0.16;
  scene.add(cove);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.72,
    specularIntensity: 0.04,
    transparent: true,
    opacity: 0.015,
    envMapIntensity: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(roomRadius, roomRadius, roomHeight, 80, 1, true),
    glass,
  );
  wall.position.y = roomHeight / 2;
  wall.renderOrder = 2;
  scene.add(wall);

  const mullionGeo = new THREE.BoxGeometry(0.028, roomHeight, 0.03);
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const mullion = new THREE.Mesh(mullionGeo, white);
    mullion.position.set(
      Math.sin(angle) * (roomRadius - 0.02),
      roomHeight / 2,
      Math.cos(angle) * (roomRadius - 0.02),
    );
    mullion.lookAt(0, roomHeight / 2, 0);
    scene.add(mullion);
  }

  const rail = new THREE.Mesh(new THREE.TorusGeometry(roomRadius - 0.02, 0.012, 8, 100), white);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = roomHeight * 0.62;
  scene.add(rail);

  addLamp(roomHeight, brass);

  const panoImage = paintSmallerMoon(await loadImage("images/pano-night.jpg"));
  const panoMaterial = new THREE.MeshBasicMaterial({
    map: textureFromImage(panoImage),
    side: THREE.BackSide,
  });
  dressPanorama(panoMaterial);
  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(viewRadius, viewRadius, bandHeight, 96, 1, true),
    panoMaterial,
  );
  pano.position.y = EYE - bandHeight * (0.5 - HORIZON);
  pano.rotation.y = Math.PI - moonFraction(panoImage) * Math.PI * 2 + 0.42;
  scene.add(pano);

  const sky = new THREE.Mesh(
    new THREE.CylinderGeometry(viewRadius, viewRadius, 18, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: edgeColor(panoImage, true), side: THREE.BackSide }),
  );
  sky.position.y = pano.position.y + bandHeight / 2 + 9;
  scene.add(sky);

  const sea = new THREE.Mesh(
    new THREE.CylinderGeometry(viewRadius, viewRadius, 18, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: edgeColor(panoImage, false), side: THREE.BackSide }),
  );
  sea.position.y = pano.position.y - bandHeight / 2 - 9;
  scene.add(sea);

  const panelGlass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.04,
    ior: 1.5,
    specularIntensity: 0.2,
    transparent: true,
    opacity: 1,
    envMapIntensity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const edgeGlow = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const loader = new THREE.TextureLoader();
  const artRadius = 4.45;

  await Promise.all(WORKS.map((work, index) => new Promise((resolve, reject) => {
    loader.load(
      `images/full/${work.file}.jpg`,
      (artTexture) => {
        artTexture.colorSpace = THREE.SRGBColorSpace;
        artTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const image = artTexture.image;
        const fitted = fit(image.width, image.height, 1.43, 1.79);
        const angle = Math.PI / 9 + index * ((Math.PI * 2) / TOTAL);
        const group = new THREE.Group();
        group.position.set(Math.sin(angle) * artRadius, 0, -Math.cos(angle) * artRadius);
        group.rotation.y = -angle;

        const sheetWidth = fitted[0] + 0.62;
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(sheetWidth, 2.9), panelGlass);
        sheet.position.y = 1.55;
        sheet.renderOrder = 2;
        group.add(sheet);
        addGlassEdge(group, sheetWidth, 2.9, 1.55, edgeGlow);

        const matBoard = new THREE.Mesh(
          new THREE.PlaneGeometry(fitted[0] + 0.34, fitted[1] + 0.4),
          matte,
        );
        matBoard.position.set(0, 1.58, 0.03);
        group.add(matBoard);

        const painting = new THREE.Mesh(
          new THREE.PlaneGeometry(fitted[0], fitted[1]),
          new THREE.MeshBasicMaterial({ map: artTexture, depthWrite: true }),
        );
        painting.position.set(0, 1.58, 0.06);
        painting.renderOrder = 1;
        painting.userData.index = index;
        group.add(painting);
        artMeshes.push(painting);

        addFrame(group, fitted[0] + 0.34, fitted[1] + 0.4, 1.58, brass);
        addFoot(group, brass);

        const wash = new THREE.PointLight(0xffd7a4, 1.5, 3.2, 2);
        wash.position.set(0, 1.58, 0.7);
        group.add(wash);
        scene.add(group);
        resolve();
      },
      undefined,
      reject,
    );
  })));

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.38,
    0.22,
    2.7,
  );
  const bloomSetSize = bloomPass.setSize.bind(bloomPass);
  bloomPass.setSize = (width, height) => {
    const scale = Math.min(window.innerWidth, window.innerHeight) < 800 ? 0.5 : 1;
    bloomSetSize(width * scale, height * scale);
  };
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  resize();

  applyLook();
  document.body.classList.add("is-3d");
  bindLook();
  window.addEventListener("resize", resize);
  resumeRoom();
}

function dressPanorama(material) {
  panoTime = { value: 0 };
  panoMotion = { value: reduceMotion.matches ? 0 : 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.time = panoTime;
    shader.uniforms.motion = panoMotion;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float time;\nuniform float motion;\nvoid main() {",
      )
      .replace(
        "#include <map_fragment>",
        `
          vec2 oceanUv = vMapUv;
          float horizon = 0.43;
          float depth = smoothstep(horizon, horizon - 0.32, oceanUv.y);
          float skyMask = smoothstep(horizon + 0.02, horizon + 0.12, oceanUv.y);
          vec2 w1 = vec2(
            sin(oceanUv.x * 16.0 + time * 1.35),
            cos(oceanUv.y * 12.0 - time * 0.85)
          );
          vec2 w2 = vec2(
            sin(oceanUv.x * 8.0 - oceanUv.y * 6.0 + time * 0.8),
            sin(oceanUv.y * 10.0 + time * 1.15)
          );
          vec2 w3 = vec2(
            cos(oceanUv.x * 22.0 + oceanUv.y * 4.0 - time * 1.9),
            sin(oceanUv.x * 5.0 + time * 1.55)
          );
          vec2 w4 = vec2(
            sin(oceanUv.y * 15.0 - time * 1.05),
            cos(oceanUv.x * 11.0 + time * 0.72)
          );
          vec2 shift = w1 * 0.36 + w2 * 0.28 + w3 * 0.2 + w4 * 0.16;
          oceanUv += shift * (0.006 + 0.004 * depth) * depth * motion;
          vec4 sampledDiffuseColor = texture2D(map, oceanUv);
          float waterBright = smoothstep(0.22, 0.62, dot(sampledDiffuseColor.rgb, vec3(0.2, 0.55, 0.25)));
          float glint = pow(0.5 + 0.5 * sin(oceanUv.x * 150.0 + time * 2.2), 10.0);
          float glint2 = pow(0.5 + 0.5 * sin(oceanUv.x * 86.0 - oceanUv.y * 34.0 - time * 1.6), 14.0);
          sampledDiffuseColor.rgb += vec3(0.75, 0.84, 0.95) * waterBright * depth * motion * (glint * 0.28 + glint2 * 0.16);
          float spark = fract(sin(dot(floor(oceanUv * vec2(900.0, 420.0)), vec2(12.9898, 78.233))) * 43758.5453);
          float twinkle = 0.94 + 0.06 * sin(time * 1.1 + spark * 6.28318);
          float star = smoothstep(0.62, 0.92, max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b)));
          sampledDiffuseColor.rgb *= mix(1.0, twinkle, star * skyMask * motion);
          float hot = smoothstep(0.82, 0.98, max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b)));
          sampledDiffuseColor.rgb *= mix(1.0, 3.6, hot * skyMask);
          diffuseColor *= sampledDiffuseColor;
        `,
      );
  };
}

function addLamp(roomHeight, brass) {
  const lamp = new THREE.Group();
  lamp.position.y = 4.15;

  const lampGlass = new THREE.MeshPhysicalMaterial({
    color: 0xf4f7fb,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.1,
    envMapIntensity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ribGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe7eef6,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const glassShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.7, 40, 1, true),
    lampGlass,
  );
  glassShade.renderOrder = 3;
  lamp.add(glassShade);

  for (let i = 0; i < 9; i += 1) {
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.016, 8, 36), ribGlass);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = -0.3 + i * 0.075;
    ridge.renderOrder = 3;
    lamp.add(ridge);
  }

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfff6e4,
      emissive: 0xfff1c9,
      emissiveIntensity: 9,
      roughness: 0.25,
    }),
  );
  lamp.add(core);

  [0.36, -0.36].forEach((offset) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.032, 12, 32), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = offset;
    lamp.add(ring);
  });

  const barGeo = new THREE.BoxGeometry(0.016, 0.7, 0.016);
  for (let i = 0; i < 10; i += 1) {
    const bar = new THREE.Mesh(barGeo, brass);
    const angle = (i / 10) * Math.PI * 2;
    bar.position.set(Math.sin(angle) * 0.36, 0, Math.cos(angle) * 0.36);
    lamp.add(bar);
  }

  const stemLength = roomHeight - lamp.position.y - 0.42;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, stemLength, 12), brass);
  stem.position.y = 0.36 + stemLength / 2;
  lamp.add(stem);
  scene.add(lamp);

  const light = new THREE.PointLight(0xfff0d4, 1.6, 9, 2);
  light.position.copy(lamp.position);
  scene.add(light);

  const pool = new THREE.SpotLight(0xffe4bc, 9, 14, Math.PI / 2.8, 0.92, 1.5);
  pool.position.copy(lamp.position);
  pool.target.position.set(0, 0, 0);
  scene.add(pool, pool.target);

  beam = new THREE.Group();
  beam.position.copy(lamp.position);
  beam.rotation.y = 1.52;
  const beamLength = 55;
  const meshSpread = THREE.MathUtils.degToRad(5);
  const radiusNear = 0.08;
  const radiusFar = radiusNear + Math.tan(meshSpread / 2) * beamLength;
  addShaft(radiusNear, radiusFar, beamLength);
  scene.add(beam);
}

function addShaft(radiusNear, radiusFar, length) {
  const shaft = new THREE.CylinderGeometry(radiusFar, radiusNear, length, 48, 1, true);
  shaft.rotateZ(-Math.PI / 2);
  shaft.translate(length / 2, 0, 0);
  const shaftMesh = new THREE.Mesh(shaft, beamMaterial(length));
  shaftMesh.renderOrder = 4;
  shaftMesh.frustumCulled = false;
  beam.add(shaftMesh);
}

function beamMaterial(length) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      glow: { value: new THREE.Color(0xffe3b8) },
      beamLength: { value: length },
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
      void main() {
        float along = vUv.y * beamLength;
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float edge = mix(0.55, 1.0, smoothstep(0.0, 0.45, facing));
        float atLens = (1.0 - smoothstep(0.0, 1.0, along)) * 0.12;
        float outdoor = smoothstep(6.5, 8.5, along) * (1.0 - smoothstep(16.0, 46.0, along));
        float alpha = max(atLens, outdoor) * edge * 0.28;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(glow, alpha);
      }
    `,
  });
}

function addGlassEdge(group, width, height, y, material) {
  const z = 0.012;
  const bars = [
    [width, 0.012, 0, y + height / 2],
    [width, 0.012, 0, y - height / 2],
    [0.012, height, -width / 2, y],
    [0.012, height, width / 2, y],
  ];
  bars.forEach(([w, h, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.008), material);
    bar.position.set(x, barY, z);
    bar.renderOrder = 3;
    group.add(bar);
  });
}

function addFrame(group, width, height, y, brass) {
  const z = 0.045;
  const thick = 0.018;
  const bars = [
    [width + thick, thick, 0, y + height / 2],
    [width + thick, thick, 0, y - height / 2],
    [thick, height, -width / 2, y],
    [thick, height, width / 2, y],
  ];
  bars.forEach(([w, h, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), brass);
    bar.position.set(x, barY, z);
    group.add(bar);
  });
}

function addFoot(group, brass) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 12), brass);
  post.position.y = 0.21;
  group.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.035, 16), brass);
  base.position.y = 0.02;
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
    look.yaw -= dx * 0.0032;
    look.pitch = clamp(look.pitch - dy * 0.0024, -PITCH_LIMIT, PITCH_LIMIT);
    applyLook();
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
  if (!hit) return;
  openAt(hit.object.userData.index);
}

function cast(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(artMeshes, false);
}

function changeLook(yaw, pitch) {
  look.yaw += yaw;
  look.pitch = clamp(look.pitch + pitch, -PITCH_LIMIT, PITCH_LIMIT);
  applyLook();
  noteInteraction();
}

function applyLook() {
  const cosPitch = Math.cos(look.pitch);
  lookTarget.set(
    camera.position.x + Math.sin(look.yaw) * cosPitch,
    camera.position.y + Math.sin(look.pitch),
    camera.position.z - Math.cos(look.yaw) * cosPitch,
  );
  camera.lookAt(lookTarget);
}

function noteInteraction() {
  autoTurn = false;
  idleAt = performance.now() + 4000;
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
  if (!composer) return;
  composer.setPixelRatio(ratio);
  composer.setSize(window.innerWidth, window.innerHeight);
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

function tick() {
  if (!running || !lightbox.hidden) {
    running = false;
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(tick);
  const delta = Math.min(clock.getDelta(), 0.05);
  const still = reduceMotion.matches;
  if (panoMotion) panoMotion.value = still ? 0 : 1;
  if (!still && panoTime) panoTime.value += delta;
  if (!still && beam) beam.rotation.y += delta * 0.08;
  if (!still && performance.now() > idleAt) autoTurn = true;
  if (autoTurn && !still) {
    look.yaw -= delta * 0.045;
    applyLook();
  }
  composer.render();
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
  const reach = radius * 1.15;
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

  const small = Math.max(18, radius / 3);
  const glow = context.createRadialGradient(centerX, centerY, small * 0.2, centerX, centerY, small * 2.4);
  glow.addColorStop(0, "rgba(255, 252, 245, 1)");
  glow.addColorStop(0.35, "rgba(244, 246, 252, 0.95)");
  glow.addColorStop(0.7, "rgba(210, 220, 235, 0.28)");
  glow.addColorStop(1, "rgba(210, 220, 235, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(centerX, centerY, small * 2.4, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

function textureFromImage(image) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
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
