// Stage effects: floating hearts for AGI-1's reactions, in the site's one accent color.
// Drawn in code, so there are no image files to download.
import * as THREE from 'three';

const HEART_COLORS = [0xff5c93, 0xe0457b, 0xff9cc0];
// Pop mode (2026-09-27): her stage is pink, so hearts in white, Pop mode's violet and honey show on it
export const POP_HEART_COLORS = [0xffffff, 0x6b3bff, 0xffc933];

// A white heart drawn on a small canvas. Each sprite tints it with its own color.
function makeHeartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.beginPath();
  x.moveTo(32, 57);
  x.bezierCurveTo(8, 40, 2, 22, 15, 12);
  x.bezierCurveTo(24, 5, 32, 12, 32, 20);
  x.bezierCurveTo(32, 12, 40, 5, 49, 12);
  x.bezierCurveTo(62, 22, 56, 40, 32, 57);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEffects(scene, { mobile = false } = {}) {
  const heartTex = makeHeartTexture();
  const hearts = [];
  let colors = HEART_COLORS;
  // (the stage calls this when the look changes: null = the site's pinks)
  const setHeartColors = (list) => { colors = Array.isArray(list) && list.length ? list : HEART_COLORS; };

  // Spawn `count` hearts around a world position. They pop in, float up, wobble and fade.
  function spawnHearts(origin, { count = 10, spread = 0.35, size = 0.1, rise = 0.8 } = {}) {
    const n = mobile ? Math.ceil(count * 0.6) : count;
    for (let i = 0; i < n; i++) {
      const material = new THREE.SpriteMaterial({
        map: heartTex, color: colors[i % colors.length],
        transparent: true, depthWrite: false, opacity: 0,
      });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 2;                     // in front of AGI-1 in 2D too (her flat layers draw at 1.x)
      sprite.position.set(
        origin.x + (Math.random() - 0.5) * spread,
        origin.y + (Math.random() - 0.3) * spread * 0.6,
        origin.z + (Math.random() - 0.5) * spread * 0.5 + 0.12,
      );
      sprite.scale.setScalar(0.001);
      scene.add(sprite);
      hearts.push({
        sprite, material,
        size: size * (0.7 + Math.random() * 0.6),
        age: -Math.random() * 0.25,               // small random delay so they don't all appear at once
        life: 1.1 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 0.3,
        vy: rise * (0.6 + Math.random() * 0.6),
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }

  function update(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.age += dt;
      if (h.age < 0) continue;
      const p = h.age / h.life;
      if (p >= 1) {
        scene.remove(h.sprite);
        h.material.dispose();
        hearts.splice(i, 1);
        continue;
      }
      const pop = Math.min(1, h.age / 0.18);                       // quick pop-in
      h.sprite.scale.setScalar(h.size * (pop < 1 ? pop * 1.25 : 1));
      h.sprite.position.x += (h.vx + Math.sin(h.age * 5 + h.wobble) * 0.12) * dt;
      h.sprite.position.y += h.vy * dt;
      h.material.opacity = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;     // fade out at the end
      h.material.rotation = Math.sin(h.age * 4 + h.wobble) * 0.25;
    }
  }

  return { spawnHearts, update, setHeartColors };
}
