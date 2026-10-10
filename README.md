# CartPilot — phone barcode scanner / warehouse budget tracker

A static, mobile-first web app. Not affiliated with Costco.

## What it does

- Uses the phone camera to scan common 1D retail barcodes (EAN, UPC, Code 128, etc.).
- Searches Open Food Facts for a **product name**, when available. This service does not supply Costco prices and does not cover every product.
- Opens a separate Costco.com product search for reference. It does **not** read Costco's webpage, access your Costco login, scrape prices, or sync a Costco account.
- Lets you enter shelf prices, change quantities, flag taxable items, and set your budget / estimated tax rate.
- Remembers the cart and known scanned barcode prices on that browser via localStorage.
- Can finish trips, view trip history, and export CSV files.
- Supports manual item entry and manual barcode entry when camera scanning is unavailable.

## Run it on your phone

1. Upload the **contents** of this folder to an HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).
2. Open the HTTPS link on your phone.
3. Allow camera permissions when you tap **Scan barcode**.
4. Add items, enter the warehouse shelf price, and track the estimated total.
5. Optionally use **Add to Home Screen** from the phone's browser menu.

**Important:** Phone camera access usually requires `https://` (or `localhost` for development). Opening `index.html` as a local file is useful for testing the manual-entry UI but not a reliable way to use the camera.

## Technologies and privacy

- No framework / build step required: HTML, CSS, vanilla JavaScript.
- Uses the browser's native `BarcodeDetector` where available. Otherwise loads `html5-qrcode` v2.3.8 from unpkg.com (requires a network connection on first use).
- The barcode-name lookup calls `world.openfoodfacts.org` from your device.
- All carts, prices, and past trips are saved locally on the device. No database, account, or remote sync. Clearing site data erases local data.
- App shell is cached for offline use after the first hosted load; name lookups and fallback scanner CDN may require internet.

## Open Prices historical price lookup

When a barcode is scanned, the app queries the public Open Prices API for historical USD unit-price observations. Costco-tagged submissions appear separately from prices at other or unspecified stores. Each offer includes its reported store and date where available. Selecting **Use price** explicitly copies that value to the editable price field; prices are never automatically applied.

The Open Prices database is community contributed and may have no data for a scanned barcode. Observations are **not live Costco prices** and can be outdated, discounted, or associated with different stores. The app makes read-only public requests and does not transmit cart history. Source: https://prices.openfoodfacts.org/ (Open Database License / ODbL).

## Pricing limitation

Costco.com price/availability can differ from in-warehouse pricing and can vary by location. There is no automatic Costco live in-store price integration in this MVP. Prices must be entered by the shopper and totals are **estimates**, including taxes.

Official Costco information:
- https://customerservice.costco.com/app/answers/detail/a_id/691
- https://customerservice.costco.com/app/answers/answer_view/a_id/1015066

## Files

- `index.html`: app and all application logic.
- `manifest.webmanifest`: home-screen installation metadata.
- `sw.js`: basic offline app shell cache.
- `icon.svg`: app icon.\n- `catalog-lookup.js`: product name and photo lookup.\n- `open-prices.js`: historical community price lookup.