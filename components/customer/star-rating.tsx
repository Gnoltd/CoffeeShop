import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const starSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            starSize,
            i < Math.round(rating) ? "fill-accent text-accent" : "fill-none text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  )
}
