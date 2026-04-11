export function encodeWavDataUrl(
  samples: Float32Array,
  sampleRate: number
): Promise<string> {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  const writeUint32 = (offset: number, value: number) => {
    view.setUint32(offset, value, true);
  };

  const writeUint16 = (offset: number, value: number) => {
    view.setUint16(offset, value, true);
  };

  writeString(0, "RIFF");
  writeUint32(4, 36 + samples.length * 2);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  writeUint32(16, 16);
  writeUint16(20, 1);
  writeUint16(22, 1);
  writeUint32(24, sampleRate);
  writeUint32(28, sampleRate * 2);
  writeUint16(32, 2);
  writeUint16(34, 16);
  writeString(36, "data");
  writeUint32(40, samples.length * 2);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([view], { type: "audio/wav" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to encode audio"));
    reader.readAsDataURL(blob);
  });
}
