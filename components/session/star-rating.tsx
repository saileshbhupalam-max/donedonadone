"use client"

import { Star } from "lucide-react"
import { useState } from "react"

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  size?: "sm" | "md" | "lg"
}

const sizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10",
}

export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const [hover, setHover] = useState(0)

  return (
    <div className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`${sizes[size]} ${
              star <= (hover || value)
                ? "fill-primary text-primary"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  )
}
