"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { menuCategories, type MenuIcon, type MenuItem } from "@/lib/mock-data/menu"

const CATEGORY_ICONS: Record<string, MenuIcon> = {
  coffee: "coffee",
  tea: "cup-soda",
  pastries: "cookie",
  blended: "cup-soda",
}

function iconForCategory(categoryId: string): MenuIcon {
  return CATEGORY_ICONS[categoryId] ?? "coffee"
}

export function MenuItemForm({
  initialItem,
  onCancel,
  onSave,
}: {
  initialItem?: MenuItem
  onCancel: () => void
  onSave: (item: MenuItem) => void
}) {
  const t = useTranslations("AdminMenu")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialItem)

  const [nameVi, setNameVi] = useState(initialItem?.nameVi ?? "")
  const [nameEn, setNameEn] = useState(initialItem?.nameEn ?? "")
  const [categoryId, setCategoryId] = useState(initialItem?.categoryId ?? menuCategories[0].id)
  const [price, setPrice] = useState(initialItem ? String(initialItem.basePrice) : "")
  const [descriptionVi, setDescriptionVi] = useState(initialItem?.descriptionVi ?? "")
  const [descriptionEn, setDescriptionEn] = useState(initialItem?.descriptionEn ?? "")
  const [isAvailable, setIsAvailable] = useState(initialItem?.isAvailable ?? true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialItem?.imageUrl ?? null)
  // Tracks whether *this form* created the current preview URL via
  // createObjectURL — an inherited initialItem.imageUrl may still be
  // referenced by the table row / Menu grid / Product Detail Page, so we
  // must never revoke a URL we didn't create ourselves.
  const [ownsPreviewUrl, setOwnsPreviewUrl] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (imagePreviewUrl && ownsPreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl, ownsPreviewUrl])

  function selectFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return
    if (imagePreviewUrl && ownsPreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setOwnsPreviewUrl(true)
  }

  function removeImage() {
    if (imagePreviewUrl && ownsPreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
    setOwnsPreviewUrl(false)
  }

  function handleSave() {
    const parsedPrice = Number(price)
    if (!nameVi.trim() || !nameEn.trim() || !categoryId || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError(t("requiredFieldsError"))
      return
    }

    onSave({
      id: initialItem?.id ?? `custom-${Date.now()}`,
      categoryId,
      nameVi: nameVi.trim(),
      nameEn: nameEn.trim(),
      descriptionVi: descriptionVi.trim(),
      descriptionEn: descriptionEn.trim(),
      basePrice: parsedPrice,
      icon: iconForCategory(categoryId),
      isAvailable,
      imageUrl: imagePreviewUrl ?? undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-card-foreground">
            {isEditing ? t("editItemTitle") : t("addItem")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t("cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("nameViLabel")}</label>
              <Input value={nameVi} onChange={(e) => setNameVi(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("nameEnLabel")}</label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("categoryLabel")}</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {menuCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.labelVi} / {category.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("priceLabel")}</label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("descriptionViLabel")}</label>
              <textarea
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("descriptionEnLabel")}</label>
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("photoLabel")}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            />
            {imagePreviewUrl ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <span className="flex-1 truncate text-sm text-muted-foreground">
                  {imageFile?.name ?? t("currentPhoto")}
                </span>
                <button
                  type="button"
                  onClick={removeImage}
                  aria-label={t("removeImage")}
                  title={t("removeImage")}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDraggingOver(true)
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDraggingOver(false)
                  selectFile(e.dataTransfer.files?.[0] ?? null)
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                  isDraggingOver ? "border-primary bg-primary/5" : "border-input"
                )}
              >
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("dragDropText")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("browseButton")}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-card-foreground">{t("availableToggle")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              onClick={() => setIsAvailable((prev) => !prev)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                isAvailable ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  isAvailable ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave}>{t("save")}</Button>
        </div>
      </div>
    </div>
  )
}
