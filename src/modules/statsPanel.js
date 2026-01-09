// modules/statsPanel.js
import Stats from 'stats.js';

export function setupStats() {
  const stats = new Stats();
  stats.showPanel(0); // 0: FPS
  stats.dom.style.position = 'fixed';
  stats.dom.style.top = '10px';
  stats.dom.style.left = '10px';
  document.body.appendChild(stats.dom);
  return stats;
}
