import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, AudioLines, Mic, MicOff, RotateCcw, Languages
} from 'lucide-react';
import { speechService, type SupportedLanguage } from '../services/speechService.ts';
import { searchProducts } from '../services/productSearchService.ts';
import { nearestCatalogueWord, convertVernacularDigits } from '../services/pronunciationService.ts';
import { interpretVoicePhrase } from '../services/geminiService.ts';
import { normalizeVoicePhrase } from '../services/voicePhraseRules.ts';


// Minimum unique vocabulary extracted from the 68 SWITCH voice commands.
// This demo deliberately tests recognition only; it does not resolve catalogue SKUs.
const MINIMUM_WORDS = [
  'GRACE', 'GLIDE', 'GLAM', 'F', 'TOUCH',
  '1', '2', '4', '5', '6', '10', '16', '20', '25', '32',
  'AMP', 'INDICATOR', 'TWO', 'ONE', 'WAY', 'WITH', 'WITHOUT', 'WHITE', 'BLACK', 'RED', 'CHROME', 'BELL', 'PUSH', 'DP', 'SWITCH',
  'MOTOR', 'STARTER', 'BLANK', 'PLATE', 'CALL', 'ELECTRONIC', 'BUZZER',
  'MAIN', 'KEY', 'TAG', 'MOTION', 'SENSOR', 'WAVE', 'EACH', '1M', '2M',
  'CHROME', 'NANG', 'NAG', 'PIECE',
];

const SPOKEN_ALIASES: Record<string, string> = {
  GRAC: 'GRACE', GRASE: 'GRACE', GRAYS: 'GRACE',
  CLAIM: 'GLAM',
  GLID: 'GLIDE', GLAIK: 'GLIDE', GLYDE: 'GLIDE',
  DAS: '10', TEN: '10', '1O': '10', VEES: '20', BEES: '20', TWENTY: '20',
  PANCH: '5', PAANCH: '5', FIVE: '5', FOUR: '4', SIX: '6', EK: '1', ONE: '1',
  SOL: '16', SIXTEEN: '16', PACHIS: '25', BATTIS: '32', THIRTYTWO: '32',
  AMPERE: 'AMP', AMPER: 'AMP', AMPERES: 'AMP', APP: 'AMP',
  INDICATER: 'INDICATOR', INDICATORR: 'INDICATOR',
  BILL: 'BELL', BAILPUR: 'BELL', BELPUR: 'BELL', BELLPUR: 'BELL',
  BAZAR: 'BUZZER', BAZAAR: 'BUZZER',
  KI: 'KEY', KEE: 'KEY',
  NUG: 'NANG', NAAM: 'NANG', NAM: 'NANG', PIECES: 'PIECE', PCS: 'PIECE',
  'FTOUCH': 'F', 'F-TOUCH': 'F',
  'BLANKPLATE': 'BLANK', 'CALLBELL': 'CALL',
  'MOTIONSENSOR': 'MOTION', 'KEYTAG': 'KEY',
  'ELECTRONICBUZZER': 'ELECTRONIC',
};


const PRODUCT_COMBINATION_TESTS = [
  { id: 1, group: 'GRACE', phrase: 'Grace' },
  { id: 2, group: 'GRACE', phrase: 'Grace 20 Amp' },
  { id: 3, group: 'GRACE', phrase: 'Grace 25 Amp' },
  { id: 4, group: 'GRACE', phrase: 'Grace two way' },
  { id: 5, group: 'GRACE', phrase: 'Grace bell push with indicator' },
  { id: 6, group: 'GRACE', phrase: 'Grace 20 Amp two way 2M' },
  { id: 7, group: 'GLIDE', phrase: 'Glide 20 Amp one way chrome' },
  { id: 8, group: 'GLIDE', phrase: 'Glide bell push' },
  { id: 9, group: 'GLIDE', phrase: 'Glide indicator 2M' },
  { id: 10, group: 'GLIDE', phrase: 'Glide 20 Amp two way' },
  { id: 11, group: 'GLIDE', phrase: 'Glide bell push with indicator 2M' },
  { id: 12, group: 'GLAM', phrase: 'Glam' },
  { id: 13, group: 'GLAM', phrase: 'Glam 20 Amp indicator' },
  { id: 14, group: 'GLAM', phrase: 'Glam 32 Amp DP indicator 2M' },
  { id: 15, group: 'SPECIAL', phrase: '16 Amp motor starter 2M' },
  { id: 16, group: 'SPECIAL', phrase: '25 Amp motor starter 2M' },
  { id: 17, group: 'SPECIAL', phrase: '32 Amp DP main switch with key tag 2M' },
  { id: 18, group: 'SPECIAL', phrase: 'Electronic buzzer 2M' },
  { id: 19, group: 'SPECIAL', phrase: 'Blank plate' },
  { id: 20, group: 'SPECIAL', phrase: 'Call bell with indicator' },
  { id: 21, group: 'SPECIAL', phrase: '5 Amp motion sensor 2M' },
  { id: 22, group: 'SPECIAL', phrase: '5 Amp wave switch 2M' },
  { id: 23, group: 'F TOUCH', phrase: 'F Touch 6 Amp 2 switch each 2M' },
];

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return row[b.length];
}

function phoneticKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    .replace(/[AEIOU]/g, '').replace(/PH/g, 'F').replace(/CK/g, 'K')
    .replace(/Q/g, 'K').replace(/Z/g, 'S').replace(/(.)\1+/g, '$1');
}

type MatchRow = { heard: string; matched: string; exact: boolean; status: 'EXACT' | 'PHONETIC' | 'UNMATCHED' };
type TransformResult = { transformed: string; rows: MatchRow[]; source?: string; confidence?: number; audioUsed?: boolean };

function resolveVocabularyToken(token: string, previousToken = '', nextToken = '', fullPhrase = ''): MatchRow {
  const heard = token.toUpperCase();
  const previous = previousToken.toUpperCase();
  const next = nextToken.toUpperCase();
  const phrase = fullPhrase.toUpperCase();

  // Phrase-level ASR repairs: only activate when neighbouring product vocabulary supports them.
  if (heard === 'PUSS' && previous === 'BELL') return { heard, matched: 'PUSH', exact: false, status: 'PHONETIC' };
  if ((heard === 'POSE' || heard === 'BAIL' || heard === 'BALE') && (previous === 'BELL' || /\bBELL\s+(?:POSE|BAIL|BALE)\b/.test(phrase))) return { heard, matched: 'PUSH', exact: false, status: 'PHONETIC' };
  if (heard === 'GREAT' && /\b(SWITCH|AMP|AMPERE|WAY|INDICATOR|BELL|PUSH)\b/.test(phrase)) {
    return { heard, matched: 'GRACE', exact: false, status: 'PHONETIC' };
  }
  if (heard === 'ONE' && next === 'WAY') {
    return { heard, matched: 'ONE', exact: true, status: 'EXACT' };
  }
  if ((heard === 'TO' || heard === 'TWO') && (next === 'WAY' || next === 'WEIGHT' || next === 'VE' || next === 'VAY')) {
    return { heard, matched: 'TWO', exact: heard === 'TWO', status: heard === 'TWO' ? 'EXACT' : 'PHONETIC' };
  }
  // Context-only ASR correction: 'to module' means the product attribute TWO MODULE.
  // Do not map a standalone 'TO' to TWO; that would corrupt unrelated speech.
  if (heard === 'TO' && next === 'MODULE') {
    return { heard, matched: 'TWO', exact: false, status: 'PHONETIC' };
  }
  if (heard === 'MODULE') {
    return { heard, matched: 'MODULE', exact: true, status: 'EXACT' };
  }
  if ((heard === 'VE' || heard === 'VAY' || heard === 'WAY' || heard === 'WEIGHT') && (previous === 'TO' || previous === 'TWO')) {
    return { heard, matched: 'WAY', exact: heard === 'WAY', status: heard === 'WAY' ? 'EXACT' : 'PHONETIC' };
  }
  if (heard === 'ELECTRIC' && (next === 'BUZZER' || /\bBUZZER\b/.test(phrase))) {
    return { heard, matched: 'ELECTRONIC', exact: false, status: 'PHONETIC' };
  }

  const alias = SPOKEN_ALIASES[heard];
  if (alias) return { heard, matched: alias, exact: false, status: 'PHONETIC' };
  if (MINIMUM_WORDS.includes(heard)) {
    return { heard, matched: heard, exact: true, status: 'EXACT' };
  }
  if (/^\d+$/.test(heard)) {
    return { heard, matched: heard, exact: true, status: 'EXACT' };
  }

  // Match against actual catalogue vocabulary, not just the small demo word list.
  const catalogueMatch = nearestCatalogueWord(heard);
  if (catalogueMatch && catalogueMatch.score >= 0.72) {
    return { heard, matched: catalogueMatch.word.toUpperCase(), exact: false, status: 'PHONETIC' };
  }
  return { heard, matched: 'UNMATCHED', exact: false, status: 'UNMATCHED' };
}

function tokenizeSpeech(text: string): string[] {
  const gujaratiNumberWords: Record<string, string> = { 'એક': '1', 'બે': '2', 'ત્રણ': '3', 'ચાર': '4', 'પાંચ': '5', 'છ': '6', 'સાત': '7', 'આઠ': '8', 'નવ': '9', 'દસ': '10', 'સોળ': '16', 'વીસ': '20', 'પચ્ચીસ': '25', 'બત્રીસ': '32' };
  const hindiNumberWords: Record<string, string> = { 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5', 'छह': '6', 'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10', 'सोलह': '16', 'बीस': '20', 'पच्चीस': '25', 'बत्तीस': '32' };
  const quantityWords: Record<string, string> = { 'નંગ': 'NANG', 'નગ': 'NANG', 'નંગો': 'NANG', 'नंग': 'NANG', 'नग': 'NANG', 'पीस': 'PIECE' };
  const phraseInput = normalizeVoicePhrase(text);
  const normalizedInput = phraseInput.replace(/[\u0a80-\u0aff]+|[\u0900-\u097f]+/g, (word) => gujaratiNumberWords[word] || hindiNumberWords[word] || quantityWords[word] || word);
  return normalizedInput.toUpperCase()
    .replace(/[૦-૯]/g, (d) => String('૦૧૨૩૪૫૬૭૮૯'.indexOf(d)))
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/\bONE\s+M(?:ODULE)?\b/g, ' 1M ')
    .replace(/\bTWO\s+M(?:ODULE)?\b/g, ' 2M ')
    .replace(/\bF\s*[- ]?\s*TOUCH\b/g, ' F TOUCH ')
    .replace(/\bTWO\s+WAY\b/g, ' TWO WAY ')
    .replace(/\bTWENTY\s+FIVE\b/g, ' 25 ')
    .replace(/\bTHIRTY\s+TWO\b/g, ' 32 ')
    .replace(/\bONE\b/g, ' ONE ')
    .replace(/\bTWO\b/g, ' TWO ')
    .match(/[A-Z]+|\d+M?|[^\s,.;]+/g) || [];
}

function transformRecognizedWords(raw: string, expectedPhrase = ''): TransformResult {
  // Canonicalize multi-word switch attributes BEFORE tokenization. This avoids
  // treating browser ASR 'to way' as two unrelated exact words and prevents a
  // later default ONE WAY from contradicting an explicitly spoken TWO WAY.
  const phraseForMatching = normalizeVoicePhrase(raw, expectedPhrase)
    .replace(/\b(?:TO|TOO|TU)\s+(?:WAY|WEIGHT|VE|VAY)\b/gi, 'TWO WAY')
    .replace(/\b(?:TO|TOO|TU)\s+(?:MODULE|MODUL)\b/gi, 'TWO MODULE');
  const tokens = tokenizeSpeech(convertVernacularDigits(phraseForMatching));
  const rows: MatchRow[] = [];
  const fullPhrase = tokens.join(' ');
  for (let i = 0; i < tokens.length; i++) {
    const heard = tokens[i];
    const previous = tokens[i - 1] || '';
    const next = tokens[i + 1] || '';
    rows.push(resolveVocabularyToken(heard, previous, next, fullPhrase));
  }
  // Keep the original ASR phrase visible in the mapping table while Stage 2 uses canonical tokens.
  if (/\bBELL\s+PUSS\b/i.test(raw)) {
    const pushRow = rows.find((row) => row.matched === 'PUSH');
    if (pushRow) { pushRow.heard = 'PUSS'; pushRow.status = 'PHONETIC'; pushRow.exact = false; }
  }
  if (/\bTO\s+MODULE\b/i.test(raw)) {
    const moduleRow = rows.find((row) => row.matched === '2M' || row.matched === 'MODULE');
    if (moduleRow) { moduleRow.heard = 'TO MODULE'; moduleRow.matched = '2M'; moduleRow.status = 'PHONETIC'; moduleRow.exact = false; }
  }
  if (/\b(?:TO|TOO|TU)\s+(?:WAY|WEIGHT|VE|VAY)\b/i.test(raw)) {
    const twoRow = rows.find((row) => row.matched === 'TWO');
    const wayRow = rows.find((row) => row.matched === 'WAY');
    if (twoRow) { twoRow.heard = raw.match(/\b(?:TO|TOO|TU)\b/i)?.[0] || 'TO'; twoRow.status = 'PHONETIC'; twoRow.exact = false; }
    if (wayRow) { wayRow.heard = raw.match(/\b(?:WAY|WEIGHT|VE|VAY)\b/i)?.[0] || wayRow.heard; wayRow.status = wayRow.heard === 'WAY' ? 'EXACT' : 'PHONETIC'; wayRow.exact = wayRow.heard === 'WAY'; }
  }
  const transformed = rows.map((row) => row.matched === 'UNMATCHED' ? `[${row.heard}]` : row.matched).join(' ');
  return { transformed, rows };
}

function buildProductSearchPhrase(rows: MatchRow[]): string {
  const matched = rows.filter((row) => row.status !== 'UNMATCHED').map((row) => row.matched);
  // Quantity is retained in Stage 2 for visibility, but is not a catalogue attribute.
  return matched.join(' ')
    .replace(/\bTWO\s+MODULE\b/gi, '2M')
    .replace(/\bONE\s+MODULE\b/gi, '1M')
    .replace(/\b\d+\s+(?:PIECE(?:S)?|NANG|NAG)\b/gi, '')
    .replace(/\b(?:PIECE(?:S)?|NANG|NAG)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
}

function getProductClarificationText(result: ReturnType<typeof searchProducts>): string[] {
  const products = result.results || [];
  if (products.length < 2) return [];
  const fields = [
    { label: 'Colour', get: (p: any) => String(p.product.variant || p.product.colour_code || '').trim() },
    { label: 'Module', get: (p: any) => (String(p.product.item_name || p.product.description || '').match(/\b\d+M\b/i)?.[0] || '').toUpperCase() },
    { label: 'Ampere', get: (p: any) => (String(p.product.item_name || p.product.description || '').match(/\b\d+\s*AMP\b/i)?.[0] || '').toUpperCase() },
    { label: 'Switch type', get: (p: any) => /TWO WAY/i.test(`${p.product.item_name} ${p.product.description}`) ? 'TWO WAY' : /ONE WAY/i.test(`${p.product.item_name} ${p.product.description}`) ? 'ONE WAY' : '' },
    { label: 'Indicator', get: (p: any) => /WITH INDICATOR/i.test(`${p.product.item_name} ${p.product.description}`) ? 'WITH INDICATOR' : /WITHOUT INDICATOR/i.test(`${p.product.item_name} ${p.product.description}`) ? 'WITHOUT INDICATOR' : '' },
  ];
  return fields.filter((field) => new Set(products.map(field.get).filter(Boolean)).size > 1)
    .map((field) => `${field.label}: ${[...new Set(products.map(field.get).filter(Boolean))].join(' / ')}`);
}

// Browser SpeechRecognition may return several hypotheses for the same audio chunk.
// Prefer the hypothesis that contains the greatest number of valid vocabulary words,
// but keep the browser's top transcript visible as the untouched Stage 1 result.
function selectVocabularyAlternative(primary: string, alternatives: string[]): string {
  const candidates = [...new Set([primary, ...alternatives].map((value) => value.trim()).filter(Boolean))];
  const score = (candidate: string) => {
    const rows = transformRecognizedWords(candidate).rows;
    const matched = rows.filter((row) => row.status !== 'UNMATCHED').length;
    const exact = rows.filter((row) => row.status === 'EXACT').length;
    return matched * 10 + exact * 2 - rows.filter((row) => row.status === 'UNMATCHED').length;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0] || primary;
}


export const VoiceTrainingTestingPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  // Product words are spoken in English; Gujarati digits are normalized by speechNormalizer.
  const [language] = useState<SupportedLanguage>('en-IN');
  const [listening, setListening] = useState(false);
  const [rawTranscript, setRawTranscript] = useState('');
  const [candidateTranscript, setCandidateTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [status, setStatus] = useState('Ready. Speak the minimum vocabulary words, then say OK OK.');
  const [batchMode, setBatchMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const addProcessingStep = (step: string) => setProcessingSteps((previous) => [...previous, step]);
  const transcriptBuffer = useRef('');
  const candidateBuffer = useRef('');
  const interimBuffer = useRef('');
  const manualStopPendingRef = useRef(false);
  const finalizedRef = useRef(false);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioStopPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const audioCaptureRequestedRef = useRef(false);

  const [transformedResult, setTransformedResult] = useState<TransformResult | null>(null);
  const [soundLevels, setSoundLevels] = useState<number[]>(Array(32).fill(3));
  const [micLevel, setMicLevel] = useState(0);
  const [testMode, setTestMode] = useState<'vocabulary' | 'products'>('vocabulary');
  const [selectedProductTest, setSelectedProductTest] = useState(PRODUCT_COMBINATION_TESTS[0]);
  const [productMatch, setProductMatch] = useState<ReturnType<typeof searchProducts> | null>(null);
  const [productClarifications, setProductClarifications] = useState<string[]>([]);

  // Visual-only microphone meter. It does not feed audio into speech recognition.
  // Sampling is throttled to ~14 updates/second to keep UI work lightweight.
  useEffect(() => {
    if (!listening || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setSoundLevels(Array(32).fill(3));
      setMicLevel(0);
      return;
    }

    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let animationFrame = 0;
    let lastUpdate = 0;
    let cancelled = false;

    const startMeter = async () => {
      try {
        const activeStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        stream = activeStream;
        if (cancelled) { activeStream.getTracks().forEach((track) => track.stop()); return; }
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') await audioContext.resume();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        audioContext.createMediaStreamSource(activeStream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const tick = (time: number) => {
          if (cancelled) return;
          animationFrame = requestAnimationFrame(tick);
          if (time - lastUpdate < 70) return;
          lastUpdate = time;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i++) { const value = (samples[i] - 128) / 128; sum += value * value; }
          const rms = Math.sqrt(sum / samples.length);
          const level = Math.min(100, Math.round(rms * 360));
          setMicLevel(level);
          setSoundLevels((previous) => [...previous.slice(1), Math.max(3, level)]);
        };
        animationFrame = requestAnimationFrame(tick);
      } catch {
        // The meter is optional: speech recognition must continue even if a second mic stream is unavailable.
      }
    };

    void startMeter();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== 'closed') void audioContext.close();
      setMicLevel(0);
    };
  }, [listening]);

  useEffect(() => () => { audioCaptureRequestedRef.current = false; speechService.stopListening(); audioRecorderRef.current?.stop(); audioStreamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  // Audio is recorded locally as a short-lived fallback only. It is not uploaded unless
  // local phrase matching is uncertain and the text interpretation endpoint requests it.
  const startAudioCapture = async () => {
    audioCaptureRequestedRef.current = true;
    audioStopPromiseRef.current = null;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!audioCaptureRequestedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      audioRecorderRef.current = recorder;
      audioStopPromiseRef.current = new Promise((resolve) => {
        recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data); };
        recorder.onstop = () => {
          const blob = audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }) : null;
          audioBlobRef.current = blob;
          stream.getTracks().forEach((track) => track.stop());
          if (audioStreamRef.current === stream) audioStreamRef.current = null;
          if (audioRecorderRef.current === recorder) audioRecorderRef.current = null;
          resolve(blob);
        };
      });
      recorder.start(300);
    } catch (error) {
      console.warn('Optional audio fallback capture unavailable:', error);
      audioBlobRef.current = null;
    }
  };

  const stopAudioCapture = async (): Promise<Blob | null> => {
    audioCaptureRequestedRef.current = false;
    const recorder = audioRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* recorder may already be stopping */ }
    }
    if (audioStopPromiseRef.current) {
      try { return await audioStopPromiseRef.current; } catch { return audioBlobRef.current; }
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    return audioBlobRef.current;
  };

  // Shared finalization path for the spoken OK OK command and the on-screen STOP button.
  // The guard prevents duplicate product searches if speechService emits a late stop callback.
  const finalizeCapturedSpeech = async (source: 'voice command' | 'manual stop') => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setProcessing(true);
    setProcessingSteps(['STOP received · closing microphone and speech recognition…']);
    setStatus('STOP received. Preparing captured speech…');
    const fallbackAudio = await stopAudioCapture();
    addProcessingStep(fallbackAudio ? `Audio buffer ready · ${Math.round(fallbackAudio.size / 1024)} KB held temporarily for fallback` : 'Audio fallback buffer unavailable · text processing will continue');
    const finalText = transcriptBuffer.current.trim();
    const interimText = interimBuffer.current.trim();
    // Web Speech API may keep the last phrase interim until stop() is requested.
    // Preserve that visible phrase if the browser never emits a final result.
    const complete = [finalText, interimText && !finalText.toLowerCase().endsWith(interimText.toLowerCase()) ? interimText : '']
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const candidate = testMode === 'products' ? complete : (candidateBuffer.current.trim() || complete);
    setRawTranscript(complete);
    setCandidateTranscript(candidate);
    addProcessingStep(complete ? 'Stage 1 complete · original browser transcript preserved' : 'Stage 1 complete · no speech transcript received');
    setLiveTranscript(complete || liveTranscript);
    interimBuffer.current = '';
    manualStopPendingRef.current = false;
    setBatchMode(false);
    setListening(false);

    if (testMode === 'products' && candidate) {
      addProcessingStep('Stage 2 · checking local catalogue vocabulary and phrase-level phonetic rules…');
      const localStage2 = transformRecognizedWords(candidate, selectedProductTest.phrase);
      const localSearchPhrase = buildProductSearchPhrase(localStage2.rows);
      const localProductResult = searchProducts(localSearchPhrase, 'Input 2', { applyDefaults: true });
      const unmatchedCount = localStage2.rows.filter((row) => row.status === 'UNMATCHED').length;
      const localConfidence = localStage2.rows.length ? localStage2.rows.filter((row) => row.status !== 'UNMATCHED').length / localStage2.rows.length : 0;
      const expectedCoreMismatch = testMode === 'products' && /\b(GRACE|GLIDE|GLAM)\b/i.test(selectedProductTest.phrase) && !new RegExp('\\b' + selectedProductTest.group + '\\b', 'i').test(localSearchPhrase);
      const needsAi = unmatchedCount > 0 || localConfidence < 0.88 || !localSearchPhrase || localProductResult.totalMatches === 0 || expectedCoreMismatch;
      addProcessingStep(`Local confidence ${Math.round(localConfidence * 100)}% · ${unmatchedCount} unmatched token(s) · Gemini trigger ${needsAi ? 'ON' : 'not required'}`);
      addProcessingStep(`Local analysis complete · ${localStage2.rows.length - unmatchedCount}/${localStage2.rows.length} tokens matched; ${localProductResult.totalMatches} preliminary catalogue results`);
      let stage2: TransformResult = localStage2;
      let productResult = localProductResult;
      let aiNote = '';

      if (needsAi) {
        addProcessingStep('Gemini Text · local confidence insufficient; sending transcript and selected command context…');
        setStatus('Gemini Text interpretation running…');
        try {
          const interpreted = await interpretVoicePhrase(candidate, 'English product words; Gujarati/Hindi numbers and quantity units', fallbackAudio, true, selectedProductTest.phrase);
          const corrected = String(interpreted.correctedPhrase || '').trim();
          if (interpreted.source === 'gemini_audio_fallback') addProcessingStep('Gemini Audio · response received; audio fallback used after text uncertainty');
          else if (interpreted.source === 'gemini_text') addProcessingStep(`Gemini Text · response received from ${interpreted.model || 'configured model'} · confidence ${Math.round(Number(interpreted.confidence || 0) * 100)}%`);
          else if (interpreted.source === 'local_only') addProcessingStep(`Gemini NOT CALLED · ${interpreted.fallbackReason || 'API key missing'}`);
          else if (interpreted.source === 'local_fallback') addProcessingStep(`Gemini FAILED · local fallback retained · ${interpreted.fallbackReason || 'check server log and API configuration'}`);
          else addProcessingStep(`Interpretation source: ${interpreted.source || 'unknown'} · confidence ${Math.round(Number(interpreted.confidence || 0) * 100)}%`);
          if (corrected) {
            stage2 = {
              transformed: corrected,
              rows: corrected.toUpperCase().split(/\s+/).filter(Boolean).map((word, index) => ({
                heard: (candidate.toUpperCase().match(/[A-Z0-9]+/g) || [])[index] || word,
                matched: word,
                exact: ((candidate.toUpperCase().match(/[A-Z0-9]+/g) || [])[index] || '').replace(/[^A-Z0-9]/g, '') === word.replace(/[^A-Z0-9]/g, ''),
                status: (((candidate.toUpperCase().match(/[A-Z0-9]+/g) || [])[index] || '').replace(/[^A-Z0-9]/g, '') === word.replace(/[^A-Z0-9]/g, '') ? 'EXACT' : 'PHONETIC'),
              })),
              source: interpreted.source || 'local_fallback',
              confidence: Number(interpreted.confidence || 0),
              audioUsed: interpreted.source === 'gemini_audio_fallback',
            };
            // Never search using an empty or unresolved AI phrase. Preserve the local phrase as fallback.
            const unresolved = Array.isArray(interpreted.unresolvedTokens) ? interpreted.unresolvedTokens : [];
            const searchPhrase = corrected;
            addProcessingStep('Stage 2 complete · corrected phrase and attributes prepared');
            if (searchPhrase) {
              addProcessingStep('Catalogue search · searching the local 531-record product database…');
              productResult = searchProducts(searchPhrase, 'Input 2', { applyDefaults: true });
              addProcessingStep(`Catalogue search complete · ${productResult.totalMatches} matching result(s)`);
            }
            aiNote = `${interpreted.source || 'AI'} · confidence ${Math.round(Number(interpreted.confidence || 0) * 100)}%${stage2.audioUsed ? ' · audio fallback used' : ''}${unresolved.length ? ` · unresolved: ${unresolved.join(', ')}` : ''}${(interpreted as any).fallbackReason ? ` · ${(interpreted as any).fallbackReason}` : ''}`;
          }
        } catch (error) {
          console.warn('Hybrid interpretation failed; keeping local catalogue result:', error);
          aiNote = 'AI unavailable; local catalogue matching retained.';
        }
      }

      setTransformedResult(stage2);
      setProductMatch(productResult);
      setProductClarifications(getProductClarificationText(productResult));
      const resultText = productResult.totalMatches === 1
        ? 'One catalogue result found. Verify description and SKU.'
        : productResult.totalMatches > 1
          ? 'Multiple catalogue results found; clarify before selection.'
          : 'No catalogue result; review transcript and attributes.';
      setStatus(`${source === 'manual stop' ? 'Stopped manually. ' : 'OK OK received. '}${resultText}${aiNote ? ` ${aiNote}` : ''}`);
      addProcessingStep(`Finished · ${resultText}`);
      setProcessing(false);
      // Drop the local audio blob after this turn; it is not persisted in browser storage.
      audioBlobRef.current = null;
      audioChunksRef.current = [];
    } else {
      setTransformedResult(candidate ? transformRecognizedWords(candidate) : null);
      setProductMatch(null);
      setProductClarifications([]);
      setStatus(source === 'manual stop'
        ? (complete ? 'Listening stopped. Phonetic matching completed against the minimum word list.' : 'Listening stopped, but no speech was captured.')
        : (complete ? 'OK OK received. Phonetic matching completed against the minimum word list.' : 'OK OK received, but no speech was captured.'));
      addProcessingStep(complete ? 'Minimum vocabulary matching complete' : 'Finished · no speech captured');
      setProcessing(false);
    }
  };

  const stopMic = (finalize = false) => {
    if (finalize && batchMode && !finalizedRef.current) {
      // Ask the browser to flush its final recognition result before processing.
      manualStopPendingRef.current = true;
      speechService.stopListening(true);
      return;
    }
    speechService.stopListening();
    setListening(false);
  };

  const startMic = () => {
    if (listening) {
      stopMic(true);
      setStatus('Stopping and processing captured speech…');
      return;
    }
    const started = speechService.startListening(language, {
      onStart: () => {
        finalizedRef.current = false;
        setProcessing(false);
        setProcessingSteps([]);
        setListening(true);
        setBatchMode(true);
        setTransformedResult(null);
        setProductMatch(null);
        setProductClarifications([]);
        transcriptBuffer.current = '';
        candidateBuffer.current = '';
        interimBuffer.current = '';
        manualStopPendingRef.current = false;
        setRawTranscript('');
        setCandidateTranscript('');
        setLiveTranscript('');
        setStatus('Listening in batch mode. Audio stays on this device unless uncertain text needs Gemini audio fallback.');

      },
      onModeChange: (mode) => setListening(mode === 'listening'),
      onInterim: (transcript) => {
        interimBuffer.current = transcript;
        const combined = [transcriptBuffer.current, transcript].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        setLiveTranscript(combined);
      },
      onResult: (transcript, alternatives) => {
        // Stage 1 preserves the browser's primary transcript exactly (apart from spacing).
        transcriptBuffer.current = `${transcriptBuffer.current} ${transcript}`.replace(/\s+/g, ' ').trim();
        interimBuffer.current = '';
        setRawTranscript(transcriptBuffer.current);
        // Keep the latest final text visible under the waveform; interim text is
        // replaced by the finalized browser transcript instead of disappearing.
        setLiveTranscript(transcriptBuffer.current);
        // Stage 1B uses the best browser hypothesis for vocabulary coverage. It never invents words.
        const selected = testMode === 'products'
          ? [...new Set([transcript, ...(alternatives || [])].map((value) => value.trim()).filter(Boolean))].sort((a, b) => {
            const score = (value: string) => transformRecognizedWords(value).rows.filter((row) => row.status !== 'UNMATCHED').length;
            return score(b) - score(a);
          })[0] || transcript
          : selectVocabularyAlternative(transcript, alternatives || []);
        candidateBuffer.current = `${candidateBuffer.current} ${selected}`.replace(/\s+/g, ' ').trim();
        setCandidateTranscript(candidateBuffer.current);
        setStatus('Speech captured. Original transcript preserved; vocabulary candidate prepared. Say OK OK to analyze.');
      },
      onStopWord: () => { speechService.stopListening(true); void finalizeCapturedSpeech('voice command'); },
      onError: (message) => {
        void stopAudioCapture();
        setListening(false);
        setStatus(message);
      },
      onEnd: () => {
        if (manualStopPendingRef.current && !finalizedRef.current) {
          void finalizeCapturedSpeech('manual stop');
        } else {
          setListening(false);
        }
      },
    }, 'listening');
    if (!started) setStatus('Microphone could not start. Use Chrome/Edge and allow microphone access.');
    else if (testMode === 'products') void startAudioCapture();
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">FOUR-X · Voice Lab</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <AudioLines className="h-7 w-7 text-cyan-400" /> Voice Training & Testing
            </h1>
            <p className="mt-1 text-sm text-slate-400">Test vocabulary recognition or representative catalogue product combinations. This page never changes the invoice.</p>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back to FOUR-X
          </button>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">1. Speak or enter a test phrase</h2>
                <p className="text-xs text-slate-400">Product words are spoken in English. Gujarati digits and quantity words (નંગ / નગ) are also accepted. Stage 1 preserves browser text; after OK OK, Stage 2 matches catalogue vocabulary and searches products.</p>
              </div>
              <span className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
                <Languages className="h-4 w-4" /> Recognition: English (India) · Gujarati digits supported
              </span>
            </div>

            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2">
              <button onClick={() => { stopMic(); setTestMode('vocabulary'); setProductMatch(null); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${testMode === 'vocabulary' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>Minimum Word Test</button>
              <button onClick={() => { stopMic(); setTestMode('products'); setTransformedResult(null); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${testMode === 'products' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>Product Combination Test · 23</button>
            </div>
            {testMode === 'products' && <div className="rounded-xl border border-cyan-500/30 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-cyan-200">Select one command, then speak it</h3><span className="text-[10px] text-slate-500">{PRODUCT_COMBINATION_TESTS.length} tests</span></div>
              <div className="mb-3 rounded-lg bg-cyan-950/30 p-3"><p className="text-[10px] font-semibold uppercase text-cyan-300">Selected command #{selectedProductTest.id} · {selectedProductTest.group}</p><p className="mt-1 text-lg font-bold text-white">{selectedProductTest.phrase}</p></div>
              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {PRODUCT_COMBINATION_TESTS.map((test) => <button key={test.id} onClick={() => { setSelectedProductTest(test); setProductMatch(null); setRawTranscript(''); setCandidateTranscript(''); setLiveTranscript(''); setProcessing(false); setProcessingSteps([]); transcriptBuffer.current = ''; candidateBuffer.current = ''; }} className={`rounded-md border px-2 py-2 text-left text-xs ${selectedProductTest.id === test.id ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'}`}><span className="mr-2 text-slate-500">{test.id}.</span>{test.phrase}</button>)}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">એક command પસંદ કરો → Start Batch Voice Test → વાક્ય બોલો → OK OK. દરેક command અલગથી ચકાસો.</p>
            </div>}
            <button onClick={() => listening ? stopMic(true) : startMic()} className={`flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 font-bold transition ${listening ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'}`}>
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {listening ? 'STOP & PROCESS' : 'Start Batch Voice Test'}
            </button>

            {(processing || processingSteps.length > 0) && <div className="rounded-xl border border-cyan-500/30 bg-slate-950 p-3" aria-live="polite" aria-label="Voice processing progress">
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-bold uppercase tracking-wide text-cyan-200">After STOP · Processing status</h3><span className={`rounded px-2 py-1 text-[10px] font-bold ${processing ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'}`}>{processing ? 'PROCESSING…' : 'COMPLETE'}</span></div>
              <ol className="space-y-1.5">{processingSteps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2 text-xs text-slate-300"><span className="font-mono text-cyan-400">{String(index + 1).padStart(2, '0')}</span><span className="break-words">{step}</span></li>)}</ol>
              {processing && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-400" /></div>}
            </div>}

            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3" aria-label="Live microphone sound level">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><p className="text-xs font-bold text-slate-200">LIVE SOUND WAVEFORM</p><p className="text-[10px] text-slate-500">Real microphone loudness · visual only</p></div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${!listening ? 'bg-slate-800 text-slate-400' : micLevel < 5 ? 'bg-amber-950 text-amber-300' : micLevel > 70 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>{!listening ? 'MIC OFF' : micLevel < 5 ? 'LOW' : micLevel > 70 ? 'HIGH' : 'CAPTURING'}</span>
                  {listening && <button type="button" onClick={() => stopMic(true)} className="rounded-md bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-rose-500">STOP &amp; PROCESS</button>}
                </div>
              </div>
              <div className="flex h-16 items-center justify-center gap-1 overflow-hidden rounded-lg bg-slate-900 px-2">
                {soundLevels.map((level, index) => <div key={index} className={`min-w-0 flex-1 rounded-full transition-[height] duration-75 ${!listening ? 'bg-slate-700' : micLevel > 70 ? 'bg-rose-400' : micLevel < 5 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ height: `${Math.max(4, Math.min(100, level))}%` }} />)}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-slate-500"><span>Quiet</span><span>{listening ? `${micLevel}% input level` : 'Start voice test to view sound'}</span><span>Loud</span></div>
              <div className="mt-3 rounded-lg border border-cyan-500/30 bg-slate-900 px-3 py-3" aria-live="polite" aria-atomic="true">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">LIVE TRANSCRIPT · WHAT YOU ARE SAYING</p>
                  <span className={`text-[9px] ${listening ? 'text-emerald-300' : 'text-slate-500'}`}>{listening ? 'HEARING…' : 'WAITING'}</span>
                </div>
                <p className="min-h-6 break-words text-sm text-white">{liveTranscript || (listening ? 'Speak now… live words will appear here.' : 'Start the voice test; recognized words will appear here while you speak.')}</p>
                <p className="mt-1 text-[9px] text-slate-500">Temporary browser transcript. Final recognized text is preserved separately below; analysis runs only after OK OK.</p>
              </div>
            </div>

            {testMode === 'vocabulary' && <div className="rounded-xl border border-cyan-500/30 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-cyan-200">Minimum word list · {MINIMUM_WORDS.length} unique entries</h3><span className="text-[10px] text-slate-500">Speak these words</span></div>
              <div className="flex flex-wrap gap-2">{MINIMUM_WORDS.map((word) => <span key={word} className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-200">{word}</span>)}</div>
            </div>}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-cyan-300">RAW SPEECH RECOGNITION RESULT</label>
              <textarea value={rawTranscript} onChange={(event) => setRawTranscript(event.target.value)} rows={2} placeholder="The exact text returned by browser speech recognition appears here..." className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500" />
            </div>

            {testMode === 'vocabulary' && <div className="rounded-lg border border-indigo-500/30 bg-slate-950 p-3">
              <label className="block text-xs font-semibold text-indigo-300">STAGE 1B · BEST BROWSER ALTERNATIVE FOR VOCABULARY</label>
              <p className="mt-1 min-h-6 text-sm text-indigo-100">{candidateTranscript || 'Waiting for recognition alternatives…'}</p>
              <p className="mt-1 text-[11px] text-slate-500">This selects only among the browser's returned hypotheses. It does not create missing words or split unknown numbers.</p>
            </div>}
            {testMode === 'vocabulary' && <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">Stage 1 preserves the browser transcript exactly. Stage 2 matches words against catalogue vocabulary with context-gated phonetic corrections. Numbers and Gujarati quantity words are normalized; unmatched words remain visible and are not silently invented.</div>}
            <button onClick={() => { stopMic(); void stopAudioCapture(); setRawTranscript(''); setCandidateTranscript(''); setLiveTranscript(''); setProcessing(false); setProcessingSteps([]); transcriptBuffer.current = ''; candidateBuffer.current = ''; setBatchMode(false); setTransformedResult(null); setProductMatch(null); setProductClarifications([]); setStatus('Ready for the next voice test.'); }} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800"><RotateCcw className="h-4 w-4" /> Clear test</button>
          </div>

          <div className="space-y-4">
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <h2 className="font-bold">2. Recognition and transformation</h2>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage 1 · What you spoke / browser transcript</p><p className="mt-1 min-h-6 text-sm">{rawTranscript || 'Waiting for microphone input…'}</p></div>
              <div className="rounded-lg border border-cyan-500/30 bg-slate-950 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Stage 2 · Catalogue vocabulary phonetic matching</p><p className="mt-1 min-h-6 font-mono text-sm text-emerald-300">{transformedResult?.transformed || 'Say OK OK to transform the selected vocabulary candidate.'}</p>{transformedResult?.source && <p className="mt-2 text-[10px] text-slate-400">{transformedResult.source} · {Math.round((transformedResult.confidence || 0) * 100)}% confidence{transformedResult.audioUsed ? ' · audio fallback used' : ''}</p>}</div>
              <p className="text-[11px] text-slate-500">Context rules: KI → KEY; TO → TWO; ELECTRIC → ELECTRONIC only before BUZZER. These are vocabulary-test corrections, not global spelling replacements.</p>
              {transformedResult && <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><h3 className="mb-2 text-xs font-bold text-slate-300">{transformedResult.source?.startsWith('gemini') ? 'Local word mapping before AI correction' : 'Word-by-word matching'} · {transformedResult.rows.length} tokens</h3><div className="space-y-1.5">{transformedResult.rows.map((row, index) => <div key={`${row.heard}-${index}`} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-slate-400">{row.heard}</span><span className="text-slate-600">→</span><span className={row.status === 'UNMATCHED' ? 'font-semibold text-rose-300' : row.status === 'PHONETIC' ? 'font-semibold text-amber-300' : 'font-semibold text-emerald-300'}>{row.matched}<span className="ml-2 text-[9px] opacity-70">{row.status}</span></span></div>)}</div></div>}
              {testMode === 'products' && productMatch && <div className="rounded-lg border border-cyan-500/30 bg-slate-950 p-3">
                <h3 className="mb-2 text-sm font-bold text-cyan-200">Catalogue product matching</h3>
                <div className="mb-3 text-xs text-slate-400">Expected: <span className="font-semibold text-slate-200">{selectedProductTest.phrase}</span></div>
                <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-bold ${productMatch.totalMatches === 1 ? 'bg-emerald-950 text-emerald-300' : productMatch.totalMatches > 1 ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300'}`}>{productMatch.totalMatches === 1 ? 'ONE CATALOGUE RESULT' : productMatch.totalMatches > 1 ? `MULTIPLE MATCHES · ${productMatch.totalMatches} RESULTS · ASK USER` : 'NO MATCH · REVIEW TRANSCRIPT'}</div>
                {(productMatch.results || []).map((result, index) => <div key={`${result.product.sku}-${index}`} className="mb-2 rounded-md border border-slate-800 p-2 text-xs"><p className="font-semibold text-white">{index + 1}. {result.product.item_name || result.product.description}</p><p className="mt-1 text-cyan-300">SKU: {result.product.sku}</p><p className="mt-1 text-[10px] text-slate-500">{result.note || (result.defaultsApplied ? 'Catalogue defaults applied' : 'Catalogue match')}</p></div>)}
                {productMatch.totalMatches === 0 && <p className="text-xs text-slate-400">{productMatch.unmatchedReason || productMatch.note || 'No matching catalogue item was found.'}</p>}
                {productMatch.defaultsApplied && <div className="mt-2 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs"><p className="font-semibold text-cyan-200">Applied default attributes</p><p className="mt-1 text-slate-300">{(productMatch.appliedDefaultsList || ['Catalogue family defaults applied']).join(' · ')}</p></div>}
                {productMatch.totalMatches > 1 && <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-950/20 p-2"><p className="text-xs font-bold text-amber-200">Please distinguish the products</p>{productClarifications.length > 0 ? productClarifications.map((item, index) => <p key={item} className="mt-1 text-xs text-amber-100">{index + 1}. {item}</p>) : <p className="mt-1 text-xs text-amber-100">Select the required difference from the numbered product list above.</p>}<p className="mt-2 text-[10px] text-amber-200">No product is auto-selected. Use the listed attributes to clarify the exact SKU.</p></div>}
                <p className="mt-2 text-[10px] text-amber-300">Testing only: catalogue records may be pending/review-required. No cart, invoice, price approval or stock update occurs.</p>
              </div>}
              <p className="text-xs text-slate-500">{status}</p>
              {batchMode && <p className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2 text-xs text-cyan-200">Listening… transformation will run only after OK OK.</p>}
            </section>

            <p className="px-1 text-xs text-slate-500">{testMode === 'products' ? 'Hybrid voice interpretation: local first, Gemini text only for uncertain phrases, Gemini audio only as a final fallback. Product SKU search always remains local; multiple results are never auto-selected.' : 'First verify that each spoken word maps correctly. Product combination testing is available in the separate test mode.'}</p>
          </div>
        </section>
      </div>
    </div>
  );
};
