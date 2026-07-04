"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { QrCode, Download, RefreshCw, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10)
}

type TableRow = {
  number: string
  token: string
}

const INITIAL_TABLES: TableRow[] = Array.from({ length: 6 }, (_, i) => ({
  number: String(i + 1).padStart(2, "0"),
  token: randomToken(),
}))

export function TablesManagement() {
  const t = useTranslations("AdminTables")
  const [tables, setTables] = useState(INITIAL_TABLES)

  function regenerate(number: string) {
    setTables((prev) =>
      prev.map((table) => (table.number === number ? { ...table, token: randomToken() } : table))
    )
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
        {tables.map((table) => (
          <div key={table.number} className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex h-32 w-32 items-center justify-center rounded-xl border bg-muted">
              <QrCode className="h-16 w-16 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-primary">
              {t("table")} {table.number}
            </h3>
            <p className="font-mono text-[10px] text-muted-foreground">{table.token}</p>
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
                onClick={() => regenerate(table.number)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("regenerateCode")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
