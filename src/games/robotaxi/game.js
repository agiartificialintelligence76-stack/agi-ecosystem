// ROBOTAXI RUSH: a placeholder while the game is being built (replaced by the real game).
import './style.css';
import { createShell } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';

const shell = createShell({
  game: 'robotaxi', name: "ROBOTAXI RUSH", root: document.getElementById('ak-root'),
  howTo: { steps: [['Coming together', 'This game is being built right now.']], touch: [['Tap', 'Play']], keys: [['Space', 'Play']] },
  onRestart: () => start(), onQuit: () => {},
});
const canvas = document.createElement('canvas');
shell.stage.append(canvas);
const view = fitCanvas(canvas);
let t = 0;
const score = shell.chip('Score', 0);
function start() { shell.started(); t = 0; setTimeout(() => shell.over({ score: Math.round(Math.random() * 5000), stats: [['Time', '0:42'], ['Best combo', '×7']], line: 'not bad, cutie. again? 💜' }), 1500); }
shell.title({ logo: ["ROBOTAXI", {"text": "RUSH", "tone": "accent"}], tagline: "Neon highway. No brakes. Chain the near misses.", best: shell.store.best(), onPlay: start });
createLoop({
  update(dt) { t += dt; if (shell.state === 'play') score.set(Math.floor(t * 100)); },
  render() {
    const ctx = view.begin();
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, '#120726'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#ffc933';
    ctx.beginPath(); ctx.arc(view.w / 2 + Math.cos(t) * 80, view.h / 2 + Math.sin(t * 1.3) * 80, 24, 0, Math.PI * 2); ctx.fill();
  },
}).start();
