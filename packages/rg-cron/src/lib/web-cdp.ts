/**
 * Page headless des crawlers `ie-crawl` : `Bun.WebView` (cf. `webview.ts`),
 * sous le nom historique `WebCdpPage` que les modules de crawl importent.
 */
export { PageWebView as WebCdpPage, type NavigationResponse } from "./webview";
export { waitForSelector } from "./web-cdp-utils";
