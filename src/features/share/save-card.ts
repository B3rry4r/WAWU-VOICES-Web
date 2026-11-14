/**
 * Saves a share card picture to the device: the 1080 x 1920 story card or the 1080 x 1080 square card the API draws
 * (link.storyImageUrl, link.squareImageUrl). The picture is text and brand only, so a story or a feed post carries the same
 * words as the share page, and an anonymous voice carries no name on any size (the API draws it so).
 * Rejects when the card is not ready or the address is missing; the caller says so in plain words.
 */
export type CardSize = "story" | "square";

export const CARD_FILE: Record<CardSize, string> = { story: "voices-story-card.png", square: "voices-square-card.png" };

export async function fetchCard(from: string | null | undefined): Promise<Blob> {
  if (!from) throw new Error("no card");
  const r = await fetch(from);
  if (!r.ok) throw new Error("card not ready");
  return r.blob();
}

/** A card as a file the phone's own share sheet can take. */
export const cardFile = (blob: Blob, size: CardSize): File => new File([blob], CARD_FILE[size], { type: "image/png" });

/** True where the device can hand a picture file to its own share sheet (navigator.canShare with files). */
export function canShareCard(file: File): boolean {
  try { return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }); } catch { return false; }
}

export function downloadCard(blob: Blob, size: CardSize): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = CARD_FILE[size];
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function saveCardPicture(from: string | null | undefined, size: CardSize): Promise<void> {
  downloadCard(await fetchCard(from), size);
}
