import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        warm: "border-transparent bg-accent/20 text-accent-foreground",
        // Round 22 — tone extension mirroring mobile's Chip primitive
        // (apps/mobile/components/ui/chip.tsx). Sage uses existing CSS
        // vars; wheat and terra have no web variables yet so the spec
        // says hardcode mobile's light-mode hex inline. Ghost is a
        // neutral outline; danger uses the existing `--destructive`.
        sage: "border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[color:var(--secondary-foreground)]",
        wheat: "border-[#E2D6AC] bg-[#EDDFB7] text-[#6F571E]",
        terra: "border-[#E5C8B9] bg-[#EFD5C9] text-[#7A3A1B]",
        ghost: "border-border bg-transparent text-muted-foreground",
        danger:
          "border-[color:var(--destructive)]/30 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
