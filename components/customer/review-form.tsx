"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { StarRating } from "@/components/customer/star-rating"
import { getMyReviewForItem, submitReview } from "@/lib/supabase/reviews-data"

export function ReviewForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const t = useTranslations("OrderTracking")
  const [supabase] = useState(() => createClient())
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyReviewForItem(supabase, itemId).then((existing) => {
      if (cancelled) return
      if (existing) {
        setRating(existing.rating)
        setComment(existing.comment)
      }
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  async function handleSubmit() {
    if (rating < 1) {
      setError(t("reviewRatingRequiredError"))
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await submitReview(supabase, itemId, rating, comment.trim())
      onDone()
    } catch {
      setError(t("reviewSubmitError"))
      setIsSaving(false)
    }
  }

  if (isLoading) return null

  return (
    <div className="nb-border-sm mt-2 space-y-2 rounded-lg bg-chip p-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <StarRating rating={rating} size="lg" onRate={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("reviewCommentPlaceholder")}
        rows={2}
        className="nb-border-sm w-full resize-none rounded-lg bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="neubrutal" size="sm" className="bg-card text-foreground" onClick={onDone} disabled={isSaving}>
          {t("reviewCancelButton")}
        </Button>
        <Button type="button" variant="neubrutal" size="sm" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? t("reviewSubmitLoading") : t("submitReviewButton")}
        </Button>
      </div>
    </div>
  )
}
