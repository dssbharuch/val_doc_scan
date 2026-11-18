/**
 * FOUR-X Voice compatibility adapter.
 * Maps the immutable canonical Stage 1 product records to the legacy voice
 * ProductRecord shape at runtime. It does not copy or modify catalogue data.
 */
import { getFourxCatalogue } from '../../services/productMasterService.ts';
import type { ProductRecord } from '../types/product.ts';

export function getVoiceCatalogue(): ProductRecord[] {
  // The legacy voice parser only reads these records. Keep canonical records
  // read-only and avoid maintaining a second JSON catalogue.
  return getFourxCatalogue() as unknown as ProductRecord[];
}
