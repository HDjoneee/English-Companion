import { cn } from "../lib/utils";

interface WaveformProps {
  active: boolean;
  danger?: boolean;
  compact?: boolean;
}

export function Waveform({ active, danger, compact }: WaveformProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1",
        compact ? "h-6 w-16" : "h-16 w-28 rounded-lg bg-slate-900/90"
      )}
      aria-hidden="true"
    >
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "block w-1 rounded-full",
            compact ? "h-4" : "h-9",
            danger ? "bg-red-400" : "bg-emerald-400",
            active ? "animate-wave-flow opacity-90" : "scale-y-[0.3] opacity-40"
          )}
          style={{ animationDelay: `${index * 42}ms` }}
        />
      ))}
    </div>
  );
}
