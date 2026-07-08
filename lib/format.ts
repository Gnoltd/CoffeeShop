/**
 * Vietnamese-locale formatting helpers.
 *
 * Conventions used throughout this app:
 * - Currency: "1.500.000đ" (dot thousands separator, lowercase đ, no space)
 * - Numbers: "1.234.567" (dot thousands separator)
 * - Dates: "25/01/2025" (DD/MM/YYYY)
 * - Phone: "0912 345 678" or "+84 912 345 678" (grouped 4-3-3)
 */

const viNumberFormatter = new Intl.NumberFormat("vi-VN")

export function formatNumber(value: number): string {
  return viNumberFormatter.format(value)
}

export function formatVND(amount: number): string {
  return `${viNumberFormatter.format(Math.round(amount))}đ`
}

export function formatDateVN(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

export function formatPhoneVN(phone: string): string {
  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("84")) {
    const local = digits.slice(2)
    return `+84 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`.trim()
  }

  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`.trim()
}

/**
 * Parses a "YYYY-MM-DD" string as a LOCAL date, not UTC -- `new
 * Date(isoString)` parses as UTC midnight, which can display as the
 * wrong calendar day depending on the browser's timezone. This app's
 * dates are already Vietnam-local from the source (get_dashboard_stats
 * RPC); this just avoids re-introducing a timezone shift on the way
 * back out.
 */
export function parseIsoDateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatWeekdayShort(isoDate: string, locale: string): string {
  return parseIsoDateLocal(isoDate).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { weekday: "short" })
}
