export function buildSlotTransformKey(
  filename: string,
  sizeKey: string,
  slotIndex: number
): string {
  return `${filename}::${sizeKey}::${slotIndex}`;
}

export function parseSlotTransformKey(key: string): {
  filename: string;
  sizeKey: string;
  slotIndex: number;
} | null {
  const parts = key.split("::");
  if (parts.length < 3) return null;

  const slotIndex = Number(parts[parts.length - 1]);
  const sizeKey = parts[parts.length - 2];
  const filename = parts.slice(0, -2).join("::");

  if (!filename || !sizeKey || Number.isNaN(slotIndex)) return null;

  return { filename, sizeKey, slotIndex };
}
