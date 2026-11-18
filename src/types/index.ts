/**
 * ONE RETAIL AI - Core Type Definitions
 * 
 * Defines the unified module structure for:
 * 1. Voice Product Billing (FOUR-X origin)
 * 2. Camera/OCR Product Billing (Scanner OCR origin)
 * 3. Rack Photo Product Counting (Shelf/Inventory Vision origin)
 */

export type ActiveModuleId = 'dashboard' | 'voice-billing' | 'ocr-billing' | 'rack-counting';

export type IntegrationStatus = 'scaffold_ready' | 'awaiting_code' | 'awaiting_catalogue';

export interface RetailModuleConfig {
  id: Exclude<ActiveModuleId, 'dashboard'>;
  name: string;
  sourceOrigin: string;
  badge: string;
  description: string;
  plannedInputs: string[];
  plannedOutputs: string[];
  integrationNote: string;
}
