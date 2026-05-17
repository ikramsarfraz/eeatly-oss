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
        // Round 22 / R23 — tone extension mirroring mobile's Chip
        // primitive. Each tone resolves to CSS variables defined in
        // `globals.css` (with light + dark siblings), so the OS-driven
        // dark variant flips them automatically without a `dark:`
        // utility per tone. `ghost` stays semantic (subtle neutral).
        sage: "border-sage bg-sage text-[color:var(--sage-fg)]",
        wheat: "border-wheat bg-wheat text-[color:var(--wheat-fg)]",
        terra: "border-terra bg-terra text-[color:var(--terra-fg)]",
        ghost: "border-border bg-transparent text-muted-foreground",
        danger:
          "border-danger-soft bg-danger-soft text-[color:var(--danger-fg)]"
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
