import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { findTranslationCalls, hasKey, type TranslationCall } from "./i18n-coverage"
import en from "../messages/en.json"
import vi from "../messages/vi.json"

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...walk(full))
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) files.push(full)
  }
  return files
}

describe("findTranslationCalls", () => {
  it("finds a t(\"key\") call resolved against its useTranslations namespace", () => {
    const source = `
      const t = useTranslations("Menu")
      export function X() {
        return <span>{t("total")}</span>
      }
    `
    expect(findTranslationCalls(source)).toEqual([{ namespace: "Menu", key: "total" }])
  })

  it("resolves each identifier to its own namespace when a file has multiple useTranslations bindings", () => {
    const source = `
      const t = useTranslations("Menu")
      const tProduct = useTranslations("ProductDetail")
      export function X() {
        return <div>{t("size")}{tProduct("addToCart")}</div>
      }
    `
    expect(findTranslationCalls(source)).toEqual([
      { namespace: "Menu", key: "size" },
      { namespace: "ProductDetail", key: "addToCart" },
    ])
  })

  it("resolves a getTranslations( ) server-component binding the same way", () => {
    const source = `
      const t = await getTranslations("Admin")
      export default async function Page() {
        return <h1>{t("dashboardTitle")}</h1>
      }
    `
    expect(findTranslationCalls(source)).toEqual([{ namespace: "Admin", key: "dashboardTitle" }])
  })

  it("ignores a call with a non-string-literal key (dynamic lookup) instead of crashing", () => {
    const source = `
      const t = useTranslations("Nav")
      export function X({ labelKey }) {
        return <span>{t(labelKey)}</span>
      }
    `
    expect(findTranslationCalls(source)).toEqual([])
  })

  it("drops the interpolation-values second argument, keeping only the key", () => {
    const source = `
      const t = useTranslations("ProductDetail")
      export function X() {
        return <span>{t("reviewCount", { count: 3 })}</span>
      }
    `
    expect(findTranslationCalls(source)).toEqual([{ namespace: "ProductDetail", key: "reviewCount" }])
  })
})

describe("hasKey", () => {
  const messages = { Menu: { total: "Total", size: "Size" }, Admin: {} }

  it("is true when the namespace and key both exist", () => {
    expect(hasKey(messages, "Menu", "total")).toBe(true)
  })

  it("is false when the namespace exists but the key doesn't", () => {
    expect(hasKey(messages, "Menu", "missing")).toBe(false)
  })

  it("is false when the namespace itself doesn't exist", () => {
    expect(hasKey(messages, "NoSuchNamespace", "total")).toBe(false)
  })

  it("is false when the namespace exists but is empty", () => {
    expect(hasKey(messages, "Admin", "anything")).toBe(false)
  })
})

describe("i18n coverage: every t()/tXxx() call site resolves in both message catalogs", () => {
  it("has no source file calling a translation key missing from en.json or vi.json", () => {
    const root = join(__dirname, "..")
    const files = [...walk(join(root, "app")), ...walk(join(root, "components"))]
    expect(files.length).toBeGreaterThan(50) // sanity check the walk actually found the tree

    const missing: (TranslationCall & { file: string; missingFrom: string[] })[] = []
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      for (const call of findTranslationCalls(source)) {
        const missingFrom: string[] = []
        if (!hasKey(en, call.namespace, call.key)) missingFrom.push("en.json")
        if (!hasKey(vi, call.namespace, call.key)) missingFrom.push("vi.json")
        if (missingFrom.length > 0) {
          missing.push({ ...call, file: file.slice(root.length + 1), missingFrom })
        }
      }
    }

    expect(missing).toEqual([])
  })
})
