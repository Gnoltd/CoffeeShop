export type TranslationCall = { namespace: string; key: string }

const BINDING_RE = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g

/**
 * Finds every t("key")/tXxx("key") call in a source file and resolves it
 * against its own useTranslations/getTranslations("Namespace") binding —
 * a file may declare several (t, tNav, tProduct, ...). Calls with a
 * non-string-literal key (e.g. t(labelKey)) are dynamic lookups a static
 * scanner can't resolve and are silently skipped, not reported.
 */
export function findTranslationCalls(source: string): TranslationCall[] {
  const bindings = new Map<string, string>()
  for (const match of source.matchAll(BINDING_RE)) {
    bindings.set(match[1], match[2])
  }
  if (bindings.size === 0) return []

  const identifiers = [...bindings.keys()].sort((a, b) => b.length - a.length).join("|")
  const callRe = new RegExp(`\\b(${identifiers})\\(\\s*"([^"]+)"`, "g")

  const calls: TranslationCall[] = []
  for (const match of source.matchAll(callRe)) {
    const namespace = bindings.get(match[1])
    if (namespace) calls.push({ namespace, key: match[2] })
  }
  return calls
}

export function hasKey(messages: Record<string, unknown>, namespace: string, key: string): boolean {
  const ns = messages[namespace]
  if (typeof ns !== "object" || ns === null) return false
  return key in ns
}
