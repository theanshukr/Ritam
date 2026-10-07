export const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;

if (!MAPTILER_API_KEY) {
  console.warn("VITE_MAPTILER_API_KEY is not defined in the environment.");
}

export const MAP_STYLES = {
  SATELLITE: {
    id: 'satellite',
    name: 'Satellite',
    url: `https://api.maptiler.com/maps/satellite-v4/{z}/{x}/{y}.jpg?key=${MAPTILER_API_KEY}`,
    attribution: '\u003ca href="https://www.maptiler.com/copyright/" target="_blank"\u003e\u0026copy; MapTiler\u003c/a\u003e \u003ca href="https://www.openstreetmap.org/copyright" target="_blank"\u003e\u0026copy; OpenStreetMap contributors\u003c/a\u003e',
    maxZoom: 22,
    maxNativeZoom: 20,
    tileSize: 512,
    zoomOffset: -1,
  },
  HYBRID: {
    id: 'hybrid',
    name: 'Hybrid',
    url: `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${MAPTILER_API_KEY}`,
    attribution: '\u003ca href="https://www.maptiler.com/copyright/" target="_blank"\u003e\u0026copy; MapTiler\u003c/a\u003e \u003ca href="https://www.openstreetmap.org/copyright" target="_blank"\u003e\u0026copy; OpenStreetMap contributors\u003c/a\u003e',
    maxZoom: 22,
    maxNativeZoom: 20,
    tileSize: 512,
    zoomOffset: -1,
  },
  STREETS: {
    id: 'streets-v2',
    name: 'Streets',
    url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`,
    attribution: '\u003ca href="https://www.maptiler.com/copyright/" target="_blank"\u003e\u0026copy; MapTiler\u003c/a\u003e \u003ca href="https://www.openstreetmap.org/copyright" target="_blank"\u003e\u0026copy; OpenStreetMap contributors\u003c/a\u003e',
    maxZoom: 22,
    maxNativeZoom: 20,
    tileSize: 512,
    zoomOffset: -1,
  }
};
