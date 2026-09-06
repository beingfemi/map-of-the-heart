/* Map of the Heart — a minimal map for the people you love. */

/* ---------------------------------------------------------------- theme */
/* One detailed basemap, recoloured per theme. CARTO's Voyager carries the full
   OpenMapTiles detail — landcover, water, roads by class, buildings, place names —
   and its layer ids are predictable enough to repaint into a macOS Maps palette.
   Repainting beats swapping styles: the theme toggle stays instant and nothing
   has to be rebuilt afterwards. */
const BASE_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const BASEMAP = {
  light: {
    land: '#f7f4ef', water: '#a8d4f0', waterShadow: '#93c4e4', waterway: '#a8d4f0',
    green: [205, 226, 188], park: '#cfe4bd',
    residential: '#f0ece4', building: '#e8e2d7', buildingTop: '#ede8df',
    motFill: '#ffd28a', motCase: '#eeb862',
    trunkFill: '#ffdfae', trunkCase: '#ecc489',
    priFill: '#ffffff', priCase: '#e3ddd0',
    secFill: '#ffffff', secCase: '#e6e0d3',
    minorFill: '#ffffff', minorCase: '#eae4d8',
    path: '#dbd4c5', rail: '#d2cbbd', aeroway: '#e4ded1',
    boundaryCountry: '#b6ada0', boundaryState: '#d3ccbf',
    placeText: '#3d3d42', roadText: '#7a7a80', waterText: '#6d97b8', poiText: '#6a6a70',
    halo: '#ffffff'
  },
  dark: {
    land: '#17181b', water: '#0e2233', waterShadow: '#0b1b29', waterway: '#12293d',
    green: [30, 44, 32], park: '#1c2a1e',
    residential: '#1c1d21', building: '#232529', buildingTop: '#272a2f',
    motFill: '#4c4234', motCase: '#35302a',
    trunkFill: '#423a30', trunkCase: '#2f2b26',
    priFill: '#34373d', priCase: '#232529',
    secFill: '#303339', secCase: '#212327',
    minorFill: '#2b2e33', minorCase: '#1e2024',
    path: '#2c2f34', rail: '#2a2d32', aeroway: '#26292e',
    boundaryCountry: '#454951', boundaryState: '#33363c',
    placeText: '#b6bac1', roadText: '#8b9099', waterText: '#5f7f9c', poiText: '#8b9099',
    halo: '#0d0e10'
  }
};

function preferredTheme() {
  const saved = localStorage.getItem('moth.theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
let theme = preferredTheme();
document.documentElement.dataset.theme = theme;

const COLORS = {
  light: { line: '#e0245e', glow: '#ff5c8a', pulse: '#e0245e' },
  dark:  { line: '#ff5c8a', glow: '#ff5c8a', pulse: '#ffa3c0' }
};
const ink = () => COLORS[theme];

/* ---------------------------------------------------------------- state */
const state = { you: null, hearts: [] };
let nextId = 1;
let booted = false;   // nothing is written to storage until the saved map has been restored
let bootRetry = null;

function serialize() {
  return {
    you: state.you && { lng: r5(state.you.lng), lat: r5(state.you.lat), label: state.you.label },
    hearts: state.hearts.map(h => ({ lng: r5(h.lng), lat: r5(h.lat), label: h.label, name: h.name }))
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
  state.hearts.forEach(h => { h.id = nextId++; h.p = 1; });
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
  dragRotate: false,
  renderWorldCopies: false,   // one Earth, not a tiled wallpaper of them
  maxZoom: 18
});
map.touchZoomRotate.disableRotation();

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
      map.easeTo({ zoom: map.getZoom() - e.deltaY * step * 0.012, around, duration: 0 });
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

/* Voyager fades greenery in with zoom by ramping the colour's alpha, so a flat
   colour would slam it on at world view. Rebuild the ramp in our own hue. */
function greenRamp(rgb) {
  const a = o => 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + o + ')';
  return { stops: [[8, a(0.2)], [9, a(0.25)], [11, a(0.35)], [13, a(0.45)], [15, a(0.6)]] };
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
      return;
    }

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

  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', c.land);
  return true;
}

const EMPTY = { type: 'FeatureCollection', features: [] };

function installLayers() {
  if (!map.getSource('arcs')) map.addSource('arcs', { type: 'geojson', data: EMPTY });
  if (!map.getSource('pulses')) map.addSource('pulses', { type: 'geojson', data: EMPTY });

  if (!map.getLayer('arc-glow')) {
    map.addLayer({
      id: 'arc-glow', type: 'line', source: 'arcs',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ink().glow, 'line-width': 8, 'line-opacity': 0.16, 'line-blur': 5 }
    });
  }
  if (!map.getLayer('arc-line')) {
    map.addLayer({
      id: 'arc-line', type: 'line', source: 'arcs',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ink().line,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 6, 2.2, 12, 3],
        'line-opacity': 0.9
      }
    });
  }
  if (!map.getLayer('pulse-halo')) {
    map.addLayer({
      id: 'pulse-halo', type: 'circle', source: 'pulses',
      paint: { 'circle-color': ink().pulse, 'circle-radius': 11, 'circle-opacity': ['*', ['get', 'o'], 0.16], 'circle-blur': 0.8 }
    });
  }
  if (!map.getLayer('pulse-core')) {
    map.addLayer({
      id: 'pulse-core', type: 'circle', source: 'pulses',
      paint: {
        'circle-color': ink().pulse,
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
  map.setPaintProperty('arc-glow', 'line-color', ink().glow);
  map.setPaintProperty('arc-line', 'line-color', ink().line);
  map.setPaintProperty('pulse-halo', 'circle-color', ink().pulse);
  map.setPaintProperty('pulse-core', 'circle-color', ink().pulse);
}

/* setStyle drops every custom source and layer, and `style.load` is not
   dependable across style swaps — so watch styledata and rebuild when they're gone. */
let painted = false;
function ensureLayers() {
  if (!map.style) return;
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
  el.innerHTML =
    '<svg viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M15 37c0-6 11-13.2 11-22A11 11 0 0 0 4 15c0 8.8 11 16 11 22Z" fill="' + ink().line + '"/>' +
      '<g class="pulse"><path d="M15 20.2s-5-3.1-5-6.5a2.9 2.9 0 0 1 5-1.9 2.9 2.9 0 0 1 5 1.9c0 3.4-5 6.5-5 6.5Z" fill="#fff"/></g>' +
    '</svg>' +
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
      mk = new maplibregl.Marker({ element: makeHeartEl(h), anchor: 'bottom' }).setLngLat([h.lng, h.lat]).addTo(map);
      heartMarkers.set(h.id, mk);
    } else {
      mk.setLngLat([h.lng, h.lat]);
      mk.getElement().querySelector('.mk-label').textContent = h.name || h.label;
      mk.getElement().querySelector('path').setAttribute('fill', ink().line);
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
    arcFeatures.push({
      type: 'Feature', properties: {},
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
          type: 'Feature', properties: { o: fade },
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

function setMode(next) {
  mode = next;
  stepYou.hidden = next !== 'you';
  stepThem.hidden = next !== 'them';
  stepList.hidden = next !== 'list';
  $('themCancel').hidden = !state.hearts.length;
  map.getCanvas().style.cursor = (next === 'you' || next === 'them') ? 'crosshair' : '';
  if (next === 'them') setTimeout(() => themName.focus(), 60);
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
    homeSun.textContent = skyWord(state.you.lat, state.you.lng, true);
  }

  heartsList.innerHTML = '';
  state.hearts.forEach((h, i) => {
    const km = distanceKm([state.you.lng, state.you.lat], [h.lng, h.lat]);
    const d = fmtDistance(km);
    const li = document.createElement('li');
    li.style.animationDelay = (i * 45) + 'ms';
    li.innerHTML =
      '<span class="h-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8.5-5.3-8.5-11.1A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.5 3.3C20.5 15.7 12 21 12 21Z"/></svg></span>' +
      '<span class="h-body"><span class="h-name"></span><span class="h-meta"></span><span class="h-sky"></span></span>' +
      '<span class="h-dist"><b></b>' + d.mi + '</span>' +
      '<button class="h-remove" title="Remove" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
    li.querySelector('.h-name').textContent = h.name || h.label;
    li.querySelector('.h-meta').textContent = h.label;
    li.querySelector('.h-sky').textContent =
      compass(bearing([state.you.lng, state.you.lat], [h.lng, h.lat])) + ' · ' + skyWord(h.lat, h.lng);
    li.querySelector('.h-dist b').textContent = d.km;
    li.addEventListener('click', () => focusHeart(h.id));
    li.querySelector('.h-remove').addEventListener('click', e => {
      e.stopPropagation();
      state.hearts = state.hearts.filter(x => x.id !== h.id);
      save(); render();
      if (!state.hearts.length) setMode('them');
    });
    heartsList.appendChild(li);
  });

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

  // Padding has to leave a usable box behind, or fitBounds asks for a zoom
  // the map cannot reach and lands somewhere arbitrary. Cap it against the viewport.
  const panelH = panel.getBoundingClientRect().height;
  const pad = {
    top: Math.min(96, h * 0.14),
    bottom: narrow ? Math.min(panelH + 16, h * 0.42) : Math.min(72, h * 0.12),
    left: narrow ? 22 : Math.min(380, w * 0.34),
    right: narrow ? 22 : Math.min(64, w * 0.08)
  };
  const opts = { padding: pad, maxZoom: 9, duration: 1400, essential: true };

  // Mercator will not let the viewport be taller than the world, which puts a hard
  // floor on how far out a tall, narrow screen can zoom. When the span needs more
  // room than that floor allows, no framing exists — centre on home instead and let
  // the list carry the rest.
  const floor = Math.max(Math.log2(w / 512), Math.log2(h / 512));
  const cam = map.cameraForBounds(bounds, { padding: pad, maxZoom: 9 });
  if (state.you && cam && cam.zoom < floor) {
    map.easeTo({
      center: [state.you.lng, state.you.lat],
      zoom: floor,
      offset: [0, (pad.top - pad.bottom) / 2],
      duration: 1400,
      essential: true
    });
    return;
  }

  map.fitBounds(bounds, opts);
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
$('btnAdd').addEventListener('click', () => { themName.value = ''; themSearch.value = ''; setMode('them'); });
$('themCancel').addEventListener('click', () => { if (state.hearts.length) setMode('list'); });
$('btnMoveHome').addEventListener('click', () => { youSearch.value = ''; setMode('you'); });

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

$('btnZoomIn').addEventListener('click', () => { userMoved = true; map.zoomIn({ duration: 260 }); });
$('btnZoomOut').addEventListener('click', () => { userMoved = true; map.zoomOut({ duration: 260 }); });

$('btnTheme').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('moth.theme', theme);
  // same style, different palette — nothing to reload, nothing to rebuild
  applyBasemapPalette();
  repaintTheme();
  syncMarkers();
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
