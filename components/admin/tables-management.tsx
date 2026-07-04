"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { QrCode, Download, RefreshCw, Plus, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTables } from "@/hooks/useTables"

export function TablesManagement() {
  const t = useTranslations("AdminTables")
  const { tables, renameTable, regenerateToken } = useTables()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState("")

  function startEditing(id: string, currentNumber: string) {
    setEditingId(id)
    setDraftNumber(currentNumber)
  }

  function saveEditing(id: string) {
    const trimmed = draftNumber.trim()
    if (trimmed) renameTable(id, trimmed)
    setEditingId(null)
  }

  function cancelEditing() {
    setEditingId(null)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
        <Button
          className="h-10 gap-2"
          disabled
          title="Not implemented yet — no tables table to write to"
        >
          <Plus className="h-4 w-4" />
          {t("addTable")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => {
          const isEditing = editingId === table.id
          return (
            <div
              key={table.id}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm transition-colors",
                isEditing && "border-primary ring-2 ring-primary/30"
              )}
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-xl border bg-muted">
                <QrCode className="h-16 w-16 text-muted-foreground" />
              </div>

              {isEditing ? (
                <div className="flex w-full items-center gap-1.5">
                  <input
                    autoFocus
                    value={draftNumber}
                    onChange={(e) => setDraftNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing(table.id)
                      if (e.key === "Escape") cancelEditing()
                    }}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-center font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(table.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                    aria-label={t("save")}
                    title={t("save")}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground"
                    aria-label={t("cancel")}
                    title={t("cancel")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-primary">
                    {t("table")} {table.number}
                  </h3>
                  <button
                    type="button"
                    onClick={() => startEditing(table.id, table.number)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-primary"
                    aria-label={t("rename")}
                    title={t("rename")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <p className="font-mono text-[10px] text-muted-foreground">{table.qrToken}</p>
              <div className="flex w-full gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-1 gap-1.5"
                  disabled
                  title="Not implemented yet — no real QR image to download"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("downloadQr")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 gap-1.5"
                  onClick={() => regenerateToken(table.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("regenerateCode")}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
