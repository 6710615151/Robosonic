// Decorative brand graphic: Thailand drawn as a network of provincial towns (approximate public
// coordinates, lat/lng), each joined to its nearest neighbours. It is not atlas data and shows no
// records; the real geographic view is /map.
const TOWNS: [string, number, number][] = [
  ["Chiang Rai", 19.91, 99.83], ["Chiang Mai", 18.79, 98.98], ["Mae Hong Son", 19.3, 97.97], ["Lampang", 18.29, 99.49],
  ["Nan", 18.78, 100.78], ["Phrae", 18.14, 100.14], ["Phayao", 19.17, 99.9], ["Uttaradit", 17.62, 100.1],
  ["Tak", 16.88, 99.13], ["Mae Sot", 16.71, 98.57], ["Sukhothai", 17.01, 99.82], ["Phitsanulok", 16.82, 100.26],
  ["Loei", 17.49, 101.72], ["Nong Khai", 17.88, 102.74], ["Udon Thani", 17.41, 102.79], ["Sakon Nakhon", 17.16, 104.15],
  ["Nakhon Phanom", 17.41, 104.78], ["Mukdahan", 16.54, 104.72], ["Khon Kaen", 16.43, 102.83], ["Kalasin", 16.43, 103.51],
  ["Roi Et", 16.05, 103.65], ["Ubon Ratchathani", 15.24, 104.85], ["Si Sa Ket", 15.12, 104.32], ["Surin", 14.88, 103.49],
  ["Buriram", 14.99, 103.1], ["Nakhon Ratchasima", 14.97, 102.1], ["Chaiyaphum", 15.81, 102.03], ["Phetchabun", 16.42, 101.16],
  ["Nakhon Sawan", 15.7, 100.14], ["Uthai Thani", 15.38, 100.02], ["Lopburi", 14.8, 100.65], ["Saraburi", 14.53, 100.91],
  ["Ayutthaya", 14.35, 100.57], ["Suphan Buri", 14.47, 100.12], ["Kanchanaburi", 14.02, 99.53], ["Sangkhla Buri", 15.15, 98.45],
  ["Bangkok", 13.76, 100.5], ["Nakhon Pathom", 13.82, 100.06], ["Ratchaburi", 13.54, 99.82], ["Chachoengsao", 13.69, 101.07],
  ["Prachin Buri", 14.05, 101.37], ["Sa Kaeo", 13.82, 102.07], ["Chon Buri", 13.36, 100.98], ["Rayong", 12.68, 101.28],
  ["Chanthaburi", 12.61, 102.1], ["Trat", 12.24, 102.51], ["Phetchaburi", 13.11, 99.94], ["Hua Hin", 12.57, 99.96],
  ["Prachuap Khiri Khan", 11.81, 99.8], ["Chumphon", 10.49, 99.18], ["Ranong", 9.96, 98.64], ["Surat Thani", 9.14, 99.33],
  ["Phang Nga", 8.45, 98.53], ["Phuket", 7.88, 98.39], ["Krabi", 8.09, 98.91], ["Nakhon Si Thammarat", 8.43, 99.96],
  ["Trang", 7.56, 99.61], ["Phatthalung", 7.62, 100.08], ["Satun", 6.62, 100.07], ["Songkhla", 7.19, 100.6],
  ["Hat Yai", 7.01, 100.47], ["Pattani", 6.87, 101.25], ["Yala", 6.54, 101.28], ["Narathiwat", 6.43, 101.82],
  ["Betong", 5.77, 101.07]
];

const K = 20;
const project = (lat: number, lng: number): [number, number] => [
  +((lng - 97.6) * K * 0.97 + 6).toFixed(1),
  +((20.3 - lat) * K + 8).toFixed(1)
];

const POINTS = TOWNS.map(([name, lat, lng]) => ({ name, xy: project(lat, lng) }));

const EDGES: [number, number][] = (() => {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  POINTS.forEach((p, i) => {
    POINTS.map((q, j) => ({ j, d: Math.hypot(p.xy[0] - q.xy[0], p.xy[1] - q.xy[1]) }))
      .filter((n) => n.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) { seen.add(key); out.push([i, j]); }
      });
  });
  return out;
})();

const BANGKOK = POINTS.find((p) => p.name === "Bangkok")!.xy;

export default function ThaiConstellation({ className }: { className?: string }) {
  return (
    <svg className={`thai-constellation${className ? ` ${className}` : ""}`} viewBox="0 0 186 310" aria-hidden="true">
      <g className="tc-edges">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={POINTS[a].xy[0]} y1={POINTS[a].xy[1]} x2={POINTS[b].xy[0]} y2={POINTS[b].xy[1]} />
        ))}
      </g>
      <g className="tc-nodes">
        {POINTS.map((p, i) => (
          <circle key={p.name} cx={p.xy[0]} cy={p.xy[1]} r={1.6} style={{ animationDelay: `${(i % 9) * 0.45}s` }} />
        ))}
      </g>
      <circle className="tc-capital-ring" cx={BANGKOK[0]} cy={BANGKOK[1]} r={6} />
      <circle className="tc-capital" cx={BANGKOK[0]} cy={BANGKOK[1]} r={2.6} />
      <text className="tc-label" x={BANGKOK[0] + 9} y={BANGKOK[1] + 3}>BKK 13.75°N 100.50°E</text>
    </svg>
  );
}
