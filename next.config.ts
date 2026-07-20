import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Removes the "X-Powered-By: Next.js" response header -- a small
  // information-disclosure fix (framework fingerprinting), part of the
  // same security-headers pass as middleware.ts's CSP/frame/referrer
  // headers (which next.config.js's own `headers()` can't express, since
  // this app needs a per-request CSP nonce that only middleware can mint).
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
