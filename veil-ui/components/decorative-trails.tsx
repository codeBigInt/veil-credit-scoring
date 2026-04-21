"use client"

export default function DecorativeTrails() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Top section trails */}
      <svg
        className="absolute top-20 right-20 w-96 h-96 text-border/40"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M 100 50 Q 150 80 180 150 T 200 300" />
        <path d="M 200 40 Q 220 100 200 200" />
        <path d="M 50 150 Q 100 120 150 180 T 300 250" />
      </svg>

      {/* Floating dots - Top right */}
      <div className="absolute top-32 right-40 w-3 h-3 bg-primary rounded-full dot-float" />
      <div className="absolute top-48 right-60 w-2 h-2 bg-primary/60 rounded-full dot-pulse" />
      <div className="absolute top-64 right-32 w-2 h-2 bg-primary/40 rounded-full" />

      {/* Middle section trails */}
      <svg
        className="absolute top-1/2 left-20 w-80 h-80 text-border/40"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M 50 100 Q 100 80 150 150 Q 180 200 160 280" />
        <path d="M 300 50 Q 280 120 300 200 L 320 300" />
        <path d="M 150 50 Q 180 90 200 150" />
      </svg>

      {/* Floating dots - Left middle */}
      <div className="absolute top-1/3 left-32 w-2 h-2 bg-primary/60 rounded-full dot-drift" />
      <div className="absolute top-1/2 left-24 w-3 h-3 bg-primary rounded-full" />
      <div className="absolute top-2/3 left-40 w-2 h-2 bg-primary/40 rounded-full dot-pulse" />

      {/* Bottom section trails */}
      <svg
        className="absolute bottom-32 right-1/4 w-96 h-96 text-border/40"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M 100 50 Q 150 100 200 120 Q 250 140 280 200" />
        <path d="M 50 200 Q 80 180 120 200 Q 150 220 180 250" />
        <path d="M 200 50 L 220 150 Q 240 200 200 250" />
      </svg>

      {/* Floating dots - Bottom right */}
      <div className="absolute bottom-40 right-1/3 w-2 h-2 bg-primary rounded-full dot-pulse" />
      <div className="absolute bottom-48 right-40 w-3 h-3 bg-primary/50 rounded-full dot-float" />
      <div className="absolute bottom-32 right-48 w-2 h-2 bg-primary/30 rounded-full" />

      {/* Additional accent dots */}
      <div className="absolute top-40 left-1/3 w-1.5 h-1.5 bg-primary/80 rounded-full dot-drift" />
      <div className="absolute bottom-1/4 left-20 w-2.5 h-2.5 bg-primary rounded-full dot-pulse" />
      <div className="absolute top-1/4 right-1/3 w-2 h-2 bg-primary/50 rounded-full" />
    </div>
  )
}
