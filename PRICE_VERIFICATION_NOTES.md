# Stage 3A – Transcript Summary and Demo Price Entry

## Changes
- Multi-product normalized transcript display now combines the normalized text for every parsed segment using `|` separators instead of showing only the final segment.
- The demo bill now allows a user to enter a manually confirmed unit rate for a line when the canonical catalogue does not contain a mapped/verified price.
- Subtotal includes catalogue-resolved prices and manually entered demo rates. Items with no rate remain excluded and are counted as needing a confirmed rate.
- Manual rates are temporary page state only. They do not modify `src/data/fourx.json`, the live invoice draft, or the original catalogue.

## Important catalogue limitation
The 531-record canonical catalogue is unchanged. Many switch records have `source_price_columns` but `price_column_mapping: "requires_header_review"`, and the source PDF with the price-column headings was not present in this project ZIP. Therefore the app must not guess which column is the correct net/GST price. Enter a rate only after checking the original approved price list. To automate price verification for these records, provide the original catalogue PDF/page or a confirmed mapping of the five source price columns.

## Validation
- Confirmed `src/data/fourx.json` still contains 531 records and 531 unique SKUs.
- Full TypeScript/build/test execution was not run in this environment because dependencies are not installed in this extracted project.
