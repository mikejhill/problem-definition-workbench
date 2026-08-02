export function downloadText(
  filename: string,
  text: string,
  type = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readTextFile(file: File, maxBytes = 2_000_000): Promise<string> {
  if (file.size > maxBytes) throw new Error("The selected file exceeds the 2 MB import limit.");
  return file.text();
}
