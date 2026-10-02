# Document Scanner — Step 8

Step 8 changes the primary capture flow to a guided camera.

## Camera capture

- Opens the device camera
- Shows a document rectangle guide on screen
- Dims the area outside the guide
- Captures only the guide area
- Uses the rear camera by default when available
- Allows front/rear camera switching

## OCR approval and privacy

The captured image is temporary.

The image remains available while the user:
- reviews OCR
- edits OCR
- retries OCR
- changes scan settings

When the user presses **Save Page Text**, the app:
1. Saves the approved OCR text and metadata.
2. Revokes temporary image object URLs.
3. Stores no image URL in the approved localStorage record.
4. Marks the page as `photoDeleted: true`.

If the user cancels or retakes before approval, the temporary image is also cleaned up.

## Important browser limitation

The app cannot securely promise deletion of the original camera sensor buffer because that is managed by the browser/OS. The app does ensure that its captured temporary image/object URL is released and that approved localStorage records contain only text/metadata.

## Run

```bash
npm install
npm run dev
```
