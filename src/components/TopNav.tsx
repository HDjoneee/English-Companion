import { Settings, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface TopNavProps {
  onOpenSettings: () => void;
}

export function TopNav({ onOpenSettings }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl shadow-soft">
      <div className="mx-auto flex h-16 w-[min(1480px,calc(100vw-32px))] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 via-sky-400 to-emerald-500 text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">AIGC Speaking Lab</p>
            <h1 className="text-xl font-bold leading-tight text-slate-900">英语口语陪练</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="打开设置" onClick={onOpenSettings}>
            <Settings className="h-5 w-5" />
          </Button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white shadow-soft">
            HU
          </div>
        </div>
      </div>
    </nav>
  );
}
