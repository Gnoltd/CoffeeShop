"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { MapPin, AlertCircle } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { useTables, type TableRecord } from "@/hooks/useTables"

export function TableLanding({ qrToken }: { qrToken: string }) {
  const t = useTranslations("TableLanding")
  const { setActiveTableByToken } = useTables()
  const [resolvedTable, setResolvedTable] = useState<TableRecord | null | undefined>(undefined)

  useEffect(() => {
    setResolvedTable(setActiveTableByToken(qrToken))
    // Runs once per token; setActiveTableByToken is stable within a TablesProvider lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken])

  if (resolvedTable === undefined) {
    return null
  }

  if (!resolvedTable) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-card-foreground">{t("invalidTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("invalidMessage")}</p>
        <Button className="h-11 w-full rounded-xl" render={<Link href="/menu" />} nativeButton={false}>
          {t("backToMenu")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
        <MapPin className="h-10 w-10 text-primary" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("orderingAt")}
      </p>
      <h1 className="text-3xl font-bold text-primary">{t("tableName", { number: resolvedTable.number })}</h1>
      <p className="text-sm text-muted-foreground">{t("servedHere")}</p>
      <Button className="h-12 w-full rounded-xl text-base font-bold" render={<Link href="/menu" />} nativeButton={false}>
        {t("viewMenu")}
      </Button>
    </div>
  )
}
