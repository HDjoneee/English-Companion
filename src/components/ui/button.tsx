import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-sky-500 text-white shadow-soft hover:bg-sky-600 hover:shadow-hover hover:-translate-y-0.5",
        gradient:
          "bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-soft hover:from-sky-600 hover:to-emerald-600 hover:shadow-hover hover:-translate-y-0.5",
        secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 hover:-translate-y-0.5",
        outline: "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:-translate-y-0.5",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        danger: "bg-red-500 text-white shadow-soft hover:bg-red-600 hover:shadow-hover hover:-translate-y-0.5",
        success: "bg-emerald-500 text-white shadow-soft hover:bg-emerald-600 hover:shadow-hover hover:-translate-y-0.5"
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-11 px-6 text-base",
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
