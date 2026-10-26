// Separate bundle (assets/js/scene.js): three.js only loads on pages with the 3D model.
import { createTowers } from './towers3d.js';

window.AxisScene = { createTowers };
