"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import QRCode from "qrcode"
import { QrCode, Download, RefreshCw, Plus, Pencil, Check, X, Grid2x2, CircleCheck, User, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTables } from "@/hooks/useTables"

export function TablesManagement() {
  const locale = useLocale()
  const t = useTranslations("AdminTables")
  const { tables, addTable, renameTable, updateLocation, toggleOccupied, regenerateToken } = useTables()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState("")
  const [draftLocationVi, setDraftLocationVi] = useState("")
  const [draftLocationEn, setDraftLocationEn] = useState("")
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})

  const totalScans = tables.reduce((sum, table) => sum + table.scanCount, 0)
  const occupiedCount = tables.filter((table) => table.isOccupied).length

  useEffect(() => {
    let cancelled = false
    const origin = window.location.origin

    Promise.all(
      tables.map(async (table) => {
        const url = `${origin}/table/${table.qrToken}`
        const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 1 })
        return [table.id, dataUrl] as const
      })
    ).then((entries) => {
      if (!cancelled) setQrCodes(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [tables])

  function downloadQr(tableNumber: string, dataUrl: string) {
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `table-${tableNumber}-qr.png`
    link.click()
  }

  function startEditing(id: string, currentNumber: string, locationVi: string, locationEn: string) {
    setEditingId(id)
    setDraftNumber(currentNumber)
    setDraftLocationVi(locationVi)
    setDraftLocationEn(locationEn)
  }

  function saveEditing(id: string) {
    const trimmed = draftNumber.trim()
    if (trimmed) renameTable(id, trimmed)
    updateLocation(id, draftLocationVi.trim(), draftLocationEn.trim())
    setEditingId(null)
  }

  function cancelEditing() {
    setEditingId(null)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-card-foreground">{t("title")}</h2>
        <Button className="h-10 gap-2" onClick={addTable}>
          <Plus className="h-4 w-4" />
          {t("addTable")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Grid2x2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("totalTables")}</p>
            <p className="text-xl font-bold text-card-foreground">{tables.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CircleCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("available")}</p>
            <p className="text-xl font-bold text-card-foreground">{tables.length - occupiedCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("totalScans")}</p>
            <p className="text-xl font-bold text-card-foreground">{totalScans}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => {
          const isEditing = editingId === table.id
          const location = locale === "vi" ? table.locationVi : table.locationEn
          return (
            <div
              key={table.id}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm transition-colors",
                isEditing && "border-primary ring-2 ring-primary/30"
              )}
            >
              <button
                type="button"
                onClick={() => toggleOccupied(table.id)}
                title={table.isOccupied ? t("markAvailable") : t("markOccupied")}
                className={cn(
                  "inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                  table.isOccupied
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                )}
              >
                {table.isOccupied ? <User className="h-3 w-3" /> : <CircleCheck className="h-3 w-3" />}
                {table.isOccupied ? t("occupied") : t("available")}
              </button>

              <div className="flex h-32 w-32 items-center justify-center rounded-xl border bg-muted">
                {qrCodes[table.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodes[table.id]}
                    alt={`${t("table")} ${table.number} QR`}
                    className="h-full w-full rounded-xl object-contain p-2"
                  />
                ) : (
                  <QrCode className="h-16 w-16 text-muted-foreground" />
                )}
              </div>

              {isEditing ? (
                <div className="flex w-full flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
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
                  <input
                    value={draftLocationVi}
                    onChange={(e) => setDraftLocationVi(e.target.value)}
                    placeholder={t("locationViLabel")}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    value={draftLocationEn}
                    onChange={(e) => setDraftLocationEn(e.target.value)}
                    placeholder={t("locationEnLabel")}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-center text-xs italic focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-primary">
                      {t("table")} {table.number}
                    </h3>
                    <button
                      type="button"
                      onClick={() => startEditing(table.id, table.number, table.locationVi, table.locationEn)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-primary"
                      aria-label={t("rename")}
                      title={t("rename")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {location && <p className="text-xs italic text-muted-foreground">{location}</p>}
                </div>
              )}

              <p className="font-mono text-[10px] text-muted-foreground">{table.qrToken}</p>
              <div className="flex w-full gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-1 gap-1.5"
                  disabled={!qrCodes[table.id]}
                  onClick={() => downloadQr(table.number, qrCodes[table.id])}
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
