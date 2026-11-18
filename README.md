<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5f40bb67-b8ec-4fa0-a958-38cb75f2a946

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## FOUR-X Voice Billing (Stage 3A)

The Voice Billing module includes the FOUR-X voice billing demo and Voice Training & Testing page. Voice source code is isolated under `src/voice/`. All product records are supplied at runtime by the canonical `src/data/fourx.json` through `voiceCatalogueAdapter.ts`. The voice training search adapter delegates to the Stage 2 `productMatchingService.ts`.

Run `npm run test:voice` to execute the Stage 3A integration tests after dependencies are installed. Browser microphone permission and SpeechRecognition support must be tested on the target browser/device. Gemini interpretation remains local-only until a secure backend proxy is configured; never place a Gemini API key in frontend code or localStorage.
