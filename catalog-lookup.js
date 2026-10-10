/* CartPilot barcode lookup: public product databases, never warehouse prices. */
(() => {
  'use strict';

  function candidates(raw) {
    const code = String(raw || '').replace(/[\s-]/g, '');
    if (!/^\d{8,14}$/.test(code)) return [];
    const result = [code];
    if (code.length === 12) result.push('0' + code);
    if (code.length === 13 && code[0] === '0') result.push(code.slice(1));
    return [...new Set(result)];
  }

  function imageURL(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 600) return '';
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }

  async function jsonWithTimeout(url, ms = 5500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, {
        method: 'GET', mode: 'cors', cache: 'default',
        headers: { Accept: 'application/json' }, signal: controller.signal
      });
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function firstString(...values) {
    return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
  }

  async function openFacts(code) {
    const fields = 'product_name,product_name_en,brands,image_front_small_url,image_small_url,image_url';
    const url = 'https://world.openfoodfacts.org/api/v2/product/'
      + encodeURIComponent(code) + '?fields=' + encodeURIComponent(fields) + '&product_type=all';
    const data = await jsonWithTimeout(url);
    const product = data?.product;
    if (data?.status !== 1 || !product) return null;
    const title = firstString(product.product_name_en, product.product_name);
    if (!title) return null;
    const brand = firstString(product.brands).split(',')[0].trim();
    const fullName = brand && !title.toLowerCase().includes(brand.toLowerCase()) ? brand + ' ' + title : title;
    return {
      name: fullName.slice(0, 100), brand, image: imageURL(firstString(
        product.image_front_small_url, product.image_small_url, product.image_url
      )), source: 'Open Facts', code
    };
  }

  async function upcDatabase(code) {
    const data = await jsonWithTimeout(
      'https://api.upcitemdb.com/prod/trial/lookup?upc=' + encodeURIComponent(code), 5500
    );
    const item = Array.isArray(data?.items) ? data.items[0] : null;
    if (!item) return null;
    const title = firstString(item.title);
    if (!title) return null;
    const brand = firstString(item.brand);
    const image = Array.isArray(item.images) ? item.images.map(imageURL).find(Boolean) || '' : '';
    return { name: title.slice(0, 100), brand, image, source: 'UPCitemdb', code };
  }

  async function lookup(raw, onProgress = () => {}) {
    const codes = candidates(raw);
    if (!codes.length) return null; // e.g. a warehouse item number, not a UPC/EAN barcode

    // Only two variants, never send the same barcode repeatedly.
    for (const code of codes) {
      onProgress('Searching product databases…');
      const found = await openFacts(code);
      if (found) return found;
    }
    onProgress('Trying a second barcode catalog…');
    // Anonymous UPCitemdb trial service has strict shared quota and may block CORS.
    // Treat it as best-effort; do not display its retailer offers as warehouse prices.
    for (const code of codes) {
      const found = await upcDatabase(code);
      if (found) return found;
    }
    return null;
  }

  window.CartPilotLookup = { lookup, candidates, imageURL };
})();
