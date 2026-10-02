export function revokeTemporaryImage(url) {
  if (url && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore already-revoked object URLs.
    }
  }
}

/**
 * The scanner keeps the captured photo only while the page is being reviewed.
 * After the user approves OCR text, callers should revoke all temporary image URLs
 * and persist only the approved text/metadata.
 */
export function cleanupApprovedPage(page) {
  revokeTemporaryImage(page.imageUrl);
  revokeTemporaryImage(page.processedImageUrl);
  return {
    ...page,
    imageUrl: null,
    processedImageUrl: null,
    photoDeleted: true
  };
}
