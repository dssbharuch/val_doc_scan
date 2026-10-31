Gallery Photo Loading Fix (2026-10-31)

ફોટો પસંદ કર્યા પછી "Selected photo could not be loaded" Error આવતો હતો.
સંભવિત કારણ: GalleryScannerમાં React effect cleanup વખતે Blob URL વહેલું revoke થતું હતું.
હવે URLની જવાબદારી ScannerFlow પાસે છે; GalleryScannerમાં વહેલું revoke બંધ કર્યું છે.
Gallery બંધ/Finish થતાં URL થોડા સમય પછી release થાય છે.

ફેરફાર કરેલી ફાઇલો:
- src/components/GalleryScanner.jsx
- src/components/ScannerFlow.jsx

બીજી ફાઇલો, Camera Scanner અને OCR logic બદલ્યા નથી.
જૂના React projectમાં ઉપરની બે ફાઇલો replace કરો અને rebuild/redeploy કરો.

Test: JPG/PNG ફોટો પસંદ કરો, Scan, Tick, Finish અને Camera Scan ચકાસો.
HEIC ફોર્મેટ Browserમાં સપોર્ટ ન હોય તો JPGમાં convert કરો.
Live Browser ટેસ્ટ હજી કર્યો નથી.
