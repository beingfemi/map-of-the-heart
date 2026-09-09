/* Map of the Heart — a minimal map for the people you love. */

/* ---------------------------------------------------------------- theme */
/* One detailed basemap, recoloured per theme. CARTO's Voyager carries the full
   OpenMapTiles detail — landcover, water, roads by class, buildings, place names —
   and its layer ids are predictable enough to repaint into a macOS Maps palette.
   Repainting beats swapping styles: the theme toggle stays instant and nothing
   has to be rebuilt afterwards. */
const BASE_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';


/* Ink on paper. Land is left blank, water is the faintest wash, and the drawing
   is carried by line: a coastline stroked in ink, borders as hairlines, roads
   barely there. Everything recedes so the arcs and the hearts are what you see. */
const BASEMAP = {
  light: {
    land: '#f8f5ee', water: '#e9eff2', waterShadow: '#eef3f5', waterway: '#c2d3dc',
    coast: '#89a0ad', coastWidth: 0.85,
    green: [222, 228, 210], park: '#e7ece0',
    residential: '#f4f1e9', building: '#efebe1', buildingTop: '#f2eee5',
    motFill: '#ece5d6', motCase: '#ddd4c2',
    trunkFill: '#eee8da', trunkCase: '#e0d8c7',
    priFill: '#f1ece1', priCase: '#e4dccd',
    secFill: '#f3eee4', secCase: '#e7e0d2',
    minorFill: '#f5f1e8', minorCase: '#ebe5d9',
    path: '#e0d9cb', rail: '#ded7c9', aeroway: '#eee9dd',
    boundaryCountry: '#c0b6a6', boundaryState: '#ddd5c7',
    placeText: '#5f584d', roadText: '#9c948a', waterText: '#8fa4ae', poiText: '#948c82',
    halo: '#f8f5ee'
  },
  dark: {
    land: '#141519', water: '#191d23', waterShadow: '#16191f', waterway: '#2b3540',
    coast: '#55626f', coastWidth: 0.9,
    green: [26, 30, 28], park: '#1a1f1c',
    residential: '#181a1e', building: '#1d2025', buildingTop: '#202429',
    motFill: '#262a30', motCase: '#1c1f24',
    trunkFill: '#24282e', trunkCase: '#1b1e23',
    priFill: '#22262b', priCase: '#191c21',
    secFill: '#202429', secCase: '#181b20',
    minorFill: '#1e2126', minorCase: '#16191d',
    path: '#23272c', rail: '#22262b', aeroway: '#1e2126',
    boundaryCountry: '#3d444d', boundaryState: '#2a2f36',
    placeText: '#9aa1aa', roadText: '#6e757e', waterText: '#71838f', poiText: '#767d86',
    halo: '#101216'
  }
};

/* Appearance follows the system by default and keeps following it — a Mac that
   switches to dark at sunset takes this with it. The control cycles
   Auto -> Light -> Dark, and only a deliberate choice pins it. */
const darkMedia = matchMedia('(prefers-color-scheme: dark)');
const MODES = ['auto', 'light', 'dark'];

function savedMode() {
  const m = localStorage.getItem('moth.theme');
  return MODES.indexOf(m) >= 0 ? m : 'auto';
}
let themeMode = savedMode();
const resolveTheme = () => themeMode === 'auto' ? (darkMedia.matches ? 'dark' : 'light') : themeMode;
let theme = resolveTheme();
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.appearance = themeMode;

/* Graphite, not pink — a pencil line across paper. The only saturated thing
   left on the map is the blue dot standing for you, the way Maps does it. */
const COLORS = {
  light: { line: '#3a3a3c', glow: '#8e8e93', pulse: '#1c1c1e' },
  dark:  { line: '#d1d1d6', glow: '#8e8e93', pulse: '#f2f2f7' }
};

/* What the line between you means. Colour is the only thing carrying it, so the
   set stays small and the default stays graphite — colour is something you opt
   into, person by person, and the map is still quiet if you never do. */
const BONDS = [
  { id: 'partner', label: 'Partner', light: '#ff2d55', dark: '#ff375f' },
  { id: 'family',  label: 'Family',  light: '#ff9500', dark: '#ff9f0a' },
  { id: 'friend',  label: 'Friend',  light: '#34c759', dark: '#30d158' },
  { id: 'someone', label: 'Someone', light: '#3a3a3c', dark: '#d1d1d6' }
];
const DEFAULT_BOND = 'someone';
const bondOf = h => BONDS.find(b => b.id === h.bond) || BONDS[BONDS.length - 1];
const bondColor = h => bondOf(h)[theme];
const ink = () => COLORS[theme];

/* ---------------------------------------------------------------- state */
const state = { you: null, hearts: [] };
let nextId = 1;
let booted = false;   // nothing is written to storage until the saved map has been restored
let bootRetry = null;

function serialize() {
  return {
    you: state.you && { lng: r5(state.you.lng), lat: r5(state.you.lat), label: state.you.label },
    hearts: state.hearts.map(h => ({ lng: r5(h.lng), lat: r5(h.lat), label: h.label, name: h.name, bond: h.bond || DEFAULT_BOND }))
  };
}
function save() {
  if (!booted) return;
  try { localStorage.setItem('moth.state', JSON.stringify(serialize())); } catch (e) {}
}
function loadLocal() {
  try {
    const raw = localStorage.getItem('moth.state');
    if (!raw) return false;
    return adopt(JSON.parse(raw));
  } catch (e) { return false; }
}
function adopt(data) {
  if (!data || !data.you || typeof data.you.lng !== 'number') return false;
  state.you = data.you;
  state.hearts = (data.hearts || []).filter(h => typeof h.lng === 'number' && typeof h.lat === 'number');
  state.hearts.forEach(h => { h.id = nextId++; h.p = 1; h.bond = bondOf(h).id; });
  return true;
}

/* compact url encoding */
const b64url = {
  enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) 
};
const r5 = n => Math.round(n * 1e5) / 1e5;
function encodeState() { return b64url.enc(JSON.stringify(serialize())); }
function loadHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  try { return adopt(JSON.parse(b64url.dec(h))); } catch (e) { return false; }
}

/* ---------------------------------------------------------------- geo math */
const R_KM = 6371.0088;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

function distanceKm(a, b) {
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const compass = brg => COMPASS[Math.round(brg / 45) % 8];

/* great-circle path, longitudes unwrapped so it never tears at the antimeridian */
function greatCircle(a, b, n = 160) {
  const lon1 = rad(a[0]), lat1 = rad(a[1]), lon2 = rad(b[0]), lat2 = rad(b[1]);
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin((lat1 - lat2) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon1 - lon2) / 2) ** 2
  )));
  if (d < 1e-9) return [[a[0], a[1]], [b[0], b[1]]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  for (let i = 1; i < pts.length; i++) {
    const gap = pts[i][0] - pts[i - 1][0];
    if (gap > 180) pts[i][0] -= 360;
    else if (gap < -180) pts[i][0] += 360;
  }
  return pts;
}

const wrapLng = l => { const x = ((l + 180) % 360 + 360) % 360; return x - 180; };

/* An unwrapped path can run past ±180. With a single world rendered, that has to
   become several pieces: cut at each dateline crossing and land the cut exactly on
   the edge, so the line leaves one side and picks up on the other. */
function splitWorlds(path) {
  const worldOf = l => Math.floor((l + 180) / 360);
  const out = [];
  let cur = [[wrapLng(path[0][0]), path[0][1]]];

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const wa = worldOf(a[0]), wb = worldOf(b[0]);
    if (wa !== wb) {
      const east = wb > wa;
      const edge = 360 * (east ? wa : wb) + 180;             // the crossing, unwrapped
      const t = (b[0] - a[0]) === 0 ? 0 : (edge - a[0]) / (b[0] - a[0]);
      const lat = a[1] + t * (b[1] - a[1]);
      cur.push([east ? 180 : -180, lat]);
      out.push(cur);
      cur = [[east ? -180 : 180, lat]];
    }
    cur.push([wrapLng(b[0]), b[1]]);
  }
  out.push(cur);
  return out.filter(seg => seg.length > 1);
}

/* is the sun up where they are? (NOAA low-precision solar position) */
function sunAltitude(lat, lng, when = new Date()) {
  const d = (when.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = rad(357.529 + 0.98560028 * d);
  const q = 280.459 + 0.98564736 * d;
  const L = rad(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const e = rad(23.439 - 0.00000036 * d);
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))) / 15;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = ((gmst + lng / 15) % 24 + 24) % 24;
  let ha = rad(((lst - ra + 36) % 24 - 12) * 15);
  return deg(Math.asin(
    Math.sin(rad(lat)) * Math.sin(dec) + Math.cos(rad(lat)) * Math.cos(dec) * Math.cos(ha)
  ));
}
const skyGlyph = (lat, lng) => sunAltitude(lat, lng) > -0.83 ? '☀︎' : '☾';

function skyWord(lat, lng, full) {
  const alt = sunAltitude(lat, lng);
  const w = alt > 6 ? '☀︎ daylight' : alt > -0.83 ? '☀︎ golden hour' : alt > -6 ? '☾ twilight' : '☾ night';
  return full ? w + ' there' : w;
}

function fmtDistance(km) {
  const mi = km * 0.621371;
  const k = km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString();
  const m = mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString();
  return { km: k + ' km', mi: m + ' mi' };
}

/* ---------------------------------------------------------------- map */
const map = new maplibregl.Map({
  container: 'map',
  style: BASE_STYLE,
  center: [8, 26],
  zoom: 1.4,
  attributionControl: { compact: true },
  renderWorldCopies: false,   // one Earth, not a tiled wallpaper of them
  maxZoom: 18
});
map.touchZoomRotate.enableRotation();
map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });

let userMoved = false;          // once they pan or zoom themselves, we stop re-framing on them

/* macOS Maps interaction: a two-finger scroll moves the map, it does not zoom.
   Browsers report a trackpad pinch as a wheel event with ctrlKey set, so that
   is the one gesture that scales. Mice without a pinch keep cmd+scroll and the
   zoom buttons. */
map.scrollZoom.disable();
{
  const canvas = map.getCanvas();
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    userMoved = true;
    // wheels report in pixels, lines or pages depending on the device
    const step = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    if (e.ctrlKey || e.metaKey) {
      const r = canvas.getBoundingClientRect();
      const around = map.unproject([e.clientX - r.left, e.clientY - r.top]);
      // a trackpad pinch arrives as many small events, a mouse notch as one big
      // one — clamp so a single notch cannot leap across zoom levels
      const dz = Math.max(-0.5, Math.min(0.5, -e.deltaY * step * 0.012));
      map.easeTo({ zoom: map.getZoom() + dz, around, duration: 0 });
    } else {
      map.panBy([e.deltaX * step, e.deltaY * step], { duration: 0 });
    }
  }, { passive: false });
}

/* the pane can settle its size after the map is built — keep the canvas honest */
['dragstart', 'zoomstart', 'rotatestart'].forEach(ev =>
  map.on(ev, e => { if (e.originalEvent) userMoved = true; })
);

let refitTimer;
new ResizeObserver(() => {
  map.resize();
  map.triggerRepaint();
  // the pane can settle after the first fitBounds — re-frame until they take the wheel
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => { if (!userMoved && booted && state.hearts.length) fitTo(allPoints()); }, 180);
}).observe(document.getElementById('map'));
addEventListener('orientationchange', () => setTimeout(() => map.resize(), 220));

const base = () => BASEMAP[theme];
function setPaint(id, prop, val) { try { map.setPaintProperty(id, prop, val); } catch (e) {} }
function setLayout(id, prop, val) { try { map.setLayoutProperty(id, prop, val); } catch (e) {} }

/* Voyager fades greenery in with zoom by ramping the colour's alpha, so a flat
   colour would slam it on at world view. Rebuild the ramp in our own hue. */
function greenRamp(rgb) {
  const a = o => 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + o + ')';
  return { stops: [[6, a(0)], [7.5, a(0.22)], [9, a(0.3)], [11, a(0.4)], [13, a(0.5)], [15, a(0.64)]] };
}

/* Voyager holds much of its structure back until you are well zoomed in, but the
   tiles carry that data earlier than the style admits. Bring the layers that read
   as structure — countries, states, major cities, coastal names, parks — forward a
   few levels so a zoomed-out map still says something. */
const EARLIER = {
  // Zoomed right out, name continents, oceans and a handful of major cities;
  // country names arrive once you have zoomed in a little.
  place_continent: [0, 3.2],
  place_country_1: [2.6, 7],
  place_country_2: [3.4, 10],
  place_state: [6, 10],
  place_city_dot_r2: [2, 7],
  place_city_dot_r4: [3, 7],
  place_city_dot_r7: [5, 7],
  boundary_country_outline: [2, 24],
  boundary_state: [3, 24],
  boundary_county: [7, 24],
  watername_ocean: [0, 6],
  watername_sea: [3, 24],
  park_national_park: [6, 24],
  landuse_residential: [5, 24]
};

function boostLowZoomDetail() {
  Object.keys(EARLIER).forEach(id => {
    const z = EARLIER[id];
    try { map.setLayerZoomRange(id, z[0], z[1]); } catch (e) {}
  });
}

function applyBasemapPalette() {
  let layers;
  try { layers = (map.getStyle() || {}).layers || []; } catch (e) { return false; }
  if (!layers.length) return false;
  const c = base();

  layers.forEach(l => {
    const id = l.id, t = l.type;

    if (t === 'background') return setPaint(id, 'background-color', c.land);

    if (t === 'symbol') {
      const col = /^place_/.test(id) ? c.placeText
        : /^watername_/.test(id) ? c.waterText
        : /^roadname_/.test(id) ? c.roadText
        : c.poiText;
      setPaint(id, 'text-color', col);
      setPaint(id, 'text-halo-color', c.halo);
      setPaint(id, 'text-halo-width', 1.3);
      setPaint(id, 'icon-color', col);
      // the style shouts country, state and continent names in caps
      setLayout(id, 'text-transform', 'none');
      if (/^place_(continent|country)/.test(id)) setLayout(id, 'text-letter-spacing', 0.02);
      return;
    }

    if (id === 'coastline') { setPaint(id, 'line-color', c.coast); return; }
    if (id === 'water_shadow') return setPaint(id, 'fill-color', c.waterShadow);
    if (id === 'water') return setPaint(id, 'fill-color', c.water);
    if (id === 'waterway') return setPaint(id, 'line-color', c.waterway);
    if (id === 'landcover' || id === 'landuse') return setPaint(id, 'fill-color', greenRamp(c.green));
    if (/^park_/.test(id)) return setPaint(id, 'fill-color', c.park);
    if (id === 'landuse_residential') return setPaint(id, 'fill-color', c.residential);
    if (id === 'building-top') return setPaint(id, 'fill-color', c.buildingTop);
    if (id === 'building') return setPaint(id, 'fill-color', c.building);
    if (/^aeroway/.test(id)) return setPaint(id, t === 'line' ? 'line-color' : 'fill-color', c.aeroway);
    if (/^boundary_country/.test(id)) return setPaint(id, 'line-color', c.boundaryCountry);
    if (/^boundary_/.test(id)) return setPaint(id, 'line-color', c.boundaryState);

    if (t !== 'line') return;
    if (/rail/.test(id)) return setPaint(id, 'line-color', c.rail);
    if (/_path/.test(id)) return setPaint(id, 'line-color', c.path);

    const casing = /_case/.test(id);
    const cls = /_mot/.test(id) ? 'mot' : /_trunk/.test(id) ? 'trunk'
      : /_pri/.test(id) ? 'pri' : /_sec/.test(id) ? 'sec' : 'minor';
    setPaint(id, 'line-color', c[cls + (casing ? 'Case' : 'Fill')]);
  });

  const dark = theme === 'dark';

  // borders as a single fine dashed hairline, not a line plus a halo
  setLayout('boundary_country_outline', 'visibility', 'none');
  setPaint('boundary_country_inner', 'line-dasharray', [3, 2.2]);
  setPaint('boundary_country_inner', 'line-width',
    ['interpolate', ['linear'], ['zoom'], 1, 0.6, 5, 0.85, 10, 1.1]);
  setPaint('boundary_state', 'line-dasharray', [2, 2.5]);
  setPaint('boundary_state', 'line-width', 0.6);
  // a sketch does not label stadiums and house numbers
  ['poi_stadium', 'poi_park', 'housenumber'].forEach(id => setLayout(id, 'visibility', 'none'));

  boostLowZoomDetail();
  applySky();
  // shows only in the moment before the first tiles paint
  try { document.getElementById('map').style.backgroundColor = c.land; } catch (e) {}
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', c.land);
  return true;
}

const EMPTY = { type: 'FeatureCollection', features: [] };

/* Rotation also brings tilt, and a tilted map with nothing above the horizon
   looks unfinished. A plain sky sits there when pitched and is invisible flat. */
function applySky() {
  const dark = theme === 'dark';
  try {
    map.setSky({
      'sky-color': dark ? '#0d1626' : '#8fc4ee',
      'horizon-color': dark ? '#1d2b3d' : '#d6ebfb',
      'fog-color': dark ? '#17181b' : '#eef4f8',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.1,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0, 4, 0.5, 8, 0.7]
    });
  } catch (e) {}
}

/* The line that makes it a drawing. MapLibre will stroke a polygon source as a
   line layer, so the water polygons give us a coastline for free. */
function installCoastline() {
  if (map.getLayer('coastline')) return;
  const above = (map.getStyle().layers || []).find(l => /^(landcover|landuse|park_|boundary|road|tunnel|bridge|building)/.test(l.id));
  map.addLayer({
    id: 'coastline',
    type: 'line',
    source: 'carto',
    'source-layer': 'water',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': base().coast,
      'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 3, 0.9, 6, 1.1, 10, 1.3, 14, 1.5],
      'line-opacity': 1
    }
  }, above && above.id);
}

function installLayers() {
  if (!map.getSource('arcs')) map.addSource('arcs', { type: 'geojson', data: EMPTY });
  if (!map.getSource('pulses')) map.addSource('pulses', { type: 'geojson', data: EMPTY });

  if (!map.getLayer('arc-glow')) {
    map.addLayer({
      id: 'arc-glow', type: 'line', source: 'arcs',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': 0.16, 'line-blur': 5 }
    });
  }
  if (!map.getLayer('arc-line')) {
    map.addLayer({
      id: 'arc-line', type: 'line', source: 'arcs',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 6, 2.2, 12, 3],
        'line-opacity': 0.9
      }
    });
  }
  if (!map.getLayer('pulse-halo')) {
    map.addLayer({
      id: 'pulse-halo', type: 'circle', source: 'pulses',
      paint: { 'circle-color': ['get', 'color'], 'circle-radius': 11, 'circle-opacity': ['*', ['get', 'o'], 0.16], 'circle-blur': 0.8 }
    });
  }
  if (!map.getLayer('pulse-core')) {
    map.addLayer({
      id: 'pulse-core', type: 'circle', source: 'pulses',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 3.6,
        'circle-opacity': ['get', 'o'],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': ['*', ['get', 'o'], 0.6]
      }
    });
  }
}

function repaintTheme() {
  if (!map.getLayer('arc-line')) return;
  // arc and pulse colour comes from each feature's bond, refreshed by draw()
}

/* setStyle drops every custom source and layer, and `style.load` is not
   dependable across style swaps — so watch styledata and rebuild when they're gone. */
let painted = false;
function ensureLayers() {
  if (!map.style) return;
  // flat world. getProjection() is undefined until one is set, so never
  // dereference it blindly.
  try {
    const proj = map.getProjection && map.getProjection();
    if (!proj || proj.type !== 'mercator') map.setProjection({ type: 'mercator' });
  } catch (e) {}
  applySky();
  try { installCoastline(); } catch (e) {}
  if (!painted) painted = applyBasemapPalette();
  if (map.getSource('arcs')) { repaintTheme(); return; }
  // isStyleLoaded() can sit false on a perfectly usable map, so just try it
  try { installLayers(); } catch (e) { return; }
  repaintTheme();
  if (booted) render();
}
function onStyle() { ensureLayers(); boot(); }
map.on('style.load', onStyle);
map.on('styledata', onStyle);

/* ---------------------------------------------------------------- markers */
let youMarker = null;
const heartMarkers = new Map();

function makeYouEl() {
  const el = document.createElement('div');
  el.className = 'mk mk-you';
  return el;
}
function makeHeartEl(heart) {
  const el = document.createElement('div');
  el.className = 'mk mk-heart';
  // The drop animation lives on an inner wrapper, never on the element MapLibre
  // positions: a CSS animation on `transform` beats the inline transform it sets,
  // and with fill:both it keeps beating it, which leaves the pin behind when the
  // map moves.
  el.innerHTML =
    '<span class="mk-drop">' +
      '<svg viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M15 37c0-6 11-13.2 11-22A11 11 0 0 0 4 15c0 8.8 11 16 11 22Z" fill="' + bondColor(heart) + '"/>' +
        '<g class="pulse"><path d="M15 20.2s-5-3.1-5-6.5a2.9 2.9 0 0 1 5-1.9 2.9 2.9 0 0 1 5 1.9c0 3.4-5 6.5-5 6.5Z" fill="#fff"/></g>' +
      '</svg>' +
    '</span>' +
    '<div class="mk-label"></div>';
  el.querySelector('.mk-label').textContent = heart.name || heart.label;
  el.addEventListener('click', e => { e.stopPropagation(); focusHeart(heart.id); });
  return el;
}

function syncMarkers() {
  if (state.you) {
    if (!youMarker) youMarker = new maplibregl.Marker({ element: makeYouEl() }).setLngLat([state.you.lng, state.you.lat]).addTo(map);
    else youMarker.setLngLat([state.you.lng, state.you.lat]);
  } else if (youMarker) { youMarker.remove(); youMarker = null; }

  for (const [id, mk] of heartMarkers) {
    if (!state.hearts.some(h => h.id === id)) { mk.remove(); heartMarkers.delete(id); }
  }
  state.hearts.forEach(h => {
    let mk = heartMarkers.get(h.id);
    if (!mk) {
      mk = new maplibregl.Marker({ element: makeHeartEl(h), anchor: 'bottom', offset: [0, 1] })
        .setLngLat([h.lng, h.lat]).addTo(map);
      heartMarkers.set(h.id, mk);
    } else {
      mk.setLngLat([h.lng, h.lat]);
      mk.getElement().querySelector('.mk-label').textContent = h.name || h.label;
      mk.getElement().querySelector('path').setAttribute('fill', bondColor(h));
    }
  });
}

/* ---------------------------------------------------------------- drawing */
const DRAW_MS = 1100;
let raf = null;

function arcFor(h) {
  if (!h._path) h._path = greatCircle([state.you.lng, state.you.lat], [h.lng, h.lat]);
  return h._path;
}

function draw(now) {
  if (!state.you) return;
  const arcFeatures = [];
  const pulseFeatures = [];
  let animating = false;

  state.hearts.forEach((h, i) => {
    const path = arcFor(h);
    if (h.p !== 1) {
      if (h._t0 === undefined) h._t0 = now;
      h.p = Math.min(1, (now - h._t0) / DRAW_MS);
      if (h.p < 1) animating = true;
    }
    const eased = 1 - Math.pow(1 - h.p, 3);
    const upto = Math.max(2, Math.round(eased * (path.length - 1)) + 1);
    const col = bondColor(h);
    arcFeatures.push({
      type: 'Feature', properties: { color: col },
      geometry: { type: 'MultiLineString', coordinates: splitWorlds(path.slice(0, upto)) }
    });

    if (h.p >= 1) {
      const CYCLE = 4200, TRAVEL = 2700;
      const t = ((now + i * 900) % CYCLE);
      if (t < TRAVEL) {
        const f = t / TRAVEL;
        const smooth = f * f * (3 - 2 * f);
        const idx = Math.min(path.length - 1, Math.round(smooth * (path.length - 1)));
        const fade = Math.min(1, Math.min(f, 1 - f) * 6);
        pulseFeatures.push({
          type: 'Feature', properties: { o: fade, color: col },
          geometry: { type: 'Point', coordinates: [wrapLng(path[idx][0]), path[idx][1]] }
        });
      }
    }
  });

  const arcs = map.getSource('arcs');
  const pulses = map.getSource('pulses');
  if (arcs) arcs.setData({ type: 'FeatureCollection', features: arcFeatures });
  if (pulses) pulses.setData({ type: 'FeatureCollection', features: pulseFeatures });
  return animating;
}

function loop(now) {
  draw(now);
  raf = state.hearts.length ? requestAnimationFrame(loop) : null;
}
function kick() {
  if (!raf && state.hearts.length) raf = requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------- geocoding */
const NOMINATIM = 'https://nominatim.openstreetmap.org';

async function geocode(q) {
  const url = NOMINATIM + '/search?format=jsonv2&limit=6&addressdetails=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('geocode failed');
  const data = await res.json();
  return data.map(d => {
    const parts = d.display_name.split(',').map(s => s.trim());
    return {
      lng: parseFloat(d.lon),
      lat: parseFloat(d.lat),
      title: parts[0],
      sub: parts.slice(1).join(', '),
      label: parts.slice(0, 2).join(', ') || parts[0]
    };
  });
}

async function reverse(lng, lat) {
  try {
    const url = NOMINATIM + '/reverse?format=jsonv2&zoom=10&lat=' + lat + '&lon=' + lng;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw 0;
    const d = await res.json();
    const parts = (d.display_name || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) throw 0;
    return parts.slice(0, 2).join(', ');
  } catch (e) {
    return lat.toFixed(2) + '°, ' + lng.toFixed(2) + '°';
  }
}

/* ---------------------------------------------------------------- ui refs */
const $ = id => document.getElementById(id);
const stepYou = $('stepYou'), stepThem = $('stepThem'), stepList = $('stepList');
const youSearch = $('youSearch'), youResults = $('youResults');
const themName = $('themName'), themSearch = $('themSearch'), themResults = $('themResults');
const heartsList = $('heartsList'), homeLabel = $('homeLabel'), homeSun = $('homeSun');
const toastEl = $('toast'), panel = $('panel');

let mode = 'you';           // 'you' | 'them' | 'list'
let pendingBond = DEFAULT_BOND;
let collapsed = localStorage.getItem('moth.collapsed') === '1';

/* Folded away, the sheet is just the place you are standing and a count. It only
   makes sense once someone is on the map, so it unfolds itself when the list empties. */
function applyCollapse() {
  if (!state.hearts.length) collapsed = false;
  panel.classList.toggle('collapsed', collapsed);
  const btn = $('btnCollapse');
  btn.hidden = !state.hearts.length;
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.setAttribute('aria-label', collapsed ? 'Show the list' : 'Collapse the list');
}

function paintBondPicker() {
  const box = $('bondPicker');
  box.innerHTML = '';
  BONDS.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.bond = b.id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(b.id === pendingBond));
    btn.className = b.id === pendingBond ? 'on' : '';
    btn.style.setProperty('--dot', b[theme]);
    btn.innerHTML = '<span class="seg-dot"></span>';
    btn.appendChild(document.createTextNode(b.label));
    btn.addEventListener('click', () => { pendingBond = b.id; paintBondPicker(); });
    box.appendChild(btn);
  });
}

function setMode(next) {
  mode = next;
  stepYou.hidden = next !== 'you';
  stepThem.hidden = next !== 'them';
  stepList.hidden = next !== 'list';
  $('themCancel').hidden = !state.hearts.length;
  map.getCanvas().style.cursor = (next === 'you' || next === 'them') ? 'crosshair' : '';
  if (next === 'them') { paintBondPicker(); setTimeout(() => themName.focus(), 60); }
  if (next === 'you') setTimeout(() => youSearch.focus(), 60);
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
}

/* ---------------------------------------------------------------- render */
function render() {
  syncMarkers();
  state.hearts.forEach(h => { h._path = null; });

  if (state.you) {
    homeLabel.textContent = state.you.label;
    homeSun.textContent = collapsed && state.hearts.length
      ? state.hearts.length + (state.hearts.length === 1 ? ' person' : ' people')
      : skyWord(state.you.lat, state.you.lng, true);
  }

  heartsList.innerHTML = '';
  state.hearts.forEach((h, i) => {
    const km = distanceKm([state.you.lng, state.you.lat], [h.lng, h.lat]);
    const d = fmtDistance(km);
    const li = document.createElement('li');
    li.style.animationDelay = (i * 45) + 'ms';
    li.innerHTML =
      '<span class="h-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8.5-5.3-8.5-11.1A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.5 3.3C20.5 15.7 12 21 12 21Z"/></svg></span>' +
      '<span class="h-body"><span class="h-name"></span><span class="h-meta"></span></span>' +
      '<span class="h-dist"></span>' +
      '<button class="h-remove" title="Remove" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
    li.querySelector('.h-name').textContent = h.name || h.label;
    li.querySelector('.h-meta').textContent = h.label + ' · ' + skyGlyph(h.lat, h.lng);
    const dist = li.querySelector('.h-dist');
    dist.textContent = d.km;
    dist.title = d.mi + ' · ' + compass(bearing([state.you.lng, state.you.lat], [h.lng, h.lat]));
    const icon = li.querySelector('.h-icon');
    const b = bondOf(h);
    icon.style.color = b[theme];
    icon.style.background = b.id === 'someone' ? '' : b[theme] + '24';
    icon.title = b.label + ' — click to change';
    icon.addEventListener('click', e => {
      e.stopPropagation();
      const next = BONDS[(BONDS.indexOf(bondOf(h)) + 1) % BONDS.length];
      h.bond = next.id;
      render();
      toast(h.name + ' · ' + next.label);
    });
    li.addEventListener('click', () => focusHeart(h.id));
    li.querySelector('.h-remove').addEventListener('click', e => {
      e.stopPropagation();
      state.hearts = state.hearts.filter(x => x.id !== h.id);
      save(); render();
      if (!state.hearts.length) setMode('them');
    });
    heartsList.appendChild(li);
  });

  applyCollapse();
  save();
  kick();
  draw(performance.now());
}

function focusHeart(id) {
  const h = state.hearts.find(x => x.id === id);
  if (!h || !state.you) return;
  fitTo(map.getContainer().clientWidth < 640
    ? [[state.you.lng, state.you.lat], [h.lng, h.lat]]
    : arcFor(h));
}

/* every point of every arc, so a curve that swings north stays in frame */
function allPoints() {
  if (!state.you) return [];
  const pts = [[state.you.lng, state.you.lat]];
  const narrow = map.getContainer().clientWidth < 640;
  state.hearts.forEach(h => narrow
    ? pts.push([h.lng, h.lat])
    : pts.push(...arcFor(h).map(c => [wrapLng(c[0]), c[1]])));
  return pts;
}

function fitTo(coords) {
  if (!coords.length) return;
  const el = map.getContainer();
  const w = el.clientWidth, h = el.clientHeight;
  const narrow = w < 640;

  const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
  const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];

  const panelH = panel.getBoundingClientRect().height;
  const full = {
    top: Math.min(96, h * 0.14),
    bottom: narrow ? Math.min(panelH + 16, h * 0.42) : Math.min(72, h * 0.12),
    left: narrow ? 22 : Math.min(380, w * 0.34),
    right: narrow ? 22 : Math.min(64, w * 0.08)
  };

  // With a single world and no copies, MapLibre will not zoom out past the point
  // where the map stops covering the viewport. Ask it to fit a span wider than
  // that — four people spread across the globe, with the panel eating 380px of
  // width — and cameraForBounds returns nothing at all rather than its best
  // effort, which used to leave the camera exactly where it was. So ease the
  // padding off until a camera exists, then clamp it into range.
  const floor = Math.max(Math.log2(w / 512), Math.log2(h / 512));
  let cam = null, pad = full;
  for (const scale of [1, 0.6, 0.3, 0]) {
    const p = { top: full.top * scale, bottom: full.bottom * scale,
                left: full.left * scale, right: full.right * scale };
    const c = map.cameraForBounds(bounds, { padding: p, maxZoom: 9 });
    if (c) { cam = c; pad = p; break; }
  }

  if (!cam) {
    // nothing frames it: show as much of the map as this window can hold
    map.easeTo({ center: [0, 20], zoom: floor, duration: 1400, essential: true });
    return;
  }

  // cameraForBounds has already folded the padding into this centre and zoom.
  // Passing `padding` on to easeTo as well would leave it stuck on the transform,
  // and MapLibre then only keeps the *padded* box covered by the map — so panning
  // west lets the edge of the world slide `padding.left` pixels into view and you
  // get a band of empty background down the side. Move with centre and zoom alone.
  map.easeTo({
    center: cam.center,
    zoom: Math.max(cam.zoom, floor),
    duration: 1400,
    essential: true
  });
}

/* ---------------------------------------------------------------- actions */
function setYou(place, fly = true) {
  state.you = { lng: place.lng, lat: place.lat, label: place.label };
  state.hearts.forEach(h => { h._path = null; });
  render();
  if (fly) {
    if (state.hearts.length) fitTo(allPoints());
    else map.flyTo({ center: [place.lng, place.lat], zoom: 5.2, duration: 1600, essential: true });
  }
  setMode(state.hearts.length ? 'list' : 'them');
}

function addHeart(place, name) {
  const h = {
    id: nextId++,
    lng: place.lng, lat: place.lat,
    label: place.label,
    name: (name || '').trim() || place.title || place.label,
    bond: pendingBond,
    p: 0, _t0: undefined
  };
  state.hearts.push(h);
  render();
  fitTo(allPoints());
  setMode('list');
  const d = fmtDistance(distanceKm([state.you.lng, state.you.lat], [h.lng, h.lat]));
  toast(h.name + ' · ' + d.km + ' away');
}

/* ---------------------------------------------------------------- search wiring */
function wireSearch(input, list, onPick) {
  let timer, seq = 0, items = [], cursor = -1;

  function close() { list.hidden = true; list.innerHTML = ''; items = []; cursor = -1; }

  function paint(results) {
    list.innerHTML = '';
    items = results;
    cursor = -1;
    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nothing found there.';
      list.appendChild(li);
    } else {
      results.forEach((r, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.innerHTML = '<span class="s"></span>';
        li.insertBefore(document.createTextNode(r.title), li.firstChild);
        li.querySelector('.s').textContent = r.sub;
        li.addEventListener('mousedown', e => { e.preventDefault(); close(); input.value = ''; onPick(r); });
        list.appendChild(li);
      });
    }
    list.hidden = false;
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 2) { close(); return; }
    timer = setTimeout(async () => {
      const my = ++seq;
      try {
        const results = await geocode(q);
        if (my !== seq) return;
        paint(results);
      } catch (e) {
        if (my !== seq) return;
        list.innerHTML = '<li class="empty">Search is unavailable — tap the map instead.</li>';
        list.hidden = false;
      }
    }, 320);
  });

  input.addEventListener('keydown', e => {
    if (list.hidden || !items.length) return;
    const opts = [...list.querySelectorAll('li[role="option"]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      opts.forEach(o => o.setAttribute('aria-selected', 'false'));
      cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts[cursor].setAttribute('aria-selected', 'true');
      opts[cursor].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[cursor >= 0 ? cursor : 0];
      close(); input.value = '';
      onPick(pick);
    } else if (e.key === 'Escape') { close(); }
  });

  input.addEventListener('blur', () => setTimeout(close, 140));
  return { close };
}

wireSearch(youSearch, youResults, place => setYou(place));
wireSearch(themSearch, themResults, place => addHeart(place, themName.value));

/* ---------------------------------------------------------------- map click */
let lastClickAt = 0;
map.on('click', async e => {
  const now = Date.now();
  if (now - lastClickAt < 350) return;   // the second half of a double-click
  lastClickAt = now;
  const p = { lng: e.lngLat.lng, lat: e.lngLat.lat, label: 'Locating…', title: '' };
  if (mode === 'you') {
    setYou(p, false);
    p.label = await reverse(p.lng, p.lat);
    state.you.label = p.label;
    render();
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 4.6), duration: 1200, essential: true });
  } else if (mode === 'them') {
    const name = themName.value;
    addHeart(p, name);
    const h = state.hearts[state.hearts.length - 1];
    const label = await reverse(p.lng, p.lat);
    h.label = label;
    if (!name.trim()) h.name = label;
    render();
  }
});

/* ---------------------------------------------------------------- buttons */
$('btnAdd').addEventListener('click', () => {
  themName.value = ''; themSearch.value = '';
  pendingBond = DEFAULT_BOND; paintBondPicker();
  setMode('them');
});
$('themCancel').addEventListener('click', () => { if (state.hearts.length) setMode('list'); });
$('btnMoveHome').addEventListener('click', e => { e.stopPropagation(); youSearch.value = ''; setMode('you'); });

$('btnCollapse').addEventListener('click', e => {
  e.stopPropagation();
  collapsed = !collapsed;
  localStorage.setItem('moth.collapsed', collapsed ? '1' : '0');
  render();
});

$('btnLocate').addEventListener('click', () => {
  const btn = $('btnLocate');
  if (!navigator.geolocation) { toast('Your browser will not share a location.'); return; }
  btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(async pos => {
    btn.classList.remove('busy');
    const lng = pos.coords.longitude, lat = pos.coords.latitude;
    setYou({ lng, lat, label: 'Locating…' }, true);
    const label = await reverse(lng, lat);
    state.you.label = label;
    render();
  }, () => {
    btn.classList.remove('busy');
    toast('Could not get your location.');
  }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 });
});

/* Turning the map is only useful if getting back to north is one click away —
   the compass appears the moment you are off-axis, like the one in Maps. */
const compassBtn = $('btnCompass');
function syncCompass() {
  const b = map.getBearing(), p = map.getPitch();
  compassBtn.classList.toggle('on', Math.abs(b) > 0.5 || p > 0.5);
  compassBtn.style.setProperty('--rot', (-b).toFixed(1) + 'deg');
}
map.on('rotate', syncCompass);
map.on('pitch', syncCompass);
compassBtn.addEventListener('click', () => {
  userMoved = true;
  map.easeTo({ bearing: 0, pitch: 0, duration: 420 });
});

$('btnZoomIn').addEventListener('click', () => { userMoved = true; map.zoomIn({ duration: 260 }); });
$('btnZoomOut').addEventListener('click', () => { userMoved = true; map.zoomOut({ duration: 260 }); });

function applyTheme() {
  const next = resolveTheme();
  const changed = next !== theme;
  theme = next;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.appearance = themeMode;
  if (!changed) return;
  // same style, different palette — nothing to reload, nothing to rebuild
  applyBasemapPalette();
  repaintTheme();
  render();
  paintGrain();
  if (mode === 'them') paintBondPicker();
}

darkMedia.addEventListener('change', () => { if (themeMode === 'auto') applyTheme(); });

$('btnTheme').addEventListener('click', () => {
  themeMode = MODES[(MODES.indexOf(themeMode) + 1) % MODES.length];
  localStorage.setItem('moth.theme', themeMode);
  applyTheme();
  toast(themeMode === 'auto' ? 'Appearance follows your system'
      : themeMode === 'light' ? 'Always light' : 'Always dark');
});

$('btnShare').addEventListener('click', async () => {
  if (!state.you) { toast('Place yourself first.'); return; }
  const url = location.origin + location.pathname + '#' + encodeState();
  history.replaceState(null, '', '#' + encodeState());
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied — send it to them.');
  } catch (e) {
    toast('Copy this page’s address to share it.');
  }
});

/* Scrolling pans the map, so a scroll that lands on the panel should still pan
   it — unless the panel has its own overflow to consume first. */
{
  panel.addEventListener('wheel', e => {
    // only the list of people may swallow a scroll, and only while it has
    // somewhere left to go — everywhere else on the sheet, the map gets it
    const list = e.target.closest && e.target.closest('.hearts');
    if (list) {
      const canScroll = list.scrollHeight > list.clientHeight + 1;
      const atTop = list.scrollTop <= 0;
      const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      if (canScroll && !((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atEnd))) return;
    }
    e.preventDefault();
    map.getCanvas().dispatchEvent(new WheelEvent('wheel', {
      bubbles: false, cancelable: true,
      clientX: e.clientX, clientY: e.clientY,
      deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode,
      ctrlKey: e.ctrlKey, metaKey: e.metaKey
    }));
  }, { passive: false });
}

/* ---------------------------------------------------------------- paper */
/* A little tooth, so the map reads as something drawn on a surface rather than
   a flat fill. Generated once and tiled; far cheaper than shipping a texture. */
function paintGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 46;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  try {
    document.getElementById('grain').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
  } catch (e) {}
}
paintGrain();

/* ---------------------------------------------------------------- glass */
/* Liquid Glass carries a specular highlight that moves as the light does. There
   is no light source in a browser, so the pointer stands in for one: each glass
   surface tracks where the cursor sits over it and puts the sheen there. */
{
  const surfaces = () => document.querySelectorAll('.glass');
  addEventListener('pointermove', e => {
    surfaces().forEach(el => {
      const r = el.getBoundingClientRect();
      const near = e.clientX > r.left - 90 && e.clientX < r.right + 90 &&
                   e.clientY > r.top - 90 && e.clientY < r.bottom + 90;
      el.classList.toggle('lit', near);
      if (!near) return;
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }, { passive: true });
}

/* ---------------------------------------------------------------- boot */
/* Booting off `load` means waiting for the first painted frame — which never
   arrives in a background tab, leaving a saved map unrestored. The style being
   ready is the real precondition, so boot from that and retry until it is. */
function boot() {
  if (booted) return;
  ensureLayers();
  if (!map.getSource('arcs')) return;   // style not up yet; a later styledata retries

  const restored = loadHash() || loadLocal();
  booted = true;
  clearInterval(bootRetry);

  if (restored) {
    render();
    setMode(state.hearts.length ? 'list' : 'them');
    if (state.hearts.length) fitTo(allPoints());
    else map.flyTo({ center: [state.you.lng, state.you.lat], zoom: 5, duration: 0 });
  } else {
    setMode('you');
  }
}
map.on('load', onStyle);
bootRetry = setInterval(boot, 400);
boot();

/* keep sun labels honest over a long session */
setInterval(() => { if (state.you && mode === 'list') render(); }, 5 * 60 * 1000);
