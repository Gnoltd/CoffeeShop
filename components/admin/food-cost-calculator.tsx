"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
}

const FIELDS: FieldKey[] = ["beginningInventory", "purchases", "endingInventory", "foodSales"]

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

function resolveStatus(percent: number): FoodCostStatus {
  if (percent < 28) return "good"
  if (percent <= 32) return "normal"
  return "needsImprovement"
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

    setError(null)
    setResult({
      foodCostUsed,
      foodCostPercent,
      status: resolveStatus(foodCostPercent),
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
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
            <Button onClick={handleCalculate} className="h-11 min-w-11 flex-1 sm:flex-none sm:px-8">
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
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">{t("resultsTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("foodCostUsed")}</dt>
                    <dd className="text-lg font-semibold">{formatVND(result.foodCostUsed)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("foodCostPercent")}</dt>
                    <dd className="text-lg font-semibold">{result.foodCostPercent.toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("status")}</dt>
                    <dd>
                      <Badge className={cn("mt-1", STATUS_STYLES[result.status])}>
                        {t(STATUS_LABEL_KEYS[result.status])}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
