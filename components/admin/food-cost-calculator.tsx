"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/format"

type FieldKey = "beginningInventory" | "purchases" | "endingInventory" | "foodSales"

type FoodCostStatus = "good" | "normal" | "needsImprovement"

type Result = {
  foodCostUsed: number
  foodCostPercent: number
  status: FoodCostStatus
  /** VND distance from the relevant benchmark (28% for good/normal, 32% for needsImprovement), always >= 0. */
  benchmarkDeltaVnd: number
}

const FIELDS: FieldKey[] = ["beginningInventory", "purchases", "endingInventory", "foodSales"]

const GOOD_THRESHOLD = 28
const NORMAL_THRESHOLD = 32

const STATUS_STYLES: Record<FoodCostStatus, string> = {
  good: "bg-green-600 text-white hover:bg-green-600",
  normal: "bg-amber-500 text-white hover:bg-amber-500",
  needsImprovement: "bg-destructive text-white hover:bg-destructive",
}

const STATUS_LABEL_KEYS: Record<FoodCostStatus, "statusGood" | "statusNormal" | "statusNeedsImprovement"> = {
  good: "statusGood",
  normal: "statusNormal",
  needsImprovement: "statusNeedsImprovement",
}

const INSIGHT_KEYS: Record<FoodCostStatus, "insightGood" | "insightNormal" | "insightNeedsImprovement"> = {
  good: "insightGood",
  normal: "insightNormal",
  needsImprovement: "insightNeedsImprovement",
}

const GAUGE_COLOR: Record<FoodCostStatus, string> = {
  good: "text-green-600",
  normal: "text-amber-500",
  needsImprovement: "text-destructive",
}

function resolveStatus(percent: number): FoodCostStatus {
  if (percent < GOOD_THRESHOLD) return "good"
  if (percent <= NORMAL_THRESHOLD) return "normal"
  return "needsImprovement"
}

function FoodCostGauge({ percent, status }: { percent: number; status: FoodCostStatus }) {
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={radius} strokeWidth="12" className="stroke-muted-foreground/15" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-500", GAUGE_COLOR[status])}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-extrabold text-card-foreground">{percent.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export function FoodCostCalculator() {
  const t = useTranslations("FoodCost")

  const [values, setValues] = useState<Record<FieldKey, string>>({
    beginningInventory: "",
    purchases: "",
    endingInventory: "",
    foodSales: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  function handleChange(field: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleClear() {
    setValues({ beginningInventory: "", purchases: "", endingInventory: "", foodSales: "" })
    setError(null)
    setResult(null)
  }

  function handleCalculate() {
    const parsed = FIELDS.reduce<Record<FieldKey, number>>((acc, field) => {
      acc[field] = Number(values[field])
      return acc
    }, {} as Record<FieldKey, number>)

    const hasInvalidField = FIELDS.some(
      (field) => values[field].trim() === "" || Number.isNaN(parsed[field]) || parsed[field] < 0
    )

    if (hasInvalidField) {
      setError(t("validationError"))
      setResult(null)
      return
    }

    if (parsed.foodSales <= 0) {
      setError(t("salesRequiredError"))
      setResult(null)
      return
    }

    const foodCostUsed = parsed.beginningInventory + parsed.purchases - parsed.endingInventory
    const foodCostPercent = (foodCostUsed / parsed.foodSales) * 100
    const status = resolveStatus(foodCostPercent)
    const benchmark = status === "needsImprovement" ? NORMAL_THRESHOLD : GOOD_THRESHOLD
    const benchmarkDeltaVnd = Math.abs(foodCostUsed - (benchmark / 100) * parsed.foodSales)

    setError(null)
    setResult({
      foodCostUsed,
      foodCostPercent,
      status,
      benchmarkDeltaVnd,
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <Card className="nb-border nb-shadow">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-extrabold">{t("title")}</CardTitle>
          <details className="group mt-1">
            <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-medium text-secondary marker:content-none">
              {t("howCalculated")}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
          </details>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{t(field)}</Label>
                <Input
                  id={field}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={t("placeholder")}
                  value={values[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="h-11"
                />
              </div>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="neubrutal" onClick={handleCalculate} className="h-11 min-w-11 flex-1 sm:flex-none sm:px-8">
              {t("calculate")}
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              className="h-11 min-w-11 flex-1 sm:flex-none sm:px-8"
            >
              {t("clear")}
            </Button>
          </div>

          {result && (
            <Card className="nb-border-sm nb-shadow-sm bg-chip">
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">{t("resultsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <FoodCostGauge percent={result.foodCostPercent} status={result.status} />
                <div className="flex flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                  <Badge className={STATUS_STYLES[result.status]}>{t(STATUS_LABEL_KEYS[result.status])}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {t(INSIGHT_KEYS[result.status], {
                      percent: result.foodCostPercent.toFixed(1),
                      amount: formatVND(Math.round(result.benchmarkDeltaVnd)),
                    })}
                  </p>
                  <p className="text-sm font-semibold text-card-foreground">
                    {t("foodCostUsed")}: {formatVND(result.foodCostUsed)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
