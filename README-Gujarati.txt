Live Line OCR – Right-side Layout Update

આ અપડેટમાં GuidedCamera screen ને આપેલા screenshot ની જમણી બાજુના layout મુજબ ગોઠવ્યું છે:

1. ઉપર: Close, Live Scan count, Language અને Camera Switch.
2. ઉપરના ભાગમાં: fixed-height horizontal scan frame. બહારનો camera preview blur/dim થતો નથી.
3. Scan frame ની નીચે: centered Manual Scan button.
4. તેની નીચે: OCR result area. OCR text મળ્યા પછી અહીં edit કરી શકાય છે અને X / ✓ થી reject અથવા accept કરી શકાય છે.
5. નીચે: Auto ON/OFF ડાબી બાજુ અને Finish જમણી બાજુ.
6. Auto Scan default ON જ છે. Manual Scan button દબાવવાથી Auto mode ચાલુ હોય ત્યારે પણ તરત scan થાય છે (જો હાલમાં OCR candidate pending ન હોય).

ફાઇલો:
- src/components/GuidedCamera.jsx
- src/components/ScanEditor.jsx
- src/components/ScannerFlow.jsx

સ્થાપન:
જૂની ત્રણેય ફાઇલોનો backup લો. ZIP extract કરીને આ ત્રણેય ફાઇલો તમારા project ના src/components/ માં replace કરો. પછી npm run build અને localhost પર camera test કરો.
