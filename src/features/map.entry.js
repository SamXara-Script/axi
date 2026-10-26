// Separate bundle (assets/js/map.js): Leaflet only loads on pages with a map.
import { initMap } from './map.js';

window.AxisMap = { initMap };
