"use client"

import { useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { formatOrderId, formatVND } from "@/lib/format"
import { useOrderHistory } from "@/hooks/useOrderHistory"
import type { OrderHistoryFilters, RealOrderStatus, OrderType } from "@/lib/supabase/orders-data"

const PAGE_SIZE = 20

const STATUS_BADGE: Record<"completed" | "cancelled", string> = {
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground",
}

function formatDateTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function OrderHistoryList() {
  const locale = useLocale()
  const t = useTranslations("StaffOrderHistory")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<RealOrderStatus | "all">("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | "all">("all")
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined)
  const [dateTo, setDateTo] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const debounceRef = useRef<number | undefined>(undefined)

  const filters: OrderHistoryFilters = {
    dateFrom,
    dateTo,
    statuses: statusFilter === "all" ? undefined : [statusFilter],
    orderType: orderTypeFilter === "all" ? undefined : orderTypeFilter,
    search: search || undefined,
  }
  const { rows, totalCount, isLoading } = useOrderHistory(filters, page, PAGE_SIZE)

  function resetToFirstPage() {
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setSearch(value)
      resetToFirstPage()
    }, 300)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-4 text-2xl font-bold text-card-foreground">{t("title")}</h1>

      <div className="mb-3 flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => {
            setDateFrom(e.target.value || undefined)
            resetToFirstPage()
          }}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => {
            setDateTo(e.target.value || undefined)
            resetToFirstPage()
          }}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as RealOrderStatus | "all")
            resetToFirstPage()
          }}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <option value="all">{t("statusAll")}</option>
          <option value="completed">{t("statusCompleted")}</option>
          <option value="cancelled">{t("statusCancelled")}</option>
        </select>
        <select
          value={orderTypeFilter}
          onChange={(e) => {
            setOrderTypeFilter(e.target.value as OrderType | "all")
            resetToFirstPage()
          }}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <option value="all">{t("orderTypeAll")}</option>
          <option value="pickup">{t("orderTypePickup")}</option>
          <option value="dine-in">{t("orderTypeDineIn")}</option>
        </select>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-muted-foreground">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("columnOrderId")}</th>
                <th className="px-4 py-3">{t("columnDateTime")}</th>
                <th className="px-4 py-3">{t("columnCustomer")}</th>
                <th className="px-4 py-3">{t("columnTable")}</th>
                <th className="px-4 py-3">{t("columnPayment")}</th>
                <th className="px-4 py-3">{t("columnStatus")}</th>
                <th className="px-4 py-3 text-right">{t("columnTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/staff/orders/history/${order.id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      #{formatOrderId(order.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.createdAt, locale)}</td>
                  <td className="px-4 py-3">{order.customerName ?? t("guestLabel")}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.orderType === "dine-in" ? order.table : t("orderTypePickup")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{order.paymentMethod}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        STATUS_BADGE[order.status as "completed" | "cancelled"]
                      }`}
                    >
                      {order.status === "completed" ? t("statusCompleted") : t("statusCancelled")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatVND(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t("paginationSummary", { from: rangeFrom, to: rangeTo, total: totalCount })}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
          >
            {t("previous")}
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  )
}
