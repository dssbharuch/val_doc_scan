# Document Scanner — Final Step 8

Current tested workflow base:
- Guided device camera
- Smaller default capture guide (64% × 52%)
- Captures only the guide area
- OCR review and editable text
- Four-corner manual adjustment
- Large mobile-friendly corner handles 1–4
- Pointer/touch drag support without page scrolling
- Perspective correction
- Temporary image cleanup after user approval
- Approved OCR text/metadata stored locally

Run:

```bash
npm install
npm run dev
```

For GitHub Pages, configure the Vite `base` to match the repository name and deploy the Vite build through GitHub Actions.


### Guided camera scan area
The default scan guide is compact (45% width × 35% height) for small text areas such as an approximately 6×6 cm region. The user can enlarge it with the **Scan area** slider before capture. The captured image uses the same selected guide size.
