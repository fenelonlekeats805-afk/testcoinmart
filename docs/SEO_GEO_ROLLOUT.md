# SEO/GEO Rollout Checklist

## 1) Environment variables

Set these in production `.env`:

```bash
NEXT_PUBLIC_SITE_URL=https://testcoinmart.top
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<google-site-verification-token>
```

`NEXT_PUBLIC_SITE_URL` is used for canonical URLs, sitemap, and schema IDs.

## 2) Verify crawl endpoints

After deploy, verify:

```bash
curl -I https://testcoinmart.top/robots.txt
curl -I https://testcoinmart.top/sitemap.xml
curl -I https://testcoinmart.top/llms.txt
```

Expected: `200 OK`.

## 3) Google Search Console setup

1. Add property: `https://testcoinmart.top`
2. Use `HTML tag` method and place token in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
3. Deploy and confirm verification
4. Submit sitemap: `https://testcoinmart.top/sitemap.xml`
5. Request indexing for:
   - `/`
   - `/skills`
   - `/guides/faucet-first`
   - all `/guides/*-faucet-alternative` pages

## 4) GEO (AI recommendation) setup

1. Keep `llms.txt` updated with canonical API and skills endpoints.
2. Keep `/skills` and `/guides/faucet-first` aligned with actual API behavior.
3. Ensure chain-specific guide pages map to real `productId` values.
4. When SKU pricing/min qty changes, update guide hints to avoid stale advice.

## 5) Monitoring signals

- Track impressions/clicks per landing page in Search Console.
- Track traffic to `/guides/*` and `/skills` in web analytics.
- Track conversion path: guide page -> order page -> `POST /v1/orders`.
