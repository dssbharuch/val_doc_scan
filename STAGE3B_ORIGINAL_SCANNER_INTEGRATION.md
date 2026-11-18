# Stage 3B — Original Scanner Line OCR Integration

## Source used
The Camera Line Scanner and Gallery Line Scanner components are taken from the supplied `scanner.zip.zip` project:
- `src/components/GuidedCamera.jsx`
- `src/components/GalleryScanner.jsx`
- `tesseract.js` OCR worker flow, camera scan-band crop, adjustable scan-line width, language selection (ENG / GUJ / BOTH), manual rescan control, and candidate text editing.

These original components are now under `src/scanner/components/`.

## Integration changes
- `src/components/modules/OcrBillingModule.tsx` replaces the former placeholder with the real original scanner components.
- The scanner components accept the canonical catalogue as a prop and send selected products to the OCR bill.
- `src/scanner/utils/fourxLookup.js` searches the passed canonical catalogue by numeric FX base code; it does not import the old scanner catalogue.
- `src/data/fourx.json` remains the sole product master and is not edited.
- The OCR bill asks for quantity after the user selects an exact SKU variant. Duplicate SKU selections increase the existing line quantity.
- Price calculation is intentionally not implemented in this stage, per project decision.

## Run
```bash
npm install
npm test
npm run build
npm run dev
```

Camera access requires localhost or HTTPS and browser permission. Test on a device with a rear camera where possible.

## Acceptance checks
1. Live Line Scanner opens and requests camera permission.
2. Gallery Scanner opens a selected image.
3. OCR language can be switched between ENG, GUJ and BOTH.
4. A recognized FX code displays only matching variants from the canonical 531-record catalogue.
5. Unknown FX codes show no match and never create a product.
6. Selecting a SKU prompts for quantity and adds it to the OCR bill.
7. Selecting the same SKU again increments its quantity.
8. Price is not inferred or calculated.
