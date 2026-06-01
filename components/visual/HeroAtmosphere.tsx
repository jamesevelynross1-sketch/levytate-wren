export function HeroAtmosphere() {
  return (
    <div className="hero-atmosphere" aria-hidden="true">
      <div className="hero-atmosphere__wash" />
      <svg
        className="hero-atmosphere__grid"
        viewBox="0 0 1200 720"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="signalLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f7f2e8" stopOpacity="0" />
            <stop offset="0.44" stopColor="#f7f2e8" stopOpacity="0.16" />
            <stop offset="0.7" stopColor="#2c8c83" stopOpacity="0.22" />
            <stop offset="1" stopColor="#2c8c83" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="hero-atmosphere__mesh">
          {Array.from({ length: 9 }).map((_, index) => (
            <path
              key={`h-${index}`}
              d={`M80 ${130 + index * 56} H1120`}
            />
          ))}
          {Array.from({ length: 8 }).map((_, index) => (
            <path
              key={`v-${index}`}
              d={`M${160 + index * 126} 92 V648`}
            />
          ))}
        </g>
        <g className="hero-atmosphere__signals">
          <path d="M-80 518 C 190 408, 308 498, 510 406 S 806 278, 1280 332" />
          <path d="M-80 374 C 174 284, 310 314, 496 272 S 768 176, 1280 212" />
          <path d="M-80 610 C 188 526, 326 590, 536 520 S 828 430, 1280 458" />
        </g>
      </svg>
    </div>
  );
}
