import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-sky-500 text-white shadow-soft hover:bg-sky-600 hover:scale-[1.02]",
        gradient:
          "bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-soft hover:from-sky-600 hover:to-emerald-600 hover:scale-[1.02]",
        secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 hover:scale-[1.01]",
        outline: "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        danger: "bg-red-500 text-white hover:bg-red-600 hover:scale-[1.02]",
        success: "bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-[1.02]"
      },
      size: {
        sm: "h-9 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
