import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small status marker. Variants live here; layout belongs to the call site
 * (docs/conventions/styling.md).
 *
 * Colour is never the only signal — the label carries the meaning, so a
 * "Sold" badge reads as sold in greyscale and to a screen reader.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide whitespace-nowrap uppercase",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        accent: "bg-accent text-accent-foreground",
        outline: "border-border text-muted-foreground border",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
