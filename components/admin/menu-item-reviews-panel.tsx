"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { StarRating } from "@/components/customer/star-rating"
import { getMenuItemReviews, replyToReview, type MenuItemReview } from "@/lib/supabase/reviews-data"

export function MenuItemReviewsPanel({ itemId }: { itemId: string }) {
  const t = useTranslations("AdminMenu")
  const [supabase] = useState(() => createClient())
  const [reviews, setReviews] = useState<MenuItemReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    getMenuItemReviews(supabase, itemId).then((result) => {
      setReviews(result.reviews)
      setIsLoading(false)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  async function handleReply(reviewId: string) {
    const reply = (replyDrafts[reviewId] ?? "").trim()
    if (!reply) return
    setSavingId(reviewId)
    setError(null)
    try {
      await replyToReview(supabase, reviewId, reply)
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }))
      load()
    } catch {
      setError(t("replySubmitError"))
    } finally {
      setSavingId(null)
    }
  }

  if (isLoading) return null

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{t("reviewsPanelTitle")}</label>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noReviewsForItem")}</p>
      ) : (
        <div className="nb-border-sm space-y-3 rounded-lg bg-card p-3">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-1.5 border-b-2 border-ink/15 pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-card-foreground">
                  {review.reviewerName ?? t("anonymousReviewer")}
                </span>
                <StarRating rating={review.rating} />
              </div>
              <p className="text-sm text-card-foreground">{review.comment}</p>
              {review.staffReply ? (
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs font-semibold text-secondary">{t("shopReplyLabel")}</p>
                  <p className="text-sm text-card-foreground">{review.staffReply}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={replyDrafts[review.id] ?? ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                    placeholder={t("replyPlaceholder")}
                    className="nb-border-sm h-9 flex-1 rounded-lg bg-card px-3 text-sm text-card-foreground focus:outline-none"
                  />
                  <Button variant="neubrutal" type="button" size="sm" onClick={() => handleReply(review.id)} disabled={savingId === review.id}>
                    {t("replyButton")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
