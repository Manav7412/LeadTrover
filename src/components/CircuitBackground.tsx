// A full-screen decorative background: a glowing AI chip with circuit traces on the left and a
// neural network on the right. It is drawn as vector graphics (sharp at any size) and the
// "data flowing" animation is plain CSS (see globals.css). Purely decorative.

// Same pattern every time (no real randomness), so the picture never changes between loads.
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const CHIP = { x: 800, y: 450, size: 200 }; // centre and width of the chip

type Trace = { d: string; end: [number, number]; flow: boolean; delay: number; duration: number };

// Circuit traces: leave each side of the chip, run straight, bend 45 degrees, run straight again.
function buildTraces(): Trace[] {
  const r = rng(7);
  const traces: Trace[] = [];
  const half = CHIP.size / 2;
  const sides = [
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
  ];
  sides.forEach((side, si) => {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * (CHIP.size / (count + 1)) * 1.05;
      let x = CHIP.x + (side.dx !== 0 ? side.dx * (half + 14) : offset);
      let y = CHIP.y + (side.dy !== 0 ? side.dy * (half + 14) : offset);
      const sign = offset === 0 ? (r() > 0.5 ? 1 : -1) : Math.sign(offset);
      const l1 = 30 + r() * 90, shift = 25 + r() * 70, l2 = 90 + r() * 330;
      let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      // straight out
      x += side.dx * l1; y += side.dy * l1; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      // 45-degree bend, away from the middle
      const lat = side.dx !== 0 ? { x: 0, y: sign } : { x: sign, y: 0 };
      x += side.dx * shift + lat.x * shift; y += side.dy * shift + lat.y * shift; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      // straight on
      x += side.dx * l2; y += side.dy * l2; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      traces.push({ d, end: [x, y], flow: (i + si) % 2 === 0, delay: r() * 6, duration: 5 + r() * 5 });
    }
  });
  return traces;
}

// Neural network: columns of nodes, every node linked to every node in the next column.
function buildNetwork() {
  const layers = [4, 5, 5, 4, 3];
  const xs = [1010, 1130, 1250, 1370, 1490];
  const r = rng(21);
  const nodes = layers.map((n, li) => Array.from({ length: n }, (_, i) => ({
    x: xs[li] + (r() - 0.5) * 16,
    y: 150 + (i - (n - 1) / 2) * 70 + (li % 2) * 25 + (r() - 0.5) * 14,
    delay: r() * 5,
  })));
  const edges: { a: { x: number; y: number }; b: { x: number; y: number }; flow: boolean; delay: number }[] = [];
  nodes.forEach((layer, li) => {
    if (li === nodes.length - 1) return;
    layer.forEach((a, ai) => nodes[li + 1].forEach((b, bi) => edges.push({ a, b, flow: (ai * 3 + bi * 5 + li) % 7 === 0, delay: r() * 6 })));
  });
  return { nodes: nodes.flat(), edges };
}

const traces = buildTraces();
const { nodes, edges } = buildNetwork();
const half = CHIP.size / 2;

export default function CircuitBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_35%_50%,#0b2a45_0%,#06162a_45%,#030b16_100%)]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="bigglow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22a8c4" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#0e7490" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0b2a45" stopOpacity="0.2" />
          </radialGradient>
          <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#38bdf8" opacity="0.18" />
          </pattern>
        </defs>

        <rect width="1600" height="900" fill="url(#dots)" />

        {/* circuit traces: a dim base line, plus a bright pulse of "data" travelling along some of them */}
        <g fill="none" strokeLinejoin="round">
          {traces.map((t, i) => (
            <path key={`b${i}`} d={t.d} stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="1.5" />
          ))}
          {traces.filter((t) => t.flow).map((t, i) => (
            <path
              key={`f${i}`} d={t.d} stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)"
              className="circuit-flow" strokeDasharray="16 320"
              style={{ animationDelay: `${t.delay}s`, animationDuration: `${t.duration}s` }}
            />
          ))}
        </g>
        {traces.map((t, i) => (
          <g key={`n${i}`}>
            <circle cx={t.end[0]} cy={t.end[1]} r="5" fill="#06162a" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.5" />
            <circle cx={t.end[0]} cy={t.end[1]} r="2" fill="#67e8f9" className="node-pulse" style={{ animationDelay: `${t.delay}s` }} />
          </g>
        ))}

        {/* the chip */}
        <g>
          <circle cx={CHIP.x} cy={CHIP.y} r={half * 1.5} fill="#0891b2" opacity="0.28" filter="url(#bigglow)" className="chip-glow" />
          {Array.from({ length: 12 }).map((_, i) => {
            const o = (i - 5.5) * 15;
            return (
              <g key={i} stroke="#67e8f9" strokeOpacity="0.55" strokeWidth="2">
                <line x1={CHIP.x - half - 14} y1={CHIP.y + o} x2={CHIP.x - half} y2={CHIP.y + o} />
                <line x1={CHIP.x + half} y1={CHIP.y + o} x2={CHIP.x + half + 14} y2={CHIP.y + o} />
                <line x1={CHIP.x + o} y1={CHIP.y - half - 14} x2={CHIP.x + o} y2={CHIP.y - half} />
                <line x1={CHIP.x + o} y1={CHIP.y + half} x2={CHIP.x + o} y2={CHIP.y + half + 14} />
              </g>
            );
          })}
          <rect x={CHIP.x - half} y={CHIP.y - half} width={CHIP.size} height={CHIP.size} rx="22" fill="#071a2e" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="2" filter="url(#glow)" />
          <rect x={CHIP.x - half + 20} y={CHIP.y - half + 20} width={CHIP.size - 40} height={CHIP.size - 40} rx="14" fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.5" />
          <rect x={CHIP.x - half + 44} y={CHIP.y - half + 44} width={CHIP.size - 88} height={CHIP.size - 88} rx="10" fill="url(#core)" stroke="#67e8f9" strokeWidth="2" filter="url(#glow)" />
          <image href="/logo-icon-cyan.png" x={CHIP.x - 40} y={CHIP.y - 40} width="80" height="80" opacity="0.72" />
        </g>

        {/* neural network */}
        <g>
          {edges.map((e, i) => (
            <line key={`e${i}`} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke="#38bdf8" strokeOpacity="0.2" strokeWidth="1" />
          ))}
          {edges.filter((e) => e.flow).map((e, i) => (
            <line
              key={`ef${i}`} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke="#67e8f9" strokeWidth="2" strokeLinecap="round"
              filter="url(#glow)" className="circuit-flow" strokeDasharray="10 200" style={{ animationDelay: `${e.delay}s`, animationDuration: "4s" }}
            />
          ))}
          {nodes.map((n, i) => (
            <g key={`nn${i}`}>
              <circle cx={n.x} cy={n.y} r="11" fill="#22d3ee" opacity="0.12" className="node-pulse" style={{ animationDelay: `${n.delay}s` }} />
              <circle cx={n.x} cy={n.y} r="5.5" fill="#06162a" stroke="#67e8f9" strokeWidth="1.8" filter="url(#glow)" />
              <circle cx={n.x} cy={n.y} r="2" fill="#a5f3fc" />
            </g>
          ))}
        </g>
      </svg>

      {/* soft darkening at the edges, and behind the text, so everything stays readable */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,8,18,0.7)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[#030b16]/85 via-[#030b16]/45 to-transparent lg:w-[45%]" />
    </div>
  );
}
