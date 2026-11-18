import { VoiceTrainingRecord } from '../types/product.ts';
import { norm } from './pronunciationService.ts';

// Local Common Learning Memory. Supabase can replace the storage adapter later
// without changing the App/search flow. JSON export/import moves this memory
// between devices until cloud sync is introduced.
const DB_NAME = 'fourx_db';
const DB_VERSION = 1;
const STORE_NAME = 'training_records';
const LOCAL_STORAGE_KEY = 'fourx_common_voice_memory_v1';
const MEMORY_VERSION = '2.0';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('heard', 'heard', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readLocal(): VoiceTrainingRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      ?? localStorage.getItem('fourx_voice_training_records_v1'); // migrate old key
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(records: VoiceTrainingRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
    localStorage.removeItem('fourx_voice_training_records_v1');
  } catch (error) {
    console.warn('Common voice memory LocalStorage mirror failed:', error);
  }
}

function normalizeRecord(record: Partial<VoiceTrainingRecord>): VoiceTrainingRecord | null {
  const heard = String(record.heard || '').trim();
  const corrected = String(record.corrected || '').trim().toUpperCase();
  if (!heard || !corrected) return null;
  return {
    id: String(record.id || `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    heard,
    corrected,
    manual: record.manual ? String(record.manual).trim() : undefined,
    sku: record.sku ? String(record.sku) : undefined,
    productDescription: record.productDescription ? String(record.productDescription) : undefined,
    updatedAt: record.updatedAt ? String(record.updatedAt) : new Date().toISOString(),
    count: Math.max(1, Number(record.count) || 1),
    category: record.category || 'phrase',
    scope: 'common',
    confirmed: record.confirmed !== false,
    source: record.source || 'user_confirmed',
  };
}

export class TrainingService {
  static async getAll(): Promise<VoiceTrainingRecord[]> {
    try {
      const db = await openDB();
      const rows = await new Promise<VoiceTrainingRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result as VoiceTrainingRecord[]) || []);
        req.onerror = () => reject(req.error);
      });
      let normalized = rows.map(normalizeRecord).filter((r): r is VoiceTrainingRecord => Boolean(r));
      // One-time migration from the previous LocalStorage-only fallback.
      if (normalized.length === 0) {
        const legacy = readLocal();
        if (legacy.length > 0) {
          normalized = legacy.map(normalizeRecord).filter((r): r is VoiceTrainingRecord => Boolean(r));
          const writeTx = db.transaction(STORE_NAME, 'readwrite');
          for (const record of normalized) writeTx.objectStore(STORE_NAME).put(record);
        }
      }
      writeLocal(normalized);
      return normalized;
    } catch {
      return readLocal().map(normalizeRecord).filter((r): r is VoiceTrainingRecord => Boolean(r));
    }
  }

  static async saveRecord(
    heard: string,
    corrected: string,
    options?: {
      manual?: string;
      sku?: string;
      productDescription?: string;
      category?: 'phrase' | 'pronunciation' | 'attribute' | 'word';
      confirmed?: boolean;
      source?: string;
    }
  ): Promise<VoiceTrainingRecord> {
    const trimmedHeard = heard.trim();
    const trimmedCorrected = corrected.trim().toUpperCase();
    if (!trimmedHeard || !trimmedCorrected) throw new Error('Both heard and corrected phrases are required');

    const all = await this.getAll();
    const key = norm(trimmedHeard);
    const existing = all.find((r) => norm(r.heard) === key);
    // A conflicting correction must be consciously resolved; never silently overwrite it.
    if (existing && norm(existing.corrected) !== norm(trimmedCorrected)) {
      throw new Error(`This spoken phrase already maps to "${existing.corrected}". Delete or edit the old mapping before saving a different correction.`);
    }

    const record = normalizeRecord({
      id: existing?.id,
      heard: trimmedHeard,
      corrected: trimmedCorrected,
      manual: options?.manual ?? existing?.manual,
      sku: options?.sku ?? existing?.sku,
      productDescription: options?.productDescription ?? existing?.productDescription,
      updatedAt: new Date().toISOString(),
      count: (existing?.count || 0) + 1,
      category: options?.category || existing?.category || 'phrase',
      confirmed: existing?.confirmed === true || options?.confirmed !== false,
      source: existing?.confirmed === true ? (existing.source || 'user_confirmed') : (options?.source || 'user_confirmed'),
    })!;

    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // LocalStorage fallback below.
    }
    writeLocal([...all.filter((r) => r.id !== record.id), record]);
    return record;
  }

  static async findMatch(spokenText: string): Promise<VoiceTrainingRecord | null> {
    const key = norm(spokenText);
    if (!key) return null;
    const all = (await this.getAll()).filter((r) => r.confirmed !== false);
    const exact = all.filter((r) => norm(r.heard) === key)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    if (exact) return exact;

    // Apply confirmed single-word mappings inside a new phrase. Phrase groups
    // remain exact-match only, preventing unsafe broad substitutions.
    const wordMappings = all.filter((r) => r.category === 'word' && norm(r.heard).split(' ').length === 1)
      .sort((a, b) => norm(b.heard).length - norm(a.heard).length);
    const tokens = spokenText.split(/(\s+)/);
    let changed = false;
    const correctedTokens = tokens.map((token) => {
      if (!token.trim()) return token;
      const mapping = wordMappings.find((r) => norm(r.heard) === norm(token));
      if (!mapping) return token;
      changed = true;
      return mapping.corrected;
    });
    if (!changed) return null;
    return {
      id: 'composed_common_memory', heard: spokenText,
      corrected: correctedTokens.join(' '), updatedAt: new Date().toISOString(),
      count: 1, category: 'phrase', scope: 'common', confirmed: true,
      source: 'common_word_mapping',
    };
  }

  static async deleteRecord(id: string): Promise<void> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch { /* LocalStorage fallback below */ }
    writeLocal((await this.getAll()).filter((r) => r.id !== id));
  }

  static async clearAll(): Promise<void> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch { /* LocalStorage fallback below */ }
    writeLocal([]);
  }

  static async exportJSON(): Promise<string> {
    const records = (await this.getAll()).filter((r) => r.confirmed !== false);
    return JSON.stringify({
      format: 'FOURX_COMMON_VOICE_MEMORY',
      version: MEMORY_VERSION,
      scope: 'common',
      exportedAt: new Date().toISOString(),
      count: records.length,
      records,
    }, null, 2);
  }

  // Imports merge into local memory. Existing conflicting mappings are not overwritten.
  static async importJSON(jsonStr: string): Promise<number> {
    const parsed = JSON.parse(jsonStr);
    const rawItems: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
      ? parsed.records
      : Array.isArray(parsed?.mappings)
      ? parsed.mappings
      : [];
    if (!rawItems.length) throw new Error('No training records found in JSON');

    let imported = 0;
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue;
      const item = normalizeRecord(raw as Partial<VoiceTrainingRecord>);
      if (!item || item.confirmed === false) continue;
      const all = await this.getAll();
      const existing = all.find((r) => norm(r.heard) === norm(item.heard));
      if (existing) {
        if (norm(existing.corrected) !== norm(item.corrected)) continue;
        // Same mapping: merge usage count and preserve the most recent metadata.
        const merged = normalizeRecord({
          ...existing,
          ...item,
          id: existing.id,
          count: Math.max(existing.count || 1, item.count || 1),
          updatedAt: (existing.updatedAt || '') > (item.updatedAt || '') ? existing.updatedAt : item.updatedAt,
        })!;
        await this.putRecord(merged);
      } else {
        await this.putRecord(item);
      }
      imported++;
    }
    return imported;
  }

  private static async putRecord(record: VoiceTrainingRecord): Promise<void> {
    const all = await this.getAll();
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch { /* LocalStorage fallback */ }
    writeLocal([...all.filter((r) => r.id !== record.id), record]);
  }
}
