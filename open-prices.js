/* Open Prices: read-only, public community observations.
   https://prices.openfoodfacts.org/  (ODbL)
   These are historical prices, not Costco inventory or live prices. */
(() => {
  'use strict';
  const BASE = 'https://prices.openfoodfacts.org/api/v1/prices';
  const memory = new Map();
  const TTL = 30 * 60 * 1000;
  const normalize = code => String(code || '').replace(/[\s-]/g, '').replace(/^0(?=\d{12}$)/, '');
  const valid = code => /^\d{8,14}$/.test(code);
  const codesFor = raw => {
    const original = String(raw || '').replace(/[\s-]/g, '');
    if (!valid(original)) return [];
    const codes = [original];
    if (original.length === 12) codes.push('0' + original);
    if (original.length === 13 && original[0] === '0') codes.push(original.slice(1));
    return [...new Set(codes)];
  };
  const dateValue = value => /^\d{4}-\d\d-\d\d$/.test(value || '') ? Date.parse(value + 'T00:00:00Z') || 0 : 0;
  const storeName = place => [
    place?.osm_name, place?.osm_brand, place?.osm_display_name
  ].filter(value => typeof value === 'string').join(' ');
  const isCostco = place => /\bcostco\b/i.test(storeName(place));

  function observation(raw, queryCode) {
    if (!raw || String(raw.type || 'PRODUCT') !== 'PRODUCT') return null;
    const productCode = String(raw.product_code || raw.product?.code || '');
    if (normalize(productCode) !== normalize(queryCode)) return null;
    if (raw.currency !== 'USD') return null;
    const value = Number(raw.price);
    if (!Number.isFinite(value) || value <= 0 || value >= 100000) return null;
    // $/kg and $/lb cannot be used as an item price in a shopping cart.
    if (raw.price_per && raw.price_per !== 'UNIT') return null;
    if (raw.duplicate_of) return null;
    const place = raw.location || null;
    const city = typeof place?.osm_address_city === 'string' ? place.osm_address_city.trim() : '';
    const name = typeof place?.osm_name === 'string' && place.osm_name.trim()
      ? place.osm_name.trim()
      : (typeof place?.osm_brand === 'string' ? place.osm_brand.trim() : '');
    return {
      id: Number(raw.id) || 0,
      priceCents: Math.round(value * 100),
      date: dateValue(raw.date) ? raw.date : '',
      location: name || 'Unspecified store',
      city,
      costco: isCostco(place),
      discounted: raw.price_is_discounted === true,
      pricePer: raw.price_per || 'UNIT',
      proof: raw.proof?.type || '',
      productCode
    };
  }

  async function getPrices(code) {
    const cached = memory.get(code);
    if (cached && cached.expiry > Date.now()) return cached.value;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const qs = new URLSearchParams({
        product_code: code, currency: 'USD', type: 'PRODUCT', size: '75'
      });
      const response = await fetch(BASE + '?' + qs.toString(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data?.items)) throw new Error('Unexpected API response');
      const observations = data.items.map(row => observation(row, code)).filter(Boolean);
      memory.set(code, { value: observations, expiry: Date.now() + TTL });
      return observations;
    } finally { clearTimeout(timer); }
  }

  async function lookup(raw) {
    const codes = codesFor(raw);
    if (!codes.length) return { status: 'unsupported', costco: [], others: [] };
    const unique = new Map();
    let successfulRequests = 0;
    for (const code of codes) {
      try {
        const items = await getPrices(code);
        successfulRequests++;
        for (const item of items) unique.set(item.id ? 'id:' + item.id : code + ':' + item.date + ':' + item.priceCents, item);
      } catch {
        // A product can have both UPC-A and EAN-13 forms. Try the other form.
      }
    }
    if (!successfulRequests) return { status: 'unavailable', costco: [], others: [] };
    const order = (a, b) => (dateValue(b.date) - dateValue(a.date)) || (b.id - a.id);
    const items = [...unique.values()];
    return {
      status: 'ok',
      costco: items.filter(item => item.costco).sort(order).slice(0, 4),
      others: items.filter(item => !item.costco).sort(order).slice(0, 3)
    };
  }
  window.CartPilotPrices = { lookup, isCostco, observation, codesFor };
})();
