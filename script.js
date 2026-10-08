const TOTAL = 9;

const STUDIES = [
  { name: "Harbor", colors: ["#1d4e4a", "#7fbfb4"], accent: "#f3e6cf" },
  { name: "Kiln", colors: ["#8c3d2f", "#e0a07a"], accent: "#f7efe4" },
  { name: "Dune", colors: ["#c4a574", "#efe2c6"], accent: "#5c4632" },
  { name: "Ink", colors: ["#243044", "#6d7c93"], accent: "#e7dcc8" },
  { name: "Grove", colors: ["#2f4a32", "#8eae78"], accent: "#f4f0e4" },
  { name: "Copper", colors: ["#8a4b2f", "#d7a15e"], accent: "#f8f1e3" },
  { name: "Tide", colors: ["#1e4d6b", "#7eb6c9"], accent: "#f3efe6" },
  { name: "Plum", colors: ["#5a3148", "#c4899a"], accent: "#f6efe8" },
  { name: "Slate", colors: ["#3d4248", "#a7a29a"], accent: "#f4efe6" },
];

const grid = document.querySelector("#grid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxTitle = document.querySelector("#lightbox-title");
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
  const study = STUDIES[index];

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, study.colors[0]);
  gradient.addColorStop(1, study.colors[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = study.accent;
  drawMotif(context, index, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 253, 249, 0.88)";
  context.font = "500 42px Palatino, Georgia, serif";
  context.fillText(String(index + 1).padStart(2, "0"), 72, 820);

  return canvas.toDataURL("image/jpeg", 0.86);
}

function drawMotif(context, index, width, height) {
  const motif = index % 9;

  if (motif === 0) {
    context.beginPath();
    context.arc(width * 0.68, height * 0.42, 220, 0, Math.PI * 2);
    context.fill();
  } else if (motif === 1) {
    context.fillRect(0, height * 0.32, width, 70);
    context.globalAlpha = 0.55;
    context.fillRect(0, height * 0.52, width, 28);
    context.globalAlpha = 1;
  } else if (motif === 2) {
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(width, height * 0.2);
    context.lineTo(width, height);
    context.closePath();
    context.fill();
  } else if (motif === 3) {
    context.lineWidth = 28;
    context.strokeStyle = context.fillStyle;
    context.beginPath();
    context.arc(width * 0.5, height * 0.55, 180, Math.PI, 0);
    context.stroke();
    context.beginPath();
    context.arc(width * 0.5, height * 0.55, 110, Math.PI, 0);
    context.stroke();
  } else if (motif === 4) {
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        context.beginPath();
        context.arc(180 + column * 140, 180 + row * 120, 16, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (motif === 5) {
    context.fillRect(width * 0.62, 0, 90, height);
  } else if (motif === 6) {
    context.beginPath();
    context.moveTo(width * 0.22, height * 0.75);
    context.lineTo(width * 0.5, height * 0.22);
    context.lineTo(width * 0.78, height * 0.75);
    context.closePath();
    context.fill();
  } else if (motif === 7) {
    context.globalAlpha = 0.9;
    context.fillRect(160, 180, 420, 280);
    context.globalAlpha = 0.55;
    context.fillRect(460, 340, 460, 300);
    context.globalAlpha = 1;
  } else {
    context.lineWidth = 36;
    context.strokeStyle = context.fillStyle;
    context.beginPath();
    context.arc(width * 0.5, height * 0.46, 190, 0, Math.PI * 2);
    context.stroke();
  }
}
