Live Line OCR Update - 3 component files

Aa update ma niche ni 3 files replace karvani chhe:
1. src/components/GuidedCamera.jsx
2. src/components/ScanEditor.jsx
3. src/components/ScannerFlow.jsx

Navi process:
- Camera preview akho clear rahe chhe. Box ni bahar blur/dim nathi.
- Box ni andar fixed horizontal line chhe.
- OCR fakt line ni aaspaas na narrow strip par chale chhe.
- OCR text male tyare scan pause thai ne editable text, X Reject ane tick Accept batave chhe.
- Accept karta camera chalu rahe chhe ane aagalni line mate scan fari sharu thay chhe.
- Finish karta accepted lines existing ScanEditor ma row-wise aave chhe.
- Rows edit/delete/merge/key assign kari shakay chhe.
- Copy All, WhatsApp ane Share to other apps controls chhe.

Note:
- Aa update existing app ma Tesseract.js already installed hoy te dharine banaveli chhe.
- Full project build aa tran component files thi alag thi verify kari shakay nahi; syntax parsing check pass thayu chhe.
- Pahila current files no backup rakhjo, pachhi aa tran files replace kari ne npm run build chalavjo.
