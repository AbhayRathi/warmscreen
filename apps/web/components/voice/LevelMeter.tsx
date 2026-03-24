'use client';

interface LevelMeterProps {
  level: number; // 0–1
}

export default function LevelMeter({ level }: LevelMeterProps) {
  const pct = Math.min(Math.max(level * 100, 0), 100);

  return (
    <div
      className="h-2 w-full rounded-full bg-gray-200 overflow-hidden"
      role="meter"
      aria-label="Audio level"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-75 bg-green-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
