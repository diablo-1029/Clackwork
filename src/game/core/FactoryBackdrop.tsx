/** A cog outline: `teeth` square teeth around a hub, drawn in a 100 × 100 box. */
function gearPath(teeth: number): string {
  const points: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i += 1) {
    // Each tooth: up the flank, across the top, down the other flank, along the root.
    [
      [-0.26, 38],
      [-0.16, 48],
      [0.16, 48],
      [0.26, 38],
    ].forEach(([offset, radius]) => {
      const angle = i * step + offset * step * 2;
      points.push(`${(50 + Math.cos(angle) * radius).toFixed(2)},${(50 + Math.sin(angle) * radius).toFixed(2)}`);
    });
  }
  return `M${points.join("L")}Z`;
}

const GEAR_LARGE = gearPath(12);
const GEAR_SMALL = gearPath(9);

function Gear({ path, className }: { path: string; className: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`sf-gear absolute ${className}`}>
      <path d={path} fill="var(--bd-base)" stroke="var(--bd-dark)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="var(--bd-dark)" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="8" fill="var(--bd-dark)" />
    </svg>
  );
}

/**
 * The factory behind the machine: wall, windows, pipe, lamps, gears and the floor
 * with its conveyor. Decoration only. Colours come from the factory theme, and a
 * soft light behind the machine keeps targets and guides easy to read.
 */
export function FactoryBackdrop() {
  return (
    <div className="sf-backdrop pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="sf-bd-windows absolute inset-x-0 flex justify-around px-[3%]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="sf-bd-window" />
        ))}
      </div>

      <Gear path={GEAR_LARGE} className="sf-bd-gear-a" />
      <Gear path={GEAR_SMALL} className="sf-gear-reverse sf-bd-gear-b" />
      <Gear path={GEAR_SMALL} className="sf-bd-gear-c" />

      <div className="sf-bd-pipe absolute inset-x-0" />
      {["left-[18%]", "right-[18%]"].map((side) => (
        <div key={side} className={`sf-bd-lamp absolute ${side}`}>
          <span className="sf-bd-lamp-glow" />
        </div>
      ))}

      <div className="sf-bd-spot absolute inset-x-0" />

      <div className="sf-bd-floor absolute inset-x-0 bottom-0">
        <div className="sf-belt absolute inset-x-0 top-0 h-4" />
      </div>
    </div>
  );
}
