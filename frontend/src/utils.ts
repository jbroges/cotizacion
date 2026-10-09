export const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function parseBytes(input: unknown): Uint8Array {
  if (typeof input === "string") {
    let base64Str = input;
    if (base64Str.includes(",")) {
      base64Str = base64Str.split(",")[1];
    }
    const binaryString = atob(base64Str);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  if (Array.isArray(input)) {
    return new Uint8Array(input);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (input && typeof input === "object" && "buffer" in input) {
    return new Uint8Array((input as any).buffer);
  }
  return new Uint8Array(0);
}

export function downloadPDF(id: string, rawBytes: unknown) {
  const bytes = parseBytes(rawBytes);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cotizacion-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
