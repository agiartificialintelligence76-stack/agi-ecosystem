const cues = {
  echo: [['CLAP / WEST', [0.08, 0.42, 0.78]]],
  bell: [['BELL / RING', [0.17]]],
  collar: [['COLLAR / JINGLE', [0.11, 0.25, 0.4]]],
  ident: [['IDENT / 4', [0.1, 0.32, 0.54, 0.76]]],
  three: [['REEL / 3', [0.1, 0.32, 0.54]]],
  fourth: [
    ['REEL', [0.1, 0.32, 0.54]],
    ['ROOM', [0.76]],
  ],
  gap: [['RELAY', [0.1, 0.82]]],
  thunder: [['DESK MIX', [0.14, 0.18, 0.25, 0.29, 0.33, 0.39, 0.45, 0.57]]],
  sneeze: [
    ['TAKE A', [0.12, 0.31, 0.71]],
    ['TAKE B', [0.12, 0.31, 0.71]],
  ],
  choir: [
    ['WINDOW A', [0.14, 0.2, 0.31, 0.61, 0.73, 0.79]],
    ['WINDOW B', [0.14, 0.23, 0.32, 0.41, 0.5, 0.59, 0.68, 0.77]],
  ],
  rain: [['GUTTER', [0.12, 0.22, 0.4, 0.69, 0.82]]],
};
export function wave(item) {
  const plot = cues[item.sound];
  if (!plot) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'radio-wave';
  canvas.width = 660;
  canvas.height = plot.length * 37 + 10;
  canvas.setAttribute('aria-hidden', 'true');
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#413446';
  g.fillRect(0, 0, canvas.width, canvas.height);
  plot.forEach(([name, beats], i) => {
    const base = 23 + i * 37;
    g.font = 'bold 13px monospace';
    g.fillStyle = '#f4debb';
    g.fillText(name, 9, base + 4);
    g.strokeStyle = '#967e86';
    g.beginPath();
    g.moveTo(132, base);
    g.lineTo(650, base);
    g.stroke();
    g.beginPath();
    for (let x = 0; x < 512; x += 2) {
      const u = x / 512;
      const envelope = beats.reduce((m, b) => {
        const delta = u - b;
        return (
          m +
          (delta >= 0 ? Math.exp(-delta * 33) : Math.exp(delta * 160)) * (item.sound === 'echo' ? 1 - b * 0.7 : 1)
        );
      }, 0);
      const y = base + Math.sin(x * 0.86) * Math.cos(x * 0.13) * Math.min(1, envelope) * 15;
      if (x) g.lineTo(134 + x, y);
      else g.moveTo(134 + x, y);
    }
    g.strokeStyle = i ? '#c8a3ce' : '#f1ca85';
    g.lineWidth = 2;
    g.stroke();
  });
  return canvas;
}
