export function countEssayLines(text: string): number {
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}
