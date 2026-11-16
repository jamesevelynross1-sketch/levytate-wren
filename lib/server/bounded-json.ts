export class BoundedJsonBodyError extends Error {
  constructor(public readonly tooLarge: boolean) {
    super(tooLarge ? "Request body is too large." : "Request body is not valid JSON.");
    this.name = "BoundedJsonBodyError";
  }
}

/** Preserve the exact signed text while bounding the stream, including when
 * content-length is absent or false. Never buffer an unbounded webhook first.
 */
export async function readBoundedText(request: Pick<Request, "headers" | "body">, maximumBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new BoundedJsonBodyError(true);
  }

  if (!request.body) throw new BoundedJsonBodyError(false);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel();
        throw new BoundedJsonBodyError(true);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const source = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    source.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch {
    throw new BoundedJsonBodyError(false);
  }
}

export async function readBoundedJson(request: Pick<Request, "headers" | "body">, maximumBytes: number): Promise<unknown> {
  const source = await readBoundedText(request, maximumBytes);
  try { return JSON.parse(source); }
  catch { throw new BoundedJsonBodyError(false); }
}
