import type { InterpretationResult } from '../types/product.ts';
import { toEnglishSearchWords, parseAttrs } from './pronunciationService.ts';

/**
 * Calls the same-origin Express proxy. The server decides whether local rules,
 * Gemini text, or (only as a last resort) Gemini audio is required.
 * The Gemini API key never leaves the server.
 */
export async function interpretVoicePhrase(
  transcript: string,
  languageHint?: string,
  audioBlob?: Blob | null,
  forceGemini = false,
  expectedPhrase = ''
): Promise<InterpretationResult> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { originalTranscript: '', correctedPhrase: '', reasoning: 'Empty transcript', confidence: 0 };
  }
  // Global Gemini switch: when disabled, every app flow (including test tools)
  // stays local and never reaches the Express/Gemini endpoint.
  if (typeof window !== 'undefined' && window.localStorage.getItem('fourx_gemini_enabled') === 'false') {
    const canonicalText = toEnglishSearchWords(trimmed);
    const attrs = parseAttrs(canonicalText);
    return {
      originalTranscript: trimmed,
      correctedPhrase: canonicalText,
      detectedLanguage: /[\u0a80-\u0aff]/.test(trimmed) ? 'gujarati' : /[\u0900-\u097f]/.test(trimmed) ? 'hindi' : 'mixed',
      brandOrFamily: attrs.brand,
      productType: attrs.productType,
      switchType: attrs.switchType,
      ampere: attrs.amp ? `${attrs.amp} AMP` : undefined,
      module: attrs.module,
      variant: attrs.variant,
      indicator: attrs.indicator,
      unresolvedTokens: attrs.unresolvedNumbers,
      reasoning: 'Gemini is OFF; local phonetic rules only',
      confidence: 0.6,
      source: 'local_only',
      geminiAttempted: false,
    };
  }

  // Stage 3A frontend has no Gemini proxy configured. Do not issue a browser
  // request to a missing endpoint; retain deterministic local interpretation.
  const configuredEndpoint = typeof window !== 'undefined'
    ? window.localStorage.getItem('one_retail_gemini_endpoint')
    : null;
  if (!configuredEndpoint) {
    const canonicalText = toEnglishSearchWords(trimmed);
    const attrs = parseAttrs(canonicalText);
    return {
      originalTranscript: trimmed,
      correctedPhrase: canonicalText,
      detectedLanguage: /[\u0a80-\u0aff]/.test(trimmed) ? 'gujarati' : /[\u0900-\u097f]/.test(trimmed) ? 'hindi' : 'mixed',
      brandOrFamily: attrs.brand,
      productType: attrs.productType,
      switchType: attrs.switchType,
      ampere: attrs.amp ? `${attrs.amp} AMP` : undefined,
      module: attrs.module,
      variant: attrs.variant,
      indicator: attrs.indicator,
      unresolvedTokens: attrs.unresolvedNumbers,
      reasoning: 'Secure Gemini backend is not configured; local phonetic and seed vocabulary rules used.',
      confidence: attrs.amp ? 0.65 : 0.5,
      source: 'local_only',
      geminiAttempted: false,
      fallbackReason: 'No secure Gemini proxy endpoint configured.',
    };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), audioBlob ? 45000 : 20000);
    let audioBase64: string | undefined;

    // Convert to base64 only for a bounded, short recording. Audio is sent only
    // when the caller already determined that local matching is uncertain.
    if (audioBlob && audioBlob.size > 0 && audioBlob.size <= 7.5 * 1024 * 1024) {
      const bytes = new Uint8Array(await audioBlob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
      }
      audioBase64 = btoa(binary);
    }

    const response = await fetch(configuredEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: trimmed,
        forceGemini,
        expectedPhrase,
        languageHint: languageHint || 'English product words; Gujarati/Hindi numbers and quantity units',
        ...(audioBase64 ? { audioBase64, audioMimeType: (audioBlob?.type || 'audio/webm').split(';')[0] } : {}),
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.result) return { ...data.result, source: data.source, model: data.model, geminiAttempted: data.geminiAttempted, geminiStatus: data.geminiStatus, fallbackReason: data.fallbackReason } as InterpretationResult;
    }
    throw new Error(`Voice interpretation endpoint returned HTTP ${response.status}`);
  } catch (err) {
    console.warn('Hybrid interpretation proxy unavailable; using local fallback:', err);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const canonicalText = toEnglishSearchWords(trimmed);
  const attrs = parseAttrs(canonicalText);
  return {
    originalTranscript: trimmed,
    correctedPhrase: canonicalText,
    detectedLanguage: /[\u0a80-\u0aff]/.test(trimmed) ? 'gujarati' : /[\u0900-\u097f]/.test(trimmed) ? 'hindi' : 'mixed',
    brandOrFamily: attrs.brand,
    productType: attrs.productType,
    switchType: attrs.switchType,
    ampere: attrs.amp ? attrs.amp + ' AMP' : undefined,
    module: attrs.module,
    variant: attrs.variant,
    indicator: attrs.indicator,
    unresolvedTokens: attrs.unresolvedNumbers,
    reasoning: 'Interpreted via client-side phonetic and seed dictionary rules; server unavailable',
    confidence: attrs.amp ? 0.65 : 0.5,
    source: 'local_fallback',
  };
}
