# ONE RETAIL AI — Project Status

## Overview
**ONE RETAIL AI** is a unified multi-modal retail intelligence and billing terminal that consolidates:
1. **FOUR-X Voice Billing** (speech-driven billing and rapid item selection)
2. **Camera / OCR Product Billing** (optical barcode, packaging label, and receipt recognition)
3. **Rack Photo Product Counting** (shelf vision for facing tallies and inventory audit)

---

## Stage Approval Status
- **Stage 1 — Product Master Integration**: **FINAL APPROVED** (8/8 tests passed, 531 records preserved byte-for-byte).
- **Stage 2 — Product Matching & Search Engine**: **FINAL APPROVED** (16/16 tests passed, offline in-memory index, reusable UI component).
- **Stage 3A — FOUR-X Voice Billing Integration**: **VOICE INTEGRATION TESTS PASSED; PRODUCTION BUILD STILL PENDING**.
- **Stage 3B — Scanner OCR Integration**: **NOT STARTED**.
- **Rack Photo Product Counting**: **NOT STARTED**.

### Stage 3A Source Integration Notes
- Source archive: `voice.zip` (FOUR-X Voice Billing source).
- Integrated source modules live under `src/voice/` to keep the original target architecture isolated and traceable.
- `VoiceBillingModule.tsx` now exposes Voice Billing and Voice Training & Testing tabs.
- The legacy voice parser, multilingual normalizer, speech service, invoice price resolver, and common training-memory service are retained.
- `src/voice/services/voiceCatalogueAdapter.ts` maps the legacy voice `ProductRecord` type to the canonical `src/data/fourx.json` records at runtime. It does not load or copy `voice.zip`'s `catalogue.json`.
- SHA-256 of target `src/data/fourx.json` and source `voice.zip` `src/data/catalogue.json` was identical at integration time: `321d6ce9af8835ab92bab4d9e85aad0e34241c11fd60fbb6632fdf0b2400f682`.
- `src/voice/services/productSearchService.ts` is a compatibility adapter that delegates all product search to the approved Stage 2 `src/services/productMatchingService.ts`; no second matching engine is used.
- Gemini: frontend local interpretation fallback is active. No secure Gemini proxy/backend is configured in this integration, so the service does not make an unconfigured `/api` request. A secure backend endpoint can be configured later through `one_retail_gemini_endpoint` in localStorage; do not put API keys in browser storage.
- Voice microphone operation requires browser SpeechRecognition support and microphone permission. These require manual browser/device testing.


---

## Catalogue Schema & Field Mapping (Inspection of all 531 records)

Inspection of `src/data/fourx.json` confirms all 531 records share a consistent schema:

| Field Name | Occurrence | Data Type | Description & Search Role |
| :--- | :--- | :--- | :--- |
| `sku` | 531 / 531 (100%) | `string` | **Canonical Unique Identifier** (e.g. `FX1101WH`, `S918109F`). Every single record has a unique SKU. Searchable at Level 1 (`EXACT_SKU`). |
| `base_code` | 531 / 531 (100%) | `string` | Product series base code (e.g. `FX1101`, `S30111`, `V5001`). 244 unique base codes. 199 base codes group multiple SKU variants. Searchable at Level 1 (`EXACT_BASE_CODE`). |
| `description` | 531 / 531 (100%) | `string` | **Original Catalogue Description** (e.g. `GRACE 10 AMP ONE WAY SWITCH 1M (WH)`). Preserved without mutation. Searchable at Level 2 and Level 3. |
| `item_name` | 531 / 531 (100%) | `string` | Expanded product name including variant label (e.g. `GRACE 10 AMP ONE WAY SWITCH 1M WHITE`). Searchable at Level 2 and Level 3. |
| `brand` | 531 / 531 (100%) | `string` | `FOUR-X` (majority) or `FYBROS` (specialized gang boxes/accessories). Searchable attribute. |
| `category` | 531 / 531 (100%) | `string` | `switch_accessory` or `modular_plate_or_frame`. Search filter & token match. |
| `product_group` | 531 / 531 (100%) | `string` | `SWITCH`, `SOCKET`, `REGULATOR`, `ACCESSORY`, `MCB`, `METAL GANG BOX`, `PLATES`. Search filter & token match. |
| `variant` | 531 / 531 (100%) | `string` | Product variant: `WHITE`, `CHROME`, `PURE WHITE`, `MAPPLE WOOD`, `AMERICAN WALNUT`, `FRAME`, `AS_PRINTED`, `ALL COLOURS`. Searchable attribute. |
| `colour_code` | 531 / 531 (100%) | `string` | Short variant code (e.g. `WH`, `WHCR`, `PW`, `MW`, `CR`, `F`, `AP`). Searchable token. |
| `package_qty` | 531 / 531 (100%) | `number` | Inner package count (e.g. 10, 20). Displayed attribute. |
| `outer_qty` | 531 / 531 (100%) | `number` | Master carton count (e.g. 40, 500, 1000). Displayed attribute. |
| `source_price_columns` | 531 / 531 (100%) | `number[]` | Raw printed price matrix from original price list. |
| `source_file` | 531 / 531 (100%) | `string` | Origin catalog PDF filename. Audit metadata. |
| `source_page` | 531 / 531 (100%) | `number` | Page number in origin PDF. Audit metadata. |
| `source_row` | 531 / 531 (100%) | `number` | Row index in origin PDF. Audit metadata. |
| `verification_status` | 531 / 531 (100%) | `string` | Verification state (`pending`). Preserved as-is. |
| `series` | 250 / 531 (47%) | `string` | Modular plate series number (e.g. `3`, `7`, `9`, `11`). Searchable token. |
| `variant_group` | 250 / 531 (47%) | `string` | Plate classification (`FRAME`, `PLATE`). |
| `net_rate_as_printed` | 250 / 531 (47%) | `number` | Printed net rate when available. |
| `with_gst_as_printed` | 250 / 531 (47%) | `number` | Printed rate including GST when available. |

---

## Stage 2: Product Matching & Search Engine Architecture

### 1. Matching Algorithm & Priority (5-Level Hierarchy)
- **Level 1 — Exact Product Code / SKU (Score: 96–100, VERY_HIGH)**:
  - Direct exact SKU match (e.g. `FX1101WH`, `fx-1101-wh`): Score = **100**.
  - Code extracted from OCR/noisy input (e.g. `ITEM: FX1101WH BATCH#99`): Score = **98**.
  - Exact Base Code match (e.g. `FX1101` returns both `FX1101WH` and `FX1101WHCR`): Score = **96** (boosted to **98** if query also mentions the variant name).
- **Level 2 — Exact Description Match (Score: 95, VERY_HIGH)**:
  - Normalized query exactly matches canonical `description` or `item_name`.
- **Level 3 — Token-Based Matching (Score: 85–94, HIGH)**:
  - Query tokens matched across all product attributes regardless of word order (e.g. `"10 amp white grace switch 1m"` $\equiv$ `"white grace 1m switch 10 amp"`).
  - Handles electrical domain synonyms (`10a` $\leftrightarrow$ `10 amp`, `1m` $\leftrightarrow$ `1 module`, `1way` $\leftrightarrow$ `one way`).
- **Level 4 — Partial Token Matching (Score: 62–79, POSSIBLE)**:
  - Matched prefix or substring terms (e.g. `regulat` matching `REGULATOR`).
  - Penalizes missing critical terms.
- **Level 5 — Fuzzy Matching (Score: 60–74, POSSIBLE)**:
  - Deterministic local Levenshtein edit-distance metric handles typos (e.g. `glamm 32 amp` $\rightarrow$ `FX2520WH`, `swithc` $\rightarrow$ `SWITCH`).
- **Threshold Cutoff**: Queries with score $< 60$ are classified as `LOW` and suppressed by default.

### 2. Search Normalization Layer
- Case conversion (lowercase).
- Punctuation normalization (converts separators `-`, `_`, `/`, `(`, `)` into boundary tokens without corrupting code identity).
- Whitespace collapsing and trimming.
- **Data Protection**: Normalization operates strictly in-memory during queries and **never** mutates the canonical catalogue. Original catalogue descriptions are always displayed and returned exactly as stored.

### 3. Public Service Functions (`src/services/productMatchingService.ts`)
- `searchProducts(query: string, options?: SearchOptions): SearchResult[]`
- `findProductByCode(code: string): FourxProductRecord | undefined`
- `findExactProduct(query: string): FourxProductRecord | undefined`
- `getProductMatchDetails(query: string): SearchResult | undefined`
- `normalizeSearchText(text: string): string`
- `getProductById(id: string): FourxProductRecord | undefined`
- `getProductBySku(sku: string): FourxProductRecord | undefined`
- `getProductsByBaseCode(baseCode: string): FourxProductRecord[]`
- `getSearchIndexStats(): { totalIndexed: number; uniqueSkus: number; uniqueBaseCodes: number }`

### 4. Search UI Component (`src/components/ProductSearch.tsx`)
- Search input with placeholder: `"Search product name, code or description..."`.
- Instantaneous local typing updates with `useTransition` for lag-free rendering.
- Displays total match count, clear search button, and optional filter drawer (Category, Product Group, Min Confidence threshold).
- Renders authentic catalogue descriptions, SKU tags, base codes, brand, packaging quantities, and transparent match scoring/explanations.
- No-results fallback: `"No matching product found in the current catalogue."`.
- Integrated directly into `DashboardOverview.tsx` as a live interactive testbed.

### 5. Offline Behaviour
- Zero network requests.
- Zero Gemini API calls.
- Pure client-side in-memory index built in $< 1$ ms on initial module load.

---

## Test Execution Results

### Stage 3A voice integration verification
- **Command actually executed**: `node --experimental-strip-types --test tests/fourxIntegrity.test.ts tests/productMatching.test.ts tests/voiceIntegration.test.ts`
- **Result**: **30/30 passed**, 0 failures (8 Stage 1 + 16 Stage 2 + 6 Stage 3A checks).
- **Additional syntax check**: TypeScript `transpileModule` syntax-checked 33 `.ts`/`.tsx` files with no syntax diagnostics.
- **Build status**: Not verified. `npm install` timed out; offline install reported uncached package metadata. Therefore `npm run build`, Vite bundling, and full dependency-aware type checking are still pending.
- **Runtime/manual status**: Microphone permission, browser SpeechRecognition, real-device billing flow, and optional secure Gemini proxy have not been manually tested.

### Stage 1: Product Master Integrity (`npm run test:stage1`)
- **Command**: `tsx tests/fourxIntegrity.test.ts`
- **Result**: **8/8 PASSED** (0 failures)
  1. Canonical catalogue file exists at `src/data/fourx.json`
  2. Exact file match with original source attachment (no modifications)
  3. Exact record count is 531
  4. No duplicate or missing records in the canonical catalogue (531 unique SKUs, 531 unique rows)
  5. All original fields and data types preserved across all 531 records
  6. Specific record anchor checks (FX1101WH, FX2520WH, V5001AP, S918109F)
  7. ProductMasterService safe lookups and indexes
  8. Immutability guarantee (frozen arrays and records)

### Stage 2: Product Matching & Search (`npm run test:stage2`)
- **Command**: `tsx tests/productMatching.test.ts`
- **Result**: **16/16 PASSED** (0 failures)
  1. Exact SKU lookup (`FX1101WH` $\rightarrow$ score 100, `EXACT_SKU`, `VERY_HIGH`)
  2. Exact product code lookup (`FX1101` $\rightarrow$ returns 2 variants with `EXACT_BASE_CODE`)
  3. Exact description lookup (`GRACE 10 AMP ONE WAY SWITCH 1M (WH)` $\rightarrow$ score 95)
  4. Case-insensitive search (`fx1101wh` $\equiv$ `FX1101WH`)
  5. Different word order (`10 amp white grace switch 1m` $\equiv$ `white grace 1m switch 10 amp`)
  6. Partial word search (`regulat` $\rightarrow$ `REGULATOR`)
  7. Minor spelling mistakes (`glamm 32 amp` $\rightarrow$ `FX2520WH`, `swithc` $\rightarrow$ `SWITCH`)
  8. OCR-style code input with surrounding text (`ITEM: FX-1101-WH (WHITE) BATCH#8892` $\rightarrow$ `FX1101WH`, score 98)
  9. Multiple matching variants (`S30111` returns 3 variants: `PURE WHITE`, `CHROME`, `MAPPLE WOOD`)
  10. Ambiguous query returns multiple scored candidates without auto-selection
  11. Empty search input returns empty array `[]`
  12. No-result query returns empty array `[]`
  13. Search result ranking: Exact SKU $\ge$ Exact Base Code $\ge$ Token All $\ge$ Fuzzy
  14. Original catalogue description preservation
  15. No mutation of original catalogue records during search execution
  16. Search index covers all 531 records (`totalIndexed: 531`, `uniqueSkus: 531`, `uniqueBaseCodes: 244`)

### Full Suite Run (`npm test`)
- **Command**: `npm test` (`tsx --test tests/fourxIntegrity.test.ts tests/productMatching.test.ts`)
- **Result**: **24/24 tests passed across 2 suites** (0 failures).
- **Compilation (`compile_applet`)**: Build succeeded.
- **Linter (`lint_applet`)**: 0 errors (`tsc --noEmit` clean).

---

## Known Limitations & Considerations
- **Base Code vs. SKU Ambiguity**: 199 base codes contain multiple SKU variants (e.g. `WHITE` vs `CHROME`). When a user inputs only a base code, the engine deliberately presents all variants rather than guessing.
- **Short Numeric Queries**: Queries like `"1"` or `"2"` are common module sizes (`1M`, `2M`) and can match hundreds of products; the engine applies token specificity weighting and limits output to the top 20–30 matches.

---

## Pending Tasks (Stage 3+)

### Stage 3A: FOUR-X Voice Billing Integration
- [x] Integrate voice billing demo workflow and invoice draft line items.
- [x] Integrate Gujarati/Hindi/English browser speech service and editable transcript flow.
- [x] Integrate voice parser, quantity extraction, and multiple-match clarification.
- [x] Integrate Voice Training & Testing page and local common learning memory.
- [x] Route voice-training product searches through the Stage 2 matching service.
- [x] Keep canonical product catalogue unchanged.
- [x] Execute Stage 1 + Stage 2 + Stage 3A integration tests: 30/30 passed using Node 22 built-in TypeScript stripping.
- [ ] Run the Vite production build and package-script `npm test` after dependencies are installed; dependency installation was unavailable in this environment.
- [ ] Manually test microphone permissions, browser speech recognition, and cart flow on the target device.
- [ ] Configure and test a secure Gemini backend if AI interpretation is required.

### Stage 3B: Scanner OCR Billing Integration
- [ ] Integrate camera feed and barcode / label snapshot extraction.
- [ ] Pipe OCR text into `searchProducts()` to leverage Level 1B OCR-embedded code extraction.

### Stage 4: Rack Photo Product Counting Integration
- [ ] Shelf image row detection and item facing segmentation.
- [ ] Map detected shelf units to canonical catalogue records.

---

## File Manifest (Updated)
- `src/data/fourx.json` *(Canonical FOUR-X catalogue, 531 records, 100% untouched)*
- `src/services/productMasterService.ts` *(Product Master loader, indices, and accessors)*
- `src/services/productMatchingService.ts` *(5-tier offline matching engine and in-memory index)*
- `src/components/ProductSearch.tsx` *(Reusable live search UI component)*
- `src/components/dashboard/DashboardOverview.tsx` *(Interactive search testbed & updated roadmap)*
- `tests/fourxIntegrity.test.ts` *(Stage 1 integrity test suite: 8 tests)*
- `tests/productMatching.test.ts` *(Stage 2 matching test suite: 16 tests)*
- `package.json` *(Configured test, test:stage1, and test:stage2 scripts)*
- `PROJECT_STATUS.md` *(Complete project documentation)*


## Stage 3B — Original Scanner Line OCR Integration (2026-11-18)

- Reused the supplied Scanner app's original `GuidedCamera.jsx` and `GalleryScanner.jsx` line-scanning workflows.
- Added Tesseract.js 6 dependency.
- Connected FX code lookup to the canonical `src/data/fourx.json` catalogue (531 records), not the old scanner catalogue JSON.
- Replaced the OCR scaffold with live camera scanning, gallery image scanning, exact SKU variant selection, quantity entry, and OCR bill lines.
- Price/rate calculation remains deferred by explicit project decision.
- Added OCR integration tests for catalogue count, known code variants, and unknown-code rejection.
- Environment validation: npm install timed out in this build environment; production build and full test suite therefore remain to be run locally. Pure OCR-code lookup checks passed in Node.
