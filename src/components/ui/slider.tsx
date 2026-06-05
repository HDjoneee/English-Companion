import * as React from "react";
import { cn } from "../../lib/utils";

export const Slider = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn("h-2 w-full cursor-pointer accent-sky-500", className)}
      {...props}
    />
  )
);
Slider.displayName = "Slider";
