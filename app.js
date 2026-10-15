const $ = (id) => document.getElementById(id);
const panel = $("panel");
const panelHide = $("panel-hide");
const panelShow = $("panel-show");
const panelContent = $("panel-content");
const axesShow = $("axes-show");
const orientationIndicator = $("orientation-indicator");
const viewerElement = $("viewer");
const searchForm = $("search-form");
const searchInput = $("pdb-id");
const searchButton = $("search-button");
const statusMessage = $("status");
const viewerControls = $("viewer-controls");

const viewer = $3Dmol.createViewer(viewerElement, { backgroundColor: "#000000" });
const state = { color: "chain", style: "cartoon", ligands: true, surface: false, spin: false };
const palette = [
  "#ff0033", "#00ff55", "#0066ff", "#ffb000", "#e600ff", "#00eeff",
  "#ff005e", "#ccff00", "#ff3388", "#00ddbb", "#7733ff", "#ffee00",
  "#ff3300", "#00ffcc", "#5500ff", "#88ff00", "#ff5500", "#0099ff",
];
const secondaryStructureColors = [
  ["Helix", "#ff4d4d"],
  ["β-sheet", "#ffd633"],
  ["Loop / coil", "#bfbfbf"],
];
const axes = [
  { name: "X", color: "#ff5252", index: 0 },
  { name: "Y", color: "#69f0ae", index: 1 },
  { name: "Z", color: "#40c4ff", index: 2 },
];
const axisGroup = $("orientation-axes");
const axisElements = axes.map((axis) => {
  const negativeLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const positiveLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const negativeLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  const positiveLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  negativeLine.setAttribute("stroke", axis.color);
  negativeLine.setAttribute("stroke-dasharray", "3 3");
  negativeLabel.setAttribute("fill", axis.color);
  negativeLabel.textContent = `−${axis.name}`;
  positiveLine.setAttribute("stroke", axis.color);
  positiveLine.setAttribute("stroke-width", "2.5");
  positiveLabel.setAttribute("fill", axis.color);
  positiveLabel.textContent = axis.name;
  axisGroup.append(negativeLine, positiveLine, negativeLabel, positiveLabel);
  return { axis, negativeLine, positiveLine, negativeLabel, positiveLabel };
});

let model = null;
let chains = [];
let chainColors = {};
let ligandResidues = [];
let initialView = null;
let loadSequence = 0;
let previousTouchAngle = null;

function setStatus(message, kind = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function positionPanelHide() {
  if (panel.hidden) return;
  const rect = panel.getBoundingClientRect();
  panelHide.style.left = `${rect.right + window.scrollX + 6}px`;
  panelHide.style.top = `${rect.top + window.scrollY}px`;
}

function fitPanelContent() {
  if (panel.hidden || panel.classList.contains("search-mode")) return;
  const availableWidth = panel.clientWidth - 28;
  const availableHeight = panel.clientHeight - 24;
  let low = 6;
  let high = 18;
  let bestFit = low;

  while (low <= high) {
    const fontSize = Math.floor((low + high) / 2);
    panel.style.fontSize = `${fontSize}px`;
    panel.style.setProperty("--panel-font-size", `${fontSize}px`);
    if (panelContent.scrollWidth <= availableWidth &&
        panelContent.scrollHeight <= availableHeight) {
      bestFit = fontSize;
      low = fontSize + 1;
    } else {
      high = fontSize - 1;
    }
  }

  panel.style.fontSize = `${bestFit}px`;
  panel.style.setProperty("--panel-font-size", `${bestFit}px`);
  panel.style.setProperty("--panel-toggle-size", `${bestFit * 1.85}px`);
  panelShow.style.fontSize = `${bestFit}px`;
  panelShow.style.setProperty("--panel-toggle-size", `${bestFit * 1.85}px`);
  axesShow.style.setProperty("--panel-toggle-size", `${bestFit * 1.85}px`);
  positionPanelHide();
}

new ResizeObserver(() => requestAnimationFrame(fitPanelContent)).observe(panel);

function updateOrientationIndicator(view) {
  const rotation = view || viewer.getView();
  const [qx, qy, qz, qw] = rotation.slice(4, 8);
  const directions = [
    { x: 1 - 2 * (qy * qy + qz * qz), y: 2 * (qx * qy + qz * qw), z: 2 * (qx * qz - qy * qw) },
    { x: 2 * (qx * qy - qz * qw), y: 1 - 2 * (qx * qx + qz * qz), z: 2 * (qy * qz + qx * qw) },
    { x: 2 * (qx * qz + qy * qw), y: 2 * (qy * qz - qx * qw), z: 1 - 2 * (qx * qx + qy * qy) },
  ];
  const radius = 42;

  axisElements
    .map((elements) => ({ elements, direction: directions[elements.axis.index] }))
    .sort((a, b) => a.direction.z - b.direction.z)
    .forEach(({ elements, direction }) => {
      const { negativeLine, positiveLine, negativeLabel, positiveLabel } = elements;
      const x = direction.x * radius;
      const y = -direction.y * radius;
      negativeLine.setAttribute("x1", "0");
      negativeLine.setAttribute("y1", "0");
      negativeLine.setAttribute("x2", String(-x));
      negativeLine.setAttribute("y2", String(-y));
      negativeLine.setAttribute("opacity", String(0.25 + 0.45 * (1 - direction.z) / 2));
      positiveLine.setAttribute("x1", "0");
      positiveLine.setAttribute("y1", "0");
      positiveLine.setAttribute("x2", String(x));
      positiveLine.setAttribute("y2", String(y));
      positiveLine.setAttribute("opacity", String(0.55 + 0.45 * (1 + direction.z) / 2));
      negativeLabel.setAttribute("x", String(-x * 1.2));
      negativeLabel.setAttribute("y", String(-y * 1.2));
      negativeLabel.setAttribute("opacity", negativeLine.getAttribute("opacity"));
      positiveLabel.setAttribute("x", String(x * 1.2));
      positiveLabel.setAttribute("y", String(y * 1.2));
      positiveLabel.setAttribute("opacity", positiveLine.getAttribute("opacity"));
      axisGroup.append(negativeLine, positiveLine, negativeLabel, positiveLabel);
    });
}

function parseMetadata(text, format) {
  if (format === "pdb") {
    const lines = text.split(/\r?\n/);
    const compound = lines
      .filter((line) => line.startsWith("COMPND"))
      .map((line) => line.slice(10))
      .join(" ");
    const names = [...compound.matchAll(/(?:^|;)\s*MOLECULE\s*:\s*([^;]+)/gi)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    const proteinName = [...new Set(names)].join(" / ");
    const title = lines
      .filter((line) => line.startsWith("TITLE"))
      .map((line) => line.slice(10).trim())
      .filter(Boolean)
      .join(" ");
    return { proteinName, title };
  }

  const lines = text.split(/\r?\n/);
  let proteinName = "";
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim().toLowerCase() !== "loop_") continue;
    const headers = [];
    let rowIndex = index + 1;
    while (rowIndex < lines.length && lines[rowIndex].trim().startsWith("_")) {
      headers.push(lines[rowIndex].trim().split(/\s+/)[0].toLowerCase());
      rowIndex += 1;
    }
    const descriptionIndex = headers.indexOf("_entity.pdbx_description");
    if (descriptionIndex < 0) continue;
    const typeIndex = headers.indexOf("_entity.type");
    const descriptions = [];
    for (; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex].trim();
      if (!row || row.startsWith("#")) {
        if (row.startsWith("#")) break;
        continue;
      }
      if (row.toLowerCase() === "loop_" || row.startsWith("_") || row.toLowerCase().startsWith("data_")) {
        break;
      }
      const values = row.match(/"(?:[^"]|"")*"|'(?:[^']|'')*'|\S+/g) || [];
      if (values.length !== headers.length ||
          (typeIndex >= 0 && values[typeIndex].toLowerCase() !== "polymer")) continue;
      const description = values[descriptionIndex].replace(/^(['"])(.*)\1$/, "$2").trim();
      if (description && !descriptions.includes(description)) descriptions.push(description);
    }
    if (descriptions.length) {
      proteinName = descriptions.join(" / ");
      break;
    }
  }

  const titleMatch = text.match(/^\s*_struct\.title\s+(.+?)\s*$/mi);
  const title = titleMatch ? titleMatch[1].replace(/^(['"])(.*)\1$/, "$2") : "";
  return { proteinName, title };
}

async function fetchStructure(code) {
  const baseUrl = `https://files.rcsb.org/download/${encodeURIComponent(code)}`;
  const pdbResponse = await fetch(`${baseUrl}.pdb`);
  if (pdbResponse.ok) {
    return { text: await pdbResponse.text(), format: "pdb" };
  }
  if (pdbResponse.status !== 404) {
    throw new Error(`RCSB returned HTTP ${pdbResponse.status} while fetching the PDB file`);
  }

  const assemblyResponse = await fetch(`${baseUrl}-assembly1.cif`);
  if (assemblyResponse.ok) {
    return { text: await assemblyResponse.text(), format: "cif" };
  }
  if (assemblyResponse.status !== 404) {
    throw new Error(`RCSB returned HTTP ${assemblyResponse.status} while fetching the biological assembly`);
  }

  const cifResponse = await fetch(`${baseUrl}.cif`);
  if (cifResponse.ok) {
    return { text: await cifResponse.text(), format: "cif" };
  }
  if (cifResponse.status === 404) {
    throw new Error(`No structure with PDB code ${code} was found`);
  }
  throw new Error(`RCSB returned HTTP ${cifResponse.status} while fetching the mmCIF file`);
}

function setActive(containerId, attribute, value) {
  document.querySelectorAll(`#${containerId} button`).forEach((button) => {
    button.classList.toggle("active", button.dataset[attribute] === value);
  });
}

function drawLegend() {
  const legend = $("legend");
  let items = [];
  if (state.color === "chain") items = chains.map((chain) => [`Chain ${chain}`, chainColors[chain]]);
  else if (state.color === "ss") items = secondaryStructureColors;
  else items = [["N-terminus → C-terminus", "linear-gradient(90deg,#3b4cc0,#7fd37f,#f5e642,#d7301f)"]];

  legend.replaceChildren(...items.map(([name, color]) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = color;
    item.append(swatch, document.createTextNode(name));
    return item;
  }));
}

function render() {
  if (!model) return;
  viewer.setStyle({}, {});
  const options = (color) => {
    if (state.style === "cartoon") {
      return { cartoon: Object.assign({ arrows: true, tubes: false, thickness: 0.4 }, color) };
    }
    if (state.style === "stick") {
      return { stick: Object.assign({ radius: 0.15 }, color) };
    }
    return { line: color };
  };

  if (state.color === "chain") {
    chains.forEach((chain) => {
      viewer.setStyle({ chain }, options({ color: chainColors[chain] }));
    });
  } else if (state.color === "ss") {
    viewer.setStyle({}, options({ colorscheme: "ssJmol" }));
  } else {
    viewer.setStyle({}, options({ color: "spectrum" }));
  }

  if (state.ligands && ligandResidues.length) {
    viewer.addStyle({ resn: ligandResidues }, { stick: { radius: 0.2, colorscheme: "Jmol" } });
  }
  viewer.removeAllSurfaces();
  if (state.surface) {
    viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.55, color: "white" }, { hetflag: false });
  }
  viewer.render();
  drawLegend();
  requestAnimationFrame(fitPanelContent);
}

function updateStructureControls(atoms) {
  chains = [...new Set(atoms.filter((atom) => !atom.hetflag).map((atom) => atom.chain))].sort();
  chainColors = {};
  chains.forEach((chain, index) => {
    chainColors[chain] = palette[index % palette.length];
  });
  ligandResidues = [...new Set(atoms
    .filter((atom) => atom.hetflag && !["HOH", "WAT", "H2O"].includes(atom.resn))
    .map((atom) => atom.resn))];

  const ligandsButton = $("ligands");
  ligandsButton.disabled = ligandResidues.length === 0;
  ligandsButton.textContent = ligandResidues.length ? "Ligands" : "Ligands: none";
  ligandsButton.title = ligandResidues.length
    ? ""
    : "No non-water ligands found in this structure";
  state.ligands = ligandResidues.length > 0;
  ligandsButton.classList.toggle("active", state.ligands);
}

async function loadStructure(code) {
  const sequence = ++loadSequence;
  searchButton.disabled = true;
  searchButton.setAttribute("aria-label", "Loading structure");   searchButton.setAttribute("aria-busy", "true");
  setStatus(`Looking up ${code} in RCSB…`);

  try {
    const structure = await fetchStructure(code);
    if (sequence !== loadSequence) return;

    if (model) viewer.removeModel(model);
    model = viewer.addModel(structure.text, structure.format);
    const atoms = viewer.selectedAtoms({});
    if (!atoms.length) {
      viewer.removeModel(model);
      model = null;
      throw new Error(`RCSB returned a structure file with no readable atoms for ${code}`);
    }

    updateStructureControls(atoms);
    const metadata = parseMetadata(structure.text, structure.format);
    $("structure-title").textContent = code;
    $("protein-name").textContent = metadata.proteinName || metadata.title || "";
    $("protein-name").hidden = !$("protein-name").textContent;

    state.color = "chain";
    state.style = "cartoon";
    state.surface = false;
    state.spin = false;
    viewer.spin(false, 1);
    $("surface").classList.remove("active");
    $("spin").classList.remove("active");
    setActive("colorButtons", "mode", state.color);
    setActive("styleButtons", "style", state.style);
    render();
    viewer.zoomTo();
    viewer.render();
    initialView = viewer.getView().slice();
    viewer.setViewChangeCallback(updateOrientationIndicator);
    updateOrientationIndicator(viewer.getView());

    viewerControls.hidden = false;
    panel.classList.remove("search-mode");
    $("panel-hide").hidden = false;
    orientationIndicator.hidden = false;
    $("panel-show").hidden = true;
    $("axes-show").hidden = true;
    setStatus(`${code} loaded from RCSB`, "success");
    history.replaceState(null, "", `?pdb=${encodeURIComponent(code)}`);
    requestAnimationFrame(() => {
      viewer.resize();
      fitPanelContent();
    });
  } catch (error) {
    if (sequence !== loadSequence) return;
    const message = error instanceof TypeError
      ? "Could not connect to RCSB — check your internet connection and try again"
      : error.message;
    setStatus(message, "error");
  } finally {
    if (sequence === loadSequence) {
      searchButton.disabled = false;
      searchButton.setAttribute("aria-label", "Search");       searchButton.removeAttribute("aria-busy");
    }
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = searchInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    setStatus("Enter a valid four-character PDB code, such as 4HHB", "error");
    searchInput.focus();
    return;
  }
  searchInput.value = code;
  loadStructure(code);
});

searchInput.addEventListener("input", () => {
  searchInput.value = searchInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
});

document.querySelectorAll("#colorButtons button").forEach((button) => {
  button.addEventListener("click", () => {
    state.color = button.dataset.mode;
    setActive("colorButtons", "mode", state.color);
    render();
  });
});
document.querySelectorAll("#styleButtons button").forEach((button) => {
  button.addEventListener("click", () => {
    state.style = button.dataset.style;
    setActive("styleButtons", "style", state.style);
    render();
  });
});
$("spin").addEventListener("click", (event) => {
  state.spin = !state.spin;
  viewer.spin(state.spin ? "y" : false, 1);
  event.currentTarget.classList.toggle("active", state.spin);
});
$("ligands").addEventListener("click", (event) => {
  state.ligands = !state.ligands;
  event.currentTarget.classList.toggle("active", state.ligands);
  render();
});
$("surface").addEventListener("click", (event) => {
  state.surface = !state.surface;
  event.currentTarget.classList.toggle("active", state.surface);
  render();
});
$("reset").addEventListener("click", () => {
  if (!initialView) return;
  viewer.setView(initialView);
  viewer.render();
});

$("panel-hide").addEventListener("click", () => {
  panel.hidden = true;
  panelHide.hidden = true;
  panelShow.hidden = false;
});
panelShow.addEventListener("click", () => {
  panel.hidden = false;
  panelHide.hidden = false;
  panelShow.hidden = true;
  requestAnimationFrame(fitPanelContent);
});
$("axes-hide").addEventListener("click", () => {
  orientationIndicator.hidden = true;
  axesShow.hidden = false;
});
axesShow.addEventListener("click", () => {
  orientationIndicator.hidden = false;
  axesShow.hidden = true;
});

viewer.setHoverable({}, true,
  (atom, currentViewer) => {
    if (!atom.label) {
      atom.label = currentViewer.addLabel(
        `${atom.resn} ${atom.resi} (chain ${atom.chain})`,
        { position: atom, backgroundColor: "black", backgroundOpacity: 0.75,
          fontSize: 12, fontColor: "white" },
      );
    }
  },
  (atom, currentViewer) => {
    if (atom.label) {
      currentViewer.removeLabel(atom.label);
      delete atom.label;
    }
  },
);

function rotateViewAroundScreenAxis(angle) {
  const view = viewer.getView();
  const [qx, qy, qz, qw] = view.slice(4, 8);
  const halfAngle = angle / 2;
  const sinHalf = Math.sin(halfAngle);
  const cosHalf = Math.cos(halfAngle);
  const rotated = [
    cosHalf * qx - sinHalf * qy,
    cosHalf * qy + sinHalf * qx,
    cosHalf * qz + sinHalf * qw,
    cosHalf * qw - sinHalf * qz,
  ];
  const magnitude = Math.hypot(...rotated);
  view.splice(4, 4, ...rotated.map((component) => component / magnitude));
  viewer.setView(view);
  viewer.render();
}

viewerElement.addEventListener("wheel", (event) => {
  if (!event.ctrlKey || event.deltaY === 0 || !model) return;
  event.preventDefault();
  event.stopPropagation();
  rotateViewAroundScreenAxis(event.deltaY * 0.005);
}, { capture: true, passive: false });

function getTouchAngle(touches) {
  return Math.atan2(
    touches[1].clientY - touches[0].clientY,
    touches[1].clientX - touches[0].clientX,
  );
}

viewerElement.addEventListener("touchstart", (event) => {
  previousTouchAngle = event.touches.length === 2 ? getTouchAngle(event.touches) : null;
}, { capture: true, passive: true });
viewerElement.addEventListener("touchmove", (event) => {
  if (event.touches.length !== 2 || !model) {
    previousTouchAngle = null;
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const angle = getTouchAngle(event.touches);
  if (previousTouchAngle !== null) {
    let delta = angle - previousTouchAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    rotateViewAroundScreenAxis(delta);
  }
  previousTouchAngle = angle;
}, { capture: true, passive: false });
viewerElement.addEventListener("touchend", (event) => {
  previousTouchAngle = event.touches.length === 2 ? getTouchAngle(event.touches) : null;
}, { capture: true, passive: true });
viewerElement.addEventListener("touchcancel", () => {
  previousTouchAngle = null;
}, { capture: true, passive: true });

window.addEventListener("resize", () => {
  viewer.resize();
  if (model) updateOrientationIndicator(viewer.getView());
});

const initialCode = new URLSearchParams(window.location.search).get("pdb");
if (initialCode) {
  searchInput.value = initialCode.slice(0, 4).toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(searchInput.value)) loadStructure(searchInput.value);
}
