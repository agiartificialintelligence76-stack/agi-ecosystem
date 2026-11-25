// Live Broadcast 3D Avatar Stage for Clank Tank (agi1.app/clanktrade).
// Reuses the unmodified CC BY-SA 4.0 Vladcat VRM model in /games/trenchingsimulator/clank/vladcat.vrm
// with broadcast studio rim lighting, subtle speaking animation, and automatic pause when offscreen/hidden.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function mountTankAvatarStage(host) {
  let dead = false;
  let visible = true;
  let raf = 0;
  let last = 0;
  let speaking = true;
  let model = null;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.01, 30);

  // Studio broadcast 3-point lighting: cool key, Clank lavender rim, electric cyan fill
  scene.add(new THREE.AmbientLight('#f4f1ff', 1.15));
  const key = new THREE.DirectionalLight('#ffffff', 2.0);
  key.position.set(-2.5, 4.5, 4.2);
  scene.add(key);
  const rimLav = new THREE.DirectionalLight('#c4b5fd', 1.9);
  rimLav.position.set(2.8, 3.2, -2.5);
  scene.add(rimLav);
  const fillCyan = new THREE.DirectionalLight('#17a5f8', 0.95);
  fillCyan.position.set(3.2, 1.5, 2.0);
  scene.add(fillCyan);

  const pointer = new THREE.Vector2();
  const smooth = new THREE.Vector2();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (model) renderer.render(scene, camera);
  });
  resize.observe(host);

  const onPointer = (e) => {
    if (reduced.matches || !visible) return;
    const r = host.getBoundingClientRect();
    pointer.set(
      THREE.MathUtils.clamp((e.clientX - r.left - r.width / 2) / (window.innerWidth * 0.35), -1, 1),
      THREE.MathUtils.clamp((e.clientY - r.top - r.height * 0.4) / (window.innerHeight * 0.35), -1, 1),
    );
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let head = null;
  let headRest = null;
  let chest = null;
  let chestScale = null;
  const eyes = [];
  const blink = [];
  const mouth = [];
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();

  function draw(now) {
    raf = 0;
    if (dead || !visible || document.hidden || !model) return;
    if (now - last > 1000 / 30) {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      smooth.lerp(pointer, 1 - Math.exp(-delta / 0.08));
      const t = now / 1000;
      if (!reduced.matches) {
        const talkNod = speaking ? Math.sin(t * 5.2) * 0.025 : 0;
        const talkTurn = speaking ? Math.sin(t * 2.1) * 0.045 : 0;
        if (head && headRest) {
          head.quaternion.copy(headRest).multiply(
            rotation.setFromEuler(euler.set(smooth.y * 0.12 + talkNod, smooth.x * 0.22 + talkTurn, 0)),
          );
        }
        for (const eye of eyes) {
          eye.node.quaternion.copy(eye.rest).multiply(
            rotation.setFromEuler(euler.set(smooth.y * 0.07, smooth.x * 0.11, 0)),
          );
        }
        if (chest && chestScale) {
          chest.scale.copy(chestScale).multiplyScalar(1 + 0.012 * (1 - Math.cos((t / 4.2) * Math.PI * 2)) / 2);
        }
        const phase = (t % 4.1) - 2;
        const blinkVal = phase >= 0 && phase < 0.16 ? Math.sin((phase / 0.16) * Math.PI) : 0;
        for (const b of blink) b.node.morphTargetInfluences[b.index] = blinkVal * b.weight;
        const talkVal = speaking ? Math.max(0, Math.sin(t * 11.5) * 0.45 + Math.sin(t * 7.3) * 0.35) : 0;
        for (const m of mouth) m.node.morphTargetInfluences[m.index] = talkVal * m.weight;
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(draw);
  }

  function resume() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (visible && !document.hidden && !dead && model) raf = requestAnimationFrame(draw);
  }

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    resume();
  });
  intersection.observe(host);
  document.addEventListener('visibilitychange', resume);

  const api = {
    setSpeaking(active) {
      speaking = Boolean(active);
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', resume);
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  try {
    const gltf = await new GLTFLoader().loadAsync('/games/trenchingsimulator/clank/vladcat.vrm');
    if (dead) return api;
    model = gltf.scene;
    scene.add(model);
    model.updateMatrixWorld(true);
    const vrm = gltf.parser.json.extensions?.VRMC_vrm;
    const bone = async (name) => {
      const n = vrm?.humanoid?.humanBones?.[name]?.node;
      return n === undefined ? null : gltf.parser.getDependency('node', n);
    };
    head = await bone('head');
    headRest = head?.quaternion.clone() || null;
    chest = await bone('upperChest');
    chestScale = chest?.scale.clone() || null;
    for (const name of ['leftEye', 'rightEye']) {
      const node = await bone(name);
      if (node) eyes.push({ node, rest: node.quaternion.clone() });
    }
    for (const b of vrm?.expressions?.preset?.blink?.morphTargetBinds || []) {
      const node = await gltf.parser.getDependency('node', b.node);
      if (node?.morphTargetInfluences) blink.push({ ...b, node });
    }
    for (const b of vrm?.expressions?.preset?.aa?.morphTargetBinds || []) {
      const node = await gltf.parser.getDependency('node', b.node);
      if (node?.morphTargetInfluences) mouth.push({ ...b, node });
    }
    const point = head?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, 1.45, 0);
    for (const name of ['leftUpperArm', 'rightUpperArm']) {
      const arm = await bone(name);
      if (!arm) continue;
      const sign = Math.sign(arm.getWorldPosition(new THREE.Vector3()).x - point.x) || 1;
      const parent = arm.parent.getWorldQuaternion(new THREE.Quaternion());
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sign * 1.15);
      arm.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
    }
    camera.position.set(point.x, point.y + 0.04, point.z + 1.08);
    camera.lookAt(point.x, point.y + 0.02, point.z);
    camera.updateMatrixWorld();
    host.dataset.ready = 'true';
    resume();
  } catch {
    host.dataset.failed = 'true';
  }
  return api;
}
