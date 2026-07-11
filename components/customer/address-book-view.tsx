"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { MapPin, Star, Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type Address,
  type AddressInput,
} from "@/lib/supabase/address-data"

const EMPTY_FORM: AddressInput = { label: "", address: "", phone: "" }

export function AddressBookView() {
  const t = useTranslations("Addresses")
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<AddressInput>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  function refetch(uid: string) {
    getAddresses(supabase, uid)
      .then(setAddresses)
      .catch(() => setError(t("loadError")))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      refetch(user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startAdd() {
    setForm(EMPTY_FORM)
    setEditingId("new")
    setError(null)
  }

  function startEdit(addr: Address) {
    setForm({ label: addr.label, address: addr.address, phone: addr.phone })
    setEditingId(addr.id)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!userId) return
    if (!form.label.trim() || !form.address.trim()) {
      setError(t("requiredFieldsError"))
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      if (editingId === "new") {
        await addAddress(supabase, userId, form)
      } else if (editingId) {
        await updateAddress(supabase, editingId, form)
      }
      cancelEdit()
      refetch(userId)
    } catch {
      setError(t("saveError"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!userId) return
    try {
      await deleteAddress(supabase, id)
      refetch(userId)
    } catch {
      setError(t("deleteError"))
    }
  }

  async function handleSetDefault(id: string) {
    if (!userId) return
    try {
      await setDefaultAddress(supabase, id)
      refetch(userId)
    } catch {
      setError(t("saveError"))
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">{t("title")}</h2>
        {editingId === null && (
          <Button onClick={startAdd} className="h-9 gap-1.5 rounded-xl px-3 text-sm">
            <Plus className="h-4 w-4" />
            {t("addButton")}
          </Button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {editingId !== null && (
        <section className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-card-foreground">
            {editingId === "new" ? t("addTitle") : t("editTitle")}
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block px-1 text-xs font-medium text-muted-foreground">{t("labelField")}</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t("labelPlaceholder")}
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block px-1 text-xs font-medium text-muted-foreground">{t("addressField")}</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder={t("addressPlaceholder")}
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block px-1 text-xs font-medium text-muted-foreground">{t("phoneField")}</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder={t("phonePlaceholder")}
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="h-11 flex-1 rounded-xl">
                {t("saveButton")}
              </Button>
              <Button onClick={cancelEdit} variant="outline" className="h-11 flex-1 rounded-xl">
                {t("cancelButton")}
              </Button>
            </div>
          </div>
        </section>
      )}

      {addresses === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>
      ) : addresses.length === 0 && editingId === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-card-foreground">{addr.label}</p>
                      {addr.isDefault && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          <Star className="h-3 w-3" fill="currentColor" />
                          {t("defaultBadge")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{addr.address}</p>
                    {addr.phone && <p className="text-sm text-muted-foreground">{addr.phone}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(addr)}
                    aria-label={t("editTitle")}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    aria-label={t("deleteButton")}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {!addr.isDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(addr.id)}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  {t("setDefaultButton")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
