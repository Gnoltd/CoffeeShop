/**
 * Validates a QR-decoded string looks like this app's own table URL
 * before anything is allowed to navigate — matches the pathname only,
 * deliberately ignoring the hostname so scanning still works against a
 * preview deployment's URL, not just the exact production domain. Safe
 * to be this lenient because only an opaque token substring is ever
 * extracted; the real validation (does this token resolve to a real
 * table) happens where it always has, in table-landing.tsx.
 */
export function extractTableToken(decodedText: string): string | null {
  const match = decodedText.match(/\/(?:vi\/|en\/)?table\/([^/?#]+)/)
  return match ? match[1] : null
}
