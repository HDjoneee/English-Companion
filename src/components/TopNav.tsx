import { Settings, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface TopNavProps {
  onOpenSettings: () => void;
}

export function TopNav({ onOpenSettings }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-[min(1480px,calc(100vw-32px))] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[12px] font-medium leading-[1.4] text-slate-500">AIGC Speaking Lab</p>
            <h1 className="text-[28px] font-semibold leading-tight text-slate-900">英语口语陪练</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="打开设置" onClick={onOpenSettings}>
            <Settings className="h-5 w-5" />
          </Button>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm">
            HU
          </div>
        </div>
      </div>
    </nav>
  );
}
