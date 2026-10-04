/**
 * A row of small markers for machines that want more than one action this time
 * (two cuts, two strips of tape, two stamps): filled once done, a ring for the
 * one in progress. Drawn inside the machine's own SVG, in stage units.
 */
export function StepPips({ total, done, x, y }: { total: number; done: number; x: number; y: number }) {
  const gap = 18;
  return (
    <g transform={`translate(${x - ((total - 1) * gap) / 2} ${y})`} style={{ pointerEvents: "none" }} aria-hidden>
      {Array.from({ length: total }, (_, index) => {
        const finished = index < done;
        const current = index === done;
        return (
          <g key={index} transform={`translate(${index * gap} 0)`}>
            <circle
              r="6"
              fill={finished ? "var(--fx-accent)" : "#ffffff"}
              fillOpacity={finished ? 1 : 0.5}
              stroke={current ? "var(--fx-accent)" : "var(--fx-machine-dark)"}
              strokeWidth={current ? 3 : 1.5}
            />
            {finished && <path d="M -2.6 0 L -0.8 2 L 2.8 -2" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        );
      })}
    </g>
  );
}
