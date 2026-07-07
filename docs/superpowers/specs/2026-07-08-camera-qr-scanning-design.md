# Camera-Based QR Scanning (Landing Page) — Design Spec

**Date:** 2026-07-08
**Status:** Approved, ready for implementation planning.

## Context

First of three features triaged from a 2026-07-08 batch of user-reported
bugs/requests (the other two — table status in Kitchen Display + Admin
Dashboard, and Admin Dashboard real data — are queued separately,
tackled first-come-first-serve per the user's explicit instruction).

Landing's "Scan QR at Table" button (`components/marketing/landing-view.tsx`)
has been `disabled` + tooltip since it was first built — there has never
been any camera-based QR scanning in this app. Today, a customer reaches
`/table/[qrToken]` only by physically scanning a printed table sticker
with their phone's own OS camera app, which opens the URL in a browser
outside this app entirely. This spec makes the in-app button real:
tapping it opens the device camera, decodes a QR code, and lands the
customer on the same `/table/[qrToken]` page that already exists.

### What already exists (reused as-is, not touched)

- `components/customer/table-landing.tsx` + `app/[locale]/(customer)/table/[qrToken]/page.tsx`
  — already resolves a token to a real table via `useTables()`'s
  `setActiveTableByToken` (a real Supabase query), and already renders
  loading/invalid-token/success states. This spec adds zero new logic
  here — it only gets the customer to this existing page faster.
- `components/admin/tables-management.tsx` — already generates each
  table's real, scannable QR code client-side via the `qrcode` npm
  package, encoding `${origin}/table/${qrToken}` (confirmed by reading
  the actual generation code — **no locale prefix**, relying on
  middleware's locale detection to redirect to `/vi/table/...` or
  `/en/table/...`).

## Scope

**In scope:** a full-screen in-app camera scanner on Landing that
decodes a table's printed QR code and navigates to its `/table/[qrToken]`
page, with real handling for permission-denied, no-camera, and
non-table-QR-code cases.

**Explicitly out of scope:** any change to how QR codes are generated
(admin's existing `tables-management.tsx` flow is untouched), any change
to `table-landing.tsx`'s own token-resolution logic, scanning from
anywhere other than the Landing page (e.g. no scanner entry point added
to Menu or other customer pages).

## Design

### 1. Library: `jsQR`

New npm dependency — a ~5KB pure-JS QR decoder with no dependencies of
its own, added to `package.json`. Chosen over the native
`BarcodeDetector` API (unsupported in Firefox and had spotty Safari
support historically — a real chunk of customers could hit "not
supported" on a feature meant to make ordering easier) and over
`html5-qrcode` (a larger, more batteries-included package that renders
its own camera UI/controls, pulling in more code and a different UI
convention than this project's hand-rolled-everything style). This is
the first client-side scanning dependency in the project — worth noting
explicitly since the project is otherwise dependency-conscious, but
there's no reasonable zero-dependency way to decode a QR code from raw
video frames across all browsers.

### 2. `components/customer/qr-scanner-overlay.tsx` (new, client component)

Owns all camera/scanning logic, self-contained:

- On mount, calls `navigator.mediaDevices.getUserMedia({ video: {
  facingMode: "environment" } })` (rear camera preferred) and attaches
  the resulting stream to a `<video>` element.
- Runs a `requestAnimationFrame` loop that draws the current video frame
  to a hidden `<canvas>`, reads its `ImageData`, and passes it to
  `jsQR()`.
- **On a successful decode**: extracts the decoded string and tests it
  against a table-URL shape — a regex matched against the **pathname
  only** (`/(?:vi\/|en\/)?table\/([^/?#]+)/`), deliberately ignoring the
  scanned URL's hostname so scanning still works against a preview
  deployment's URL, not just the exact production domain. Since the app
  only ever extracts an opaque token substring and routes to its own
  `/table/[qrToken]` page (which does its own real DB validation before
  showing anything), ignoring the hostname introduces no real risk. On a
  match: stop the camera, call `onClose()`, and navigate via
  `useRouter()` from `@/i18n/navigation` to `/table/{token}` (the
  existing locale-aware router prefixes the current locale
  automatically).
- **On a decode that doesn't match the table-URL shape**: show a brief
  inline "not a table code" message and keep scanning — the overlay
  does not close or navigate. A single stray decode of a random QR code
  must not silently swallow the scan session or navigate anywhere
  unexpected.
- **On `getUserMedia` rejection**: distinguish `NotAllowedError`
  (permission denied) from anything else (no camera / camera in use /
  unsupported) and show the corresponding inline message with a visible
  Close button — no dead end, matching the project's existing
  "disabled + tooltip" honesty convention rather than silently failing
  or showing a blank screen.
- **Cleanup**: a single shared close path (Close button, successful
  scan, and component unmount all funnel through the same function)
  stops every `MediaStreamTrack` on the stream — required so the
  device's camera-in-use indicator actually turns off; leaking an open
  stream on close would be a real, user-visible bug (the OS camera
  light staying on).
- Props: `{ onClose: () => void }` — the only two things the overlay
  produces are "close me" and "I've navigated" (navigation itself is a
  side effect via the shared router, not a separate callback prop).

### 3. `components/marketing/landing-view.tsx`

- The "Scan QR at Table" button's `disabled` + tooltip is removed;
  `onClick` sets a local `isScannerOpen` boolean to `true`.
- `<QrScannerOverlay onClose={() => setIsScannerOpen(false)} />` renders
  conditionally when `isScannerOpen` is true.

### 4. Translations

New keys added to the existing `Landing` namespace in **both**
`messages/vi.json` and `messages/en.json`: a scanning-instructions line
("Point your camera at the table's QR code"), the "not a table code"
inline message, a permission-denied message, and a no-camera message.

## Edge cases / constraints

- `getUserMedia` requires a secure context (HTTPS or `localhost`) —
  already satisfied on the live Vercel deployment (HTTPS) and on local
  dev (`localhost` is browsers' standard secure-context exception), so
  no special-casing needed.
- No changes needed to `table-landing.tsx`, `useTables.tsx`, or the
  database — this feature is purely "get a token string in front of the
  existing page faster than typing it or physically scanning with the
  OS camera app," reusing 100% of the existing resolution/validation
  path.

## Testing plan

No automated test — camera/`getUserMedia` isn't something this
project's Vitest setup (or any tool available in this environment) can
exercise, the same limitation as every other browser-only feature in
this codebase. Verified manually on the deployed Vercel URL using a
real phone:
- Point the in-app scanner at one of the admin-generated table QR codes
  and confirm it lands on that table's landing page exactly like
  physically scanning with the OS camera app does today (same token
  resolution, same `activeTable` state, same scan-count increment).
- Deny camera permission and confirm the inline permission-denied
  message shows with a working Close button (no dead end).
- Point the scanner at an unrelated QR code (e.g. a random URL) and
  confirm it shows the "not a table code" message and keeps scanning
  rather than navigating or crashing.
- Confirm closing the overlay (button or successful scan) actually
  releases the camera (OS camera indicator turns off).
