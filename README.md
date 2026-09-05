# Map of the Heart 🧭

A quiet map for the people you love.

Drop a pin on yourself, drop a pin on someone far away, and a great-circle line
is drawn between you — with a slow pulse travelling along it, over and over.

## What it does

- **Place yourself** — search, use your location, or just tap the map.
- **Place someone you love** — give them a name and a place.
- **A line connects you** — a true great-circle arc, animated as it draws.
- **It tells you the distance** in km and miles, the compass direction they lie in,
  and whether the sun is up where they are (computed from solar position, no API).
- **Add as many people as you like.** Every one gets their own arc and pulse.
- **Share it** — the copy-link button encodes the whole map into the URL.
- Light and dark, and it remembers where you left it.

## Stack

Static site. No build step, no framework, no API keys.

- [MapLibre GL JS](https://maplibre.org/) for the map
- [CARTO](https://carto.com/basemaps/) Positron / Dark Matter basemaps
- [Nominatim](https://nominatim.openstreetmap.org/) for search, © OpenStreetMap contributors

## Local

```bash
python3 -m http.server 4337
```

Then open http://localhost:4337
