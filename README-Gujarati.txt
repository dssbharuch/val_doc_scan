Live Line OCR – Gallery Photo Manual Scan Update

આ ZIP અગાઉની live-line-ocr-draggable-button-update.zip પરથી બનાવવામાં આવી છે.

નવી સુવિધા:
- Scan Photo from Gallery: JPG/PNG/WEBP ફોટો પસંદ કરો.
- ફોટો Drag કરીને ખસેડો; બે આંગળીથી Pinch Zoom અથવા PC પર Mouse Wheelથી Zoom કરો.
- Camera જેવો જ એક-લાઇન Scan Box, Cyan Line અને બન્ને બાજુથી Width Resize.
- આખો ફોટો સરખો દેખાય છે; Box બહાર Dark Overlay નથી.
- Galleryમાં Auto Scan નથી. ફક્ત Manual Scan બટનથી OCR થશે.
- OCR પછી Text Edit, Reject (✕), Accept (✓), Finish અને Share Preview એ જ Flowમાં છે.
- Manual Scan બટન લાંબું દબાવી Drag કરી શકાય છે; તેની જગ્યા અગાઉની જેમ સેવ થાય છે.
- Camera Scannerના હાલના Auto/Manual Scanમાં ફેરફાર નથી.

ફાઇલો:
src/components/GuidedCamera.jsx (જૂની ફાઇલ યથાવત)
src/components/GalleryScanner.jsx (નવી)
src/components/ScannerFlow.jsx (Gallery બટન અને Flow)
src/components/ScanEditor.jsx (જૂની ફાઇલ યથાવત)

તમારા મૂળ React Projectમાં આ ફાઇલો src/components/માં Replace/Add કરો.
Projectની બીજી dependencies (Tesseract, Tailwind, storage, fieldDefinitions) પહેલાની જેમ જરૂરી છે.
આ ZIP સંપૂર્ણ standalone React Project નથી; માત્ર update files છે.

પછી npm run build અને મોબાઇલ તથા PCમાં ચકાસો.
નોંધ: અહીં પૂર્ણ App/Browser Test શક્ય થયો નથી; Gallery Zoom/Scan અને OCR ચકાસીને Deploy કરો.
