import * as ImageManipulator from 'expo-image-manipulator';

const MAX_BYTES = 500 * 1024; // 500 KB per spec §9.1
const MAX_DIM = 1280;

export async function compressPhoto(uri: string): Promise<string> {
  // Resize to max 1280px wide, then compress quality down until under 500KB.
  let quality = 0.8;
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIM } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Rough size estimate: fetch blob and check.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(result.uri);
    const blob = await res.blob();
    if (blob.size <= MAX_BYTES) break;
    quality -= 0.15;
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIM } }],
      { compress: Math.max(quality, 0.3), format: ImageManipulator.SaveFormat.JPEG }
    );
  }

  return result.uri;
}
