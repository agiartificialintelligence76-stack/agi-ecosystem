// Vlad cat © Clanktrade, CC BY-SA 4.0. The original model is kept unmodified.
// This lightweight local renderer pauses whenever the hero is out of view.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function mountClankModel(host) {
  let dead = false, visible = true, raf = 0, last = 0, model;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 30);
  scene.add(new THREE.AmbientLight('#ffffff', 1.3));
  for (const [position, intensity] of [[[-3, 5, 4], 2], [[3, 2, 2], .8], [[0, 4, -3], 1.5]]) {
    const light = new THREE.DirectionalLight('#ffffff', intensity); light.position.set(...position); scene.add(light);
  }
  const pointer = new THREE.Vector2(); const smooth = new THREE.Vector2();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (model) renderer.render(scene, camera);
  });
  resize.observe(host);
  const onPointer = (e) => { if (reduced.matches || !visible) return;
    const r = host.getBoundingClientRect(); pointer.set(THREE.MathUtils.clamp((e.clientX-r.left-r.width/2)/(innerWidth*.35),-1,1), THREE.MathUtils.clamp((e.clientY-r.top-r.height*.4)/(innerHeight*.35),-1,1));
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  let head, headRest, chest, chestScale, eyes = [], blink = [];
  const rotation = new THREE.Quaternion(); const euler = new THREE.Euler();
  function draw(now) {
    raf = 0; if (dead || !visible || document.hidden || !model) return;
    if (now-last > 1000/30) {
      const delta = Math.min((now-last)/1000, .1); last = now;
      smooth.lerp(pointer, 1-Math.exp(-delta/.07));
      const t = now/1000;
      if (!reduced.matches) {
        if (head) head.quaternion.copy(headRest).multiply(rotation.setFromEuler(euler.set(smooth.y*.14, smooth.x*.26, 0)));
        for (const eye of eyes) eye.node.quaternion.copy(eye.rest).multiply(rotation.setFromEuler(euler.set(smooth.y*.08, smooth.x*.13, 0)));
        if (chest) chest.scale.copy(chestScale).multiplyScalar(1+.01*(1-Math.cos(t/4.6*Math.PI*2))/2);
        const phase=t%4.2-2, value=phase>=0 && phase<.18 ? Math.sin(phase/.18*Math.PI):0;
        for (const b of blink) b.node.morphTargetInfluences[b.index]=value*b.weight;
      }
      renderer.render(scene,camera);
    }
    raf=requestAnimationFrame(draw);
  }
  function resume() { if (raf) cancelAnimationFrame(raf); raf=0; if (visible&&!document.hidden&&!dead&&model) raf=requestAnimationFrame(draw); }
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resume();});intersection.observe(host);
  document.addEventListener('visibilitychange',resume);
  const dispose = () => {
    dead=true; cancelAnimationFrame(raf); resize.disconnect(); intersection.disconnect();
    window.removeEventListener('pointermove',onPointer); document.removeEventListener('visibilitychange',resume);
    scene.traverse(o=>{o.geometry?.dispose(); for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]) { for(const v of Object.values(m)) if(v?.isTexture)v.dispose();m.dispose();} });
    renderer.dispose(); renderer.domElement.remove();
  };
  try {
    const gltf=await new GLTFLoader().loadAsync('/games/trenchingsimulator/clank/vladcat.vrm');
    if (dead) return dispose;
    model=gltf.scene;scene.add(model); model.updateMatrixWorld(true);
    const vrm=gltf.parser.json.extensions.VRMC_vrm;
    const bone=async name=>{const n=vrm.humanoid.humanBones[name]?.node;return n===undefined?null:await gltf.parser.getDependency('node',n);};
    head=await bone('head');headRest=head?.quaternion.clone();chest=await bone('upperChest');chestScale=chest?.scale.clone();
    for(const name of ['leftEye','rightEye']) {const node=await bone(name);if(node)eyes.push({node,rest:node.quaternion.clone()});}
    for(const b of vrm.expressions?.preset?.blink?.morphTargetBinds||[]) {const node=await gltf.parser.getDependency('node',b.node); if(node?.morphTargetInfluences)blink.push({...b,node});}
    const point=head?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(0,1.45,0);
    for(const name of ['leftUpperArm','rightUpperArm']) {
      const arm=await bone(name);if(!arm)continue;
      const sign=Math.sign(arm.getWorldPosition(new THREE.Vector3()).x-point.x)||1;
      const parent=arm.parent.getWorldQuaternion(new THREE.Quaternion());
      const turn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-sign*1.18);
      arm.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
    }
    camera.position.set(point.x,point.y+.06,point.z+1.15);camera.lookAt(point.x,point.y+.04,point.z);camera.updateMatrixWorld();
    host.dataset.ready='true'; resume();
  } catch { host.dataset.failed='true'; }
  return dispose;
}
