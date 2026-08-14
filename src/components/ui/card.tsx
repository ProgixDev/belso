import { cn } from "@/lib/utils";

type DivProps = React.ComponentProps<"div">;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("bg-card text-card-foreground rounded-xl border shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  // A real heading, not a div — screen readers and tests navigate by heading roles.
  return <h3 className={cn("leading-none font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: DivProps) {
  return <div className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
