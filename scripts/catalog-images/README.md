# Katalog görselleri

Master katalogdaki 1.153 ürün için **bir kez** üretilen görseller `public/catalog/{slug}.webp` (768 px) ve
`{slug}-s.webp` (320 px) olarak uygulamayla dağıtılır; `catalog_items.image_url` = `/catalog/{slug}.webp?v={hash}`.

Sıra (ayrıntı: `generate.ts` başı):

```bash
npm run catalog:images -- --backend stock --dry-run --limit 20          # prompt/sorgu kontrolü
npm run catalog:images -- --backend stock --limit 30                    # küçük deneme
npm run catalog:images:sheet                                            # .work/sheet.html ile göz kontrolü
npm run catalog:images -- --backend stock                               # tam stok turu (Pixabay + Openverse, Gemini hakem)
npm run catalog:images -- --backend pollinations --missing              # kalanlar: AI (z-image-turbo 1024)
npm run catalog:images -- --backend cloudflare --missing                # ya da Cloudflare (günlük nöron bütçesi)
npm run catalog:images -- --backend drawthings --missing                # ya da yerel Draw Things
npm run catalog:images -- --backend pollinations --force --only adana-kebap,kunefe   # QA düzeltmeleri
npm run catalog:images:apply -- --dry-run && npm run catalog:images:apply            # DB + credits.json
```

- Durma (çıkış kodu 3) = kota/limit; aynı komut kaldığı yerden devam eder (manifest her üründen sonra yazılır).
- `overrides.json`: markalı ürünler için jenerik konu + `skipStock`; QA sonrası elle düzeltmeler.
- Stok turu Pixabay + Wikimedia Commons + Openverse adaylarını harmanlar; Commons Türk yemeklerinde en geniş kapsamı verir (anahtar gerekmez).
- `overrides.json` → `stockQueries`: ürün adı yerine kullanılacak stok sorguları (markalı ürünleri de stok turuna sokar), `judgeNote`: hakeme ek kabul kuralı.
- Gerekli anahtarlar `.env.example` içinde. Stok turu için en azından `GEMINI_API_KEY` (+ tercihen `PIXABAY_API_KEY`).
- Toptan yeniden üretim yapmayın (repo büyür); yalnızca `--only` ile düzeltin.
