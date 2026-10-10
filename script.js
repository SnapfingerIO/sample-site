import * as THREE from "three";

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

const look = {
  yaw: 0,
  pitch: window.innerHeight > window.innerWidth ? 0.08 : 0.26,
};
const lookTarget = new THREE.Vector3();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let renderer;
let scene;
let camera;
let beam;
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
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.08, 90);
  camera.position.set(0, EYE, 1.7);

  const roomRadius = 7;
  const roomHeight = 4.25;
  const viewRadius = 12;
  const bandHeight = Math.PI * 2 * viewRadius * PANO_ASPECT;

  scene.add(new THREE.AmbientLight(0xf7f2ea, 0.38));
  scene.add(new THREE.HemisphereLight(0xe7eef6, 0xd9c7a2, 0.28));
  addEnvironment();

  const brass = new THREE.MeshStandardMaterial({
    color: 0xc6a15e,
    emissive: 0x5c4318,
    emissiveIntensity: 0.45,
    metalness: 0.62,
    roughness: 0.32,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xf7f4ef,
    roughness: 0.42,
    metalness: 0.02,
  });

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(roomRadius, 72),
    new THREE.MeshStandardMaterial({
      color: 0xf4f0e8,
      roughness: 0.08,
      metalness: 0.28,
      envMapIntensity: 1.15,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);

  const inlay = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.018, 12, 120), brass);
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = 0.028;
  scene.add(inlay);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(roomRadius, 72),
    new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.62 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = roomHeight;
  scene.add(ceiling);

  const cove = new THREE.Mesh(
    new THREE.TorusGeometry(roomRadius - 0.42, 0.055, 12, 80),
    new THREE.MeshStandardMaterial({
      color: 0xfff4e2,
      emissive: 0xffe0b0,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    }),
  );
  cove.rotation.x = Math.PI / 2;
  cove.position.y = roomHeight - 0.12;
  scene.add(cove);

  const glass = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(roomRadius, roomRadius, roomHeight, 72, 1, true),
    glass,
  );
  wall.position.y = roomHeight / 2;
  wall.renderOrder = 2;
  scene.add(wall);

  const mullionGeo = new THREE.BoxGeometry(0.045, roomHeight, 0.05);
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const mullion = new THREE.Mesh(mullionGeo, white);
    mullion.position.set(
      Math.sin(angle) * (roomRadius - 0.02),
      roomHeight / 2,
      Math.cos(angle) * (roomRadius - 0.02),
    );
    mullion.lookAt(0, roomHeight / 2, 0);
    scene.add(mullion);
  }

  const rail = new THREE.Mesh(new THREE.TorusGeometry(roomRadius - 0.03, 0.018, 8, 90), white);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = roomHeight * 0.58;
  scene.add(rail);

  addLamp(roomHeight, brass);

  const panoImage = await loadImage("images/pano-night.jpg");
  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(viewRadius, viewRadius, bandHeight, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: textureFromImage(panoImage), side: THREE.BackSide }),
  );
  pano.position.y = EYE - bandHeight * (0.5 - HORIZON);
  pano.rotation.y = Math.PI - moonFraction(panoImage) * Math.PI * 2;
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

  const panelGlass = glass.clone();
  panelGlass.opacity = 0.16;
  panelGlass.color = new THREE.Color(0xe4eef6);
  const loader = new THREE.TextureLoader();
  const artRadius = 5.55;

  await Promise.all(WORKS.map((work, index) => new Promise((resolve, reject) => {
    loader.load(
      `images/full/${work.file}.jpg`,
      (artTexture) => {
        artTexture.colorSpace = THREE.SRGBColorSpace;
        artTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const image = artTexture.image;
        const fitted = fit(image.width, image.height, 1.02, 1.28);
        const angle = Math.PI / 9 + index * ((Math.PI * 2) / TOTAL);
        const group = new THREE.Group();
        group.position.set(Math.sin(angle) * artRadius, 0, -Math.cos(angle) * artRadius);
        group.rotation.y = -angle;

        const sheet = new THREE.Mesh(
          new THREE.PlaneGeometry(fitted[0] + 0.36, 2.55),
          panelGlass,
        );
        sheet.position.y = 1.42;
        sheet.renderOrder = 2;
        group.add(sheet);

        const painting = new THREE.Mesh(
          new THREE.PlaneGeometry(fitted[0], fitted[1]),
          new THREE.MeshBasicMaterial({ map: artTexture, depthWrite: true }),
        );
        painting.position.set(0, 1.48, 0.04);
        painting.renderOrder = 0;
        painting.userData.index = index;
        group.add(painting);
        artMeshes.push(painting);

        addFrame(group, fitted[0], fitted[1], brass);
        addFoot(group, brass);
        scene.add(group);
        resolve();
      },
      undefined,
      reject,
    );
  })));

  captureFloor(floor);

  applyLook();
  document.body.classList.add("is-3d");
  bindLook();
  window.addEventListener("resize", resize);
  resumeRoom();
}

function captureFloor(floor) {
  const target = new THREE.WebGLCubeRenderTarget(128);
  const probe = new THREE.PerspectiveCamera(90, 1, 0.15, 40);
  const faces = [
    [[1, 0, 0], [0, -1, 0]],
    [[-1, 0, 0], [0, -1, 0]],
    [[0, 1, 0], [0, 0, 1]],
    [[0, -1, 0], [0, 0, -1]],
    [[0, 0, 1], [0, -1, 0]],
    [[0, 0, -1], [0, -1, 0]],
  ];
  probe.position.set(0, 0.5, 0.3);
  floor.visible = false;
  beam.visible = false;
  const previous = renderer.getRenderTarget();
  faces.forEach(([dir, up], face) => {
    probe.up.set(up[0], up[1], up[2]);
    probe.lookAt(probe.position.x + dir[0], probe.position.y + dir[1], probe.position.z + dir[2]);
    renderer.setRenderTarget(target, face);
    renderer.render(scene, probe);
  });
  renderer.setRenderTarget(previous);
  floor.visible = true;
  beam.visible = true;
  floor.material.envMap = target.texture;
  floor.material.needsUpdate = true;
}

function addEnvironment() {
  const sample = document.createElement("canvas");
  sample.width = 32;
  sample.height = 128;
  const context = sample.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "#f7f1e6");
  gradient.addColorStop(0.18, "#fff6e8");
  gradient.addColorStop(0.42, "#243656");
  gradient.addColorStop(0.72, "#0e1a30");
  gradient.addColorStop(1, "#f3eee4");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 128);
  const texture = new THREE.CanvasTexture(sample);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(texture).texture;
  texture.dispose();
  pmrem.dispose();
}

function addLamp(roomHeight, brass) {
  const lamp = new THREE.Group();
  lamp.position.y = roomHeight - 1.02;

  const glassShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.46, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff6e4,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glassShade.renderOrder = 2;
  lamp.add(glassShade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  );
  lamp.add(bulb);

  [0.25, -0.25].forEach((offset) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 10, 28), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = offset;
    lamp.add(ring);
  });

  const barGeo = new THREE.BoxGeometry(0.018, 0.46, 0.018);
  for (let i = 0; i < 8; i += 1) {
    const bar = new THREE.Mesh(barGeo, brass);
    const angle = (i / 8) * Math.PI * 2;
    bar.position.set(Math.sin(angle) * 0.28, 0, Math.cos(angle) * 0.28);
    lamp.add(bar);
  }

  const stemLength = roomHeight - lamp.position.y - 0.22;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, stemLength, 12), brass);
  stem.position.y = 0.25 + stemLength / 2;
  lamp.add(stem);
  scene.add(lamp);

  const light = new THREE.PointLight(0xffe6c0, 6, 10, 2);
  light.position.copy(lamp.position);
  scene.add(light);

  const pool = new THREE.SpotLight(0xffe7c2, 16, 12, Math.PI / 3.2, 0.75, 1.4);
  pool.position.copy(lamp.position);
  pool.target.position.set(0, 0, 0);
  scene.add(pool, pool.target);

  beam = new THREE.Group();
  beam.position.copy(lamp.position);
  beam.rotation.y = 0.22;
  addShaft(0.02, 0.36, 8.8, 0.5);
  addShaft(0.05, 0.9, 8.4, 0.2);
  scene.add(beam);
}

function addShaft(radiusNear, radiusFar, length, opacity) {
  const shaft = new THREE.CylinderGeometry(radiusNear, radiusFar, length, 28, 1, true);
  shaft.rotateZ(Math.PI / 2);
  shaft.translate(length / 2, 0, 0);
  const shaftMesh = new THREE.Mesh(shaft, beamMaterial(opacity));
  shaftMesh.renderOrder = 4;
  beam.add(shaftMesh);
}

function beamMaterial(opacity) {
  const glow = document.createElement("canvas");
  glow.width = 64;
  glow.height = 256;
  const context = glow.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255, 248, 226, 0.95)");
  gradient.addColorStop(0.3, "rgba(255, 236, 196, 0.22)");
  gradient.addColorStop(1, "rgba(255, 228, 180, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 256);
  const map = new THREE.CanvasTexture(glow);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map,
    color: 0xffe7c2,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function addFrame(group, width, height, brass) {
  const y = 1.48;
  const z = 0.05;
  const thick = 0.025;
  const bars = [
    [width + thick, thick, 0.02, 0, y + height / 2],
    [width + thick, thick, 0.02, 0, y - height / 2],
    [thick, height, 0.02, -width / 2, y],
    [thick, height, 0.02, width / 2, y],
  ];
  bars.forEach(([w, h, d, x, barY]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brass);
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

function resize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
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
  if (!reduceMotion.matches && beam) beam.rotation.y += delta * 0.18;
  if (!reduceMotion.matches && performance.now() > idleAt) autoTurn = true;
  if (autoTurn && !reduceMotion.matches) {
    look.yaw -= delta * 0.045;
    applyLook();
  }
  renderer.render(scene, camera);
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
