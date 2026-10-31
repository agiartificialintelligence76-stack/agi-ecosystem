// Original, locally drawn city art. No network assets or per-frame texture work.
const sceneCaches = new WeakMap();

function cacheFor(scene) {
  let cache = sceneCaches.get(scene);
  if (!cache) {
    cache = { materials: new Map(), facade: null, signs: null };
    sceneCaches.set(scene, cache);
  }
  return cache;
}

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')];
}

function texture(scene, pc, source, name) {
  const result = new pc.Texture(scene.graphicsDevice, {
    name, width: source.width, height: source.height,
    format: pc.PIXELFORMAT_RGBA8, mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR, anisotropy: 4,
    addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT,
  });
  result.setSource(source);
  return result;
}

function facadeTextures(scene, pc) {
  const [surface, paint] = canvas(256, 1024);
  const [lights, glow] = canvas(256, 1024);
  paint.fillStyle = '#92918c';
  paint.fillRect(0, 0, 256, 1024);
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, 256, 1024);

  // A deterministic 32-storey tile: lit rooms, inset windows and service bays.
  // Wide, softly contrasting features survive mipmapping instead of shimmering.
  for (let row = 0; row < 32; row++) {
    const y = row * 32;
    paint.fillStyle = row % 8 === 0 ? '#555957' : '#727571';
    paint.fillRect(0, y, 256, row % 8 === 0 ? 5 : 2);
    paint.fillStyle = '#a6a29a';
    paint.fillRect(0, y + 30, 256, 2);
    for (let col = 0; col < 8; col++) {
      const x = col * 32;
      const variation = (row * 17 + col * 31 + row * col * 7) % 29;
      paint.fillStyle = '#666a68';
      paint.fillRect(x, y + 3, 3, 27);
      paint.fillStyle = variation < 6 ? '#747775' : '#515958';
      paint.fillRect(x + 7, y + 8, 20, 15);
      paint.fillStyle = '#aaa79d';
      paint.fillRect(x + 6, y + 24, 22, 2);

      if ((row + col * 3) % 11 === 0) {
        paint.fillStyle = '#424b4b';
        for (let slat = 0; slat < 4; slat++) {
          paint.fillRect(x + 8, y + 10 + slat * 3, 18, 2);
        }
      } else if (variation < 8) {
        glow.fillStyle = variation === 0 ? '#3f797d'
          : variation === 1 ? '#7d3f31' : '#98754a';
        glow.fillRect(x + 8, y + 9, 18, 13);
        glow.fillStyle = '#060909';
        glow.fillRect(x + 16, y + 9, 2, 13);
      }
      // Concrete weathering lives in the texture, not extra geometry.
      paint.fillStyle = 'rgba(31,36,35,0.10)';
      paint.fillRect(x + 5 + variation % 13, y + 25, 3, 7);
    }
  }
  return {
    surface: texture(scene, pc, surface, 'Skybreak / industrial facade'),
    lights: texture(scene, pc, lights, 'Skybreak / occupied windows'),
  };
}

/** Reuses one facade texture pair and a cached material per scene/base colour. */
export function buildingMaterial(scene, pc, baseColor = '#353230') {
  const cache = cacheFor(scene);
  const tint = typeof baseColor === 'string'
    ? new pc.Color().fromString(baseColor) : baseColor;
  const key = `${tint.r}:${tint.g}:${tint.b}`;
  if (cache.materials.has(key)) return cache.materials.get(key);
  cache.facade ||= facadeTextures(scene, pc);

  const material = new pc.StandardMaterial();
  material.name = `Skybreak / facade ${key}`;
  material.diffuse.copy(tint);
  material.diffuseMap = cache.facade.surface;
  material.diffuseMapTiling.set(1, 2);
  material.emissive.set(1, 1, 1);
  material.emissiveMap = cache.facade.lights;
  material.emissiveMapTiling.set(1, 2);
  material.emissiveIntensity = 0.48;
  material.useMetalness = true;
  material.metalness = 0.24;
  material.gloss = 0.22;
  material.update();
  cache.materials.set(key, material);
  return material;
}

function signArtwork(definition) {
  const [source, paint] = canvas(256, 1024);
  const { label, accent, secondary, number } = definition;
  paint.fillStyle = '#101719';
  paint.fillRect(0, 0, 256, 1024);
  const wash = paint.createLinearGradient(0, 0, 256, 1024);
  wash.addColorStop(0, '#283232');
  wash.addColorStop(0.6, '#151d20');
  wash.addColorStop(1, '#090e11');
  paint.fillStyle = wash;
  paint.fillRect(8, 8, 240, 1008);
  paint.fillStyle = accent;
  paint.fillRect(0, 0, 7, 1024);
  paint.fillRect(249, 0, 7, 1024);
  paint.fillRect(0, 0, 256, 7);
  paint.fillRect(0, 1017, 256, 7);

  paint.textAlign = 'center';
  paint.textBaseline = 'middle';
  paint.fillStyle = accent;
  paint.font = '600 19px Arial, sans-serif';
  paint.fillText('SKYBREAK CITY', 128, 48);
  paint.fillRect(28, 78, 200, 2);
  paint.font = '700 72px Arial, sans-serif';
  const pitch = Math.min(115, 658 / label.length);
  const top = 425 - (label.length - 1) * pitch / 2;
  for (let index = 0; index < label.length; index++) {
    paint.fillText(label[index], 128, top + index * pitch);
  }

  paint.fillStyle = accent;
  paint.fillRect(28, 790, 200, 4);
  paint.font = '500 17px Arial, sans-serif';
  paint.fillText(secondary, 128, 827);
  paint.font = '700 53px Arial, sans-serif';
  paint.fillText(number, 128, 892);
  // Quiet wayfinding marks and a service-code strip; baked into one panel.
  for (let index = 0; index < 28; index++) {
    const height = index % 4 === 0 ? 31 : 16;
    paint.fillRect(30 + index * 7, 954, index % 3 === 0 ? 3 : 2, height);
  }
  return source;
}

/**
 * Four opaque, single-draw panels attached to the existing tower facades.
 * Returned entities have a meaningful world-space Y for renderer.decor culling.
 * Tower indices match the deterministic 32-building loop in renderer.js.
 */
export function addCitySigns(scene, pc) {
  const cache = cacheFor(scene);
  if (cache.signs) return [...cache.signs];
  const definitions = [
    { tower: 1, y: -1, h: 25, label: 'AGI', secondary: 'HUMAN SYSTEMS', number: '01', accent: '#c78355' },
    { tower: 5, y: 57, h: 31, label: 'ORBITAL', secondary: 'TRANSIT AUTHORITY', number: '09', accent: '#709da1' },
    { tower: 12, y: 68, h: 28, label: 'SECTOR', secondary: 'ASCENT DIVISION', number: '27', accent: '#aa6656' },
    { tower: 20, y: 91, h: 28, label: 'ARCHIVE', secondary: 'MEMORY / CULTURE', number: '04', accent: '#bd8e54' },
  ];
  cache.signs = definitions.map(definition => {
    const { tower, y, h, label } = definition;
    const angle = tower * 2.399;
    const radius = 32 + tower % 5 * 12;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const width = 6 + tower % 5;
    const normalX = Math.abs(x) > Math.abs(z) ? -Math.sign(x) : 0;
    const normalZ = normalX === 0 ? -Math.sign(z) : 0;
    const material = new pc.StandardMaterial();
    material.name = `Skybreak / ${label} sign`;
    material.diffuse.set(0, 0, 0);
    material.emissive.set(1, 1, 1);
    material.emissiveMap = texture(scene, pc, signArtwork(definition), material.name);
    material.emissiveIntensity = 0.8;
    material.useLighting = false;
    material.update();

    const entity = new pc.Entity(`${label} city sign`);
    entity.addComponent('render', {
      type: 'plane', material, castShadows: false, receiveShadows: false,
    });
    scene.contentRoot.addChild(entity);
    entity.setPosition(x + normalX * (width / 2 + 0.12), y, z + normalZ * (width / 2 + 0.12));
    // PlayCanvas planes lie on XZ; turn their +Y normal toward the city centre.
    entity.setEulerAngles(90, Math.atan2(normalX, normalZ) * 180 / Math.PI, 0);
    entity.setLocalScale(width * 0.78, 1, h);
    return entity;
  });
  return [...cache.signs];
}
