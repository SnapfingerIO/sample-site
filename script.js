const TOTAL = 9;

const STUDIES = [
  { name: "Moon", paint: paintMoon },
  { name: "Andromeda", paint: paintGalaxy },
  { name: "Saturn", paint: paintSaturn },
  { name: "Lyra", paint: paintConstellation },
  { name: "Eclipse", paint: paintEclipse },
  { name: "Comet", paint: paintComet },
  { name: "Nebula", paint: paintNebula },
  { name: "Zodiac", paint: paintChart },
  { name: "Gemini", paint: paintTwins },
];

const grid = document.querySelector("#grid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxTitle = document.querySelector("#lightbox-title");
const sky = document.querySelector("#sky");

const photos = STUDIES.map((study, index) => ({
  ...study,
  src: renderStudy(index),
}));

let current = 0;
let lastTrigger = null;

photos.forEach((photo, index) => {
  const item = document.createElement("li");
  const button = document.createElement("button");
  const image = document.createElement("img");

  image.src = photo.src;
  image.alt = `${photo.name}, study ${index + 1} of ${TOTAL}`;
  button.type = "button";
  button.append(image);
  button.addEventListener("click", () => openAt(index, button));
  item.append(button);
  grid.append(item);
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
  if (lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") step(-1);
  if (event.key === "ArrowRight") step(1);
});

paintSky();
window.addEventListener("resize", paintSky);

function openAt(index, trigger) {
  current = index;
  lastTrigger = trigger;
  showCurrent();
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  lightbox.querySelector(".close").focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  lastTrigger?.focus();
}

function step(direction) {
  current = (current + direction + TOTAL) % TOTAL;
  showCurrent();
}

function showCurrent() {
  const photo = photos[current];
  lightboxImage.src = photo.src;
  lightboxImage.alt = `${photo.name}, study ${current + 1} of ${TOTAL}`;
  lightboxTitle.textContent = `${current + 1} / ${TOTAL} · ${photo.name}`;
}

function renderStudy(index) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  STUDIES[index].paint(context, canvas.width, canvas.height, rng(index + 3));
  label(context, index, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function paintSky() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  sky.width = Math.floor(width * ratio);
  sky.height = Math.floor(height * ratio);
  const context = sky.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const skyGradient = context.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, "#10082a");
  skyGradient.addColorStop(0.45, "#120c32");
  skyGradient.addColorStop(1, "#070614");
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, width, height);

  glow(context, width * 0.86, height * 0.16, 280, "rgba(150, 110, 255, 0.28)");
  glow(context, width * 0.12, height * 0.82, 240, "rgba(255, 130, 180, 0.16)");
  glow(context, width * 0.72, height * 0.78, 200, "rgba(90, 140, 255, 0.16)");
  spiral(context, width * 0.88, height * 0.18, 150, rng(11), 0.55);
  spiral(context, width * 0.08, height * 0.9, 110, rng(29), 0.4);

  const random = rng(7);
  const count = Math.round((width * height) / 2200);
  stars(context, random, count, width, height);
  for (let i = 0; i < 14; i += 1) {
    sparkle(
      context,
      random() * width,
      random() * height,
      5 + random() * 7,
      random() > 0.5 ? "#fff6d8" : "#f6d0ff",
    );
  }

  const sideMargin = (width - 1120) / 2;
  if (sideMargin > 90) {
    crescent(context, 64, 72, 26, "#fff3d4");
  }
}

function paintMoon(context, width, height, random) {
  night(context, width, height, ["#1a1038", "#3a2468", "#120c28"]);
  glow(context, width * 0.62, height * 0.46, 340, "rgba(255, 214, 236, 0.35)");
  stars(context, random, 160, width, height);
  crescent(context, width * 0.62, height * 0.44, 210, "#fff6e4");
  sparkle(context, width * 0.22, height * 0.28, 16, "#fff");
  sparkle(context, width * 0.84, height * 0.7, 12, "#f8c8ff");
}

function paintGalaxy(context, width, height, random) {
  night(context, width, height, ["#140826", "#241048", "#0c1028"]);
  stars(context, random, 220, width, height);
  spiral(context, width * 0.52, height * 0.5, 340, random, 1);
  sparkle(context, width * 0.18, height * 0.22, 10, "#fff");
}

function paintSaturn(context, width, height, random) {
  night(context, width, height, ["#1a1230", "#3a2458", "#101428"]);
  stars(context, random, 140, width, height);
  glow(context, width * 0.5, height * 0.5, 300, "rgba(255, 196, 140, 0.28)");
  ringedPlanet(context, width * 0.5, height * 0.5, 150);
  sparkle(context, width * 0.18, height * 0.3, 11, "#fff6d8");
  sparkle(context, width * 0.8, height * 0.24, 8, "#f3c6ff");
}

function paintConstellation(context, width, height, random) {
  night(context, width, height, ["#10183a", "#1c2458", "#0c1024"]);
  stars(context, random, 180, width, height);
  const points = [
    [220, 220],
    [360, 340],
    [520, 260],
    [700, 380],
    [860, 240],
    [980, 420],
    [760, 560],
    [480, 620],
  ];
  context.strokeStyle = "rgba(255, 236, 196, 0.55)";
  context.lineWidth = 2;
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  points.forEach(([x, y], index) => {
    glow(context, x, y, 28, "rgba(255, 230, 180, 0.45)");
    context.fillStyle = index % 2 ? "#fff6e0" : "#f7d0ff";
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fill();
  });
}

function paintEclipse(context, width, height, random) {
  night(context, width, height, ["#160818", "#3a1840", "#100818"]);
  stars(context, random, 120, width, height);
  glow(context, width * 0.5, height * 0.48, 380, "rgba(255, 186, 120, 0.45)");
  glow(context, width * 0.5, height * 0.48, 220, "rgba(255, 244, 220, 0.85)");
  context.fillStyle = "#140816";
  context.beginPath();
  context.arc(width * 0.54, height * 0.46, 150, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255, 220, 170, 0.7)";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(width * 0.5, height * 0.48, 168, 0, Math.PI * 2);
  context.stroke();
}

function paintComet(context, width, height, random) {
  night(context, width, height, ["#0c1430", "#24306a", "#10122a"]);
  stars(context, random, 170, width, height);
  const gradient = context.createLinearGradient(180, 700, 980, 180);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(1, "rgba(255, 236, 196, 0.9)");
  context.strokeStyle = gradient;
  context.lineWidth = 18;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(160, 740);
  context.quadraticCurveTo(520, 520, 900, 240);
  context.stroke();
  glow(context, 910, 230, 90, "rgba(255, 250, 240, 0.95)");
  context.fillStyle = "#fff";
  context.beginPath();
  context.arc(910, 230, 16, 0, Math.PI * 2);
  context.fill();
}

function paintNebula(context, width, height, random) {
  night(context, width, height, ["#160824", "#2a1450", "#101430"]);
  glow(context, width * 0.4, height * 0.45, 360, "rgba(255, 140, 190, 0.45)");
  glow(context, width * 0.62, height * 0.55, 300, "rgba(120, 150, 255, 0.4)");
  glow(context, width * 0.5, height * 0.38, 180, "rgba(255, 230, 180, 0.35)");
  stars(context, random, 200, width, height);
  for (let i = 0; i < 8; i += 1) {
    sparkle(context, 180 + random() * 840, 140 + random() * 560, 6 + random() * 8, "#fff");
  }
}

function paintChart(context, width, height, random) {
  night(context, width, height, ["#12102c", "#2a2048", "#0e1024"]);
  stars(context, random, 90, width, height);
  const cx = width * 0.5;
  const cy = height * 0.5;
  glow(context, cx, cy, 300, "rgba(210, 170, 255, 0.18)");
  context.strokeStyle = "rgba(246, 225, 186, 0.75)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(cx, cy, 250, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(cx, cy, 190, 0, Math.PI * 2);
  context.stroke();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    context.save();
    context.translate(cx, cy);
    context.rotate(angle);
    context.beginPath();
    context.moveTo(210, 0);
    context.lineTo(250, 0);
    context.stroke();
    context.restore();
    const sx = cx + Math.cos(angle) * 150;
    const sy = cy + Math.sin(angle) * 150;
    sparkle(context, sx, sy, 7, i % 2 ? "#fff1cc" : "#f6c8ff");
  }
}

function paintTwins(context, width, height, random) {
  night(context, width, height, ["#1a1030", "#40245c", "#141028"]);
  stars(context, random, 150, width, height);
  glow(context, width * 0.38, height * 0.48, 180, "rgba(255, 220, 170, 0.35)");
  glow(context, width * 0.64, height * 0.48, 180, "rgba(190, 170, 255, 0.4)");
  orb(context, width * 0.38, height * 0.48, 110, "#ffe7bf", "#c9844a");
  orb(context, width * 0.64, height * 0.48, 96, "#f3e8ff", "#7a6ad4");
  context.strokeStyle = "rgba(255, 236, 210, 0.45)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width * 0.38, height * 0.48);
  context.lineTo(width * 0.64, height * 0.48);
  context.stroke();
}

function night(context, width, height, colors) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.55, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function stars(context, random, count, width, height) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = random() * 1.7 + 0.25;
    context.globalAlpha = 0.35 + random() * 0.65;
    const roll = random();
    context.fillStyle = roll > 0.86 ? "#ffe7b0" : roll > 0.72 ? "#f3c6ff" : "#f7f4ff";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function glow(context, x, y, radius, color) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function sparkle(context, x, y, radius, color) {
  context.save();
  context.translate(x, y);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, -radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.quadraticCurveTo(0, 0, 0, radius);
  context.quadraticCurveTo(0, 0, -radius, 0);
  context.quadraticCurveTo(0, 0, 0, -radius);
  context.fill();
  context.restore();
}

function crescent(context, x, y, radius, color) {
  const moon = document.createElement("canvas");
  const size = Math.ceil(radius * 3);
  moon.width = size;
  moon.height = size;
  const layer = moon.getContext("2d");
  const cx = radius * 1.2;
  const cy = radius * 1.45;
  layer.fillStyle = color;
  layer.beginPath();
  layer.arc(cx, cy, radius, 0, Math.PI * 2);
  layer.fill();
  layer.globalCompositeOperation = "destination-out";
  layer.beginPath();
  layer.arc(cx + radius * 0.42, cy - radius * 0.1, radius * 0.78, 0, Math.PI * 2);
  layer.fill();
  context.drawImage(moon, x - cx, y - cy);
}

function spiral(context, cx, cy, reach, random, alpha) {
  glow(context, cx, cy, reach * 0.85, `rgba(255, 210, 240, ${0.35 * alpha})`);
  glow(context, cx, cy, reach * 0.28, `rgba(255, 255, 255, ${0.8 * alpha})`);
  for (let arm = 0; arm < 2; arm += 1) {
    for (let i = 0; i < 520; i += 1) {
      const t = i / 520;
      const angle = t * Math.PI * 4.6 + arm * Math.PI;
      const radius = t * reach;
      const jitter = (random() - 0.5) * (10 + t * reach * 0.16);
      const x = cx + Math.cos(angle) * radius + Math.cos(angle + 1.2) * jitter;
      const y = cy + Math.sin(angle) * radius * 0.62 + Math.sin(angle) * jitter * 0.35;
      context.globalAlpha = (1 - t) * 0.75 * alpha;
      context.fillStyle = t < 0.18 ? "#fffaf2" : t < 0.55 ? "#f7c6ff" : "#a9c0ff";
      context.beginPath();
      context.arc(x, y, (1 - t) * 2.4 + 0.6, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function orb(context, x, y, radius, light, shadow) {
  const gradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.35, light);
  gradient.addColorStop(1, shadow);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function ringedPlanet(context, x, y, radius) {
  context.save();
  context.translate(x, y);
  context.rotate(-0.5);
  context.strokeStyle = "rgba(255, 224, 180, 0.85)";
  context.lineWidth = 12;
  context.beginPath();
  context.ellipse(0, 0, radius * 1.85, radius * 0.46, 0, 0.15, Math.PI - 0.15);
  context.stroke();
  context.restore();

  orb(context, x, y, radius, "#ffd7a8", "#8a4e32");

  context.save();
  context.translate(x, y);
  context.rotate(-0.5);
  context.strokeStyle = "rgba(255, 236, 206, 0.95)";
  context.lineWidth = 14;
  context.beginPath();
  context.ellipse(0, 0, radius * 1.85, radius * 0.46, 0, Math.PI + 0.15, Math.PI * 2 - 0.15);
  context.stroke();
  context.restore();
}

function label(context, index, width, height) {
  context.fillStyle = "rgba(255, 246, 230, 0.88)";
  context.font = "500 42px Palatino, Georgia, serif";
  context.fillText(String(index + 1).padStart(2, "0"), 72, height - 78);
}

function rng(seed) {
  let state = (seed + 1) * 9973;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
