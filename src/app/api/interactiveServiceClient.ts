/** Bare HTTP client for direct browser → interactive inference service calls.
 *
 * The latency-sensitive per-prompt loop runs the browser against the inference
 * service directly, bearing a short-lived token minted by the server→service
 * handshake. This client does **NOT** use the JWT-intercepted ``api`` instance
 * from ``client.ts`` — it must not leak the user's platform credentials to the
 * external service.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceClient {
  /** Upload the image once (seat taken, embedding cached). */
  inferImage: (imageBlob: Blob, metadata?: Record<string, unknown>) => Promise<void>;
  /** Send prompts; returns the service's JSON response. */
  predict: (metadata: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Best-effort release of the session's seat (called on discard). */
  release: () => Promise<void>;
}

export interface ServiceClientOptions {
  predictUrl: string;
  sessionId: number;
  token: string;
  tokenHeader: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createServiceClient(opts: ServiceClientOptions): ServiceClient {
  const { predictUrl, sessionId, token, tokenHeader } = opts;
  const base = predictUrl.replace(/\/$/, "");

  function authHeaders(): Record<string, string> {
    return { [tokenHeader]: token };
  }

  async function request(
    method: string,
    path: string,
    body?: BodyInit | Record<string, unknown>,
    contentType?: string
  ): Promise<Response> {
    const headers: Record<string, string> = { ...authHeaders() };
    let bodyInit: BodyInit | undefined;

    if (body instanceof Blob || body instanceof FormData || typeof body === "string") {
      bodyInit = body;
    } else if (body && contentType === "application/json") {
      headers["Content-Type"] = "application/json";
      bodyInit = JSON.stringify(body);
    } else if (body) {
      bodyInit = body as BodyInit;
    }

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: bodyInit,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const detail = (() => {
        try { return JSON.parse(text).detail; } catch { return text || res.statusText; }
      })();
      throw new Error(`Service error ${res.status}: ${detail}`);
    }

    return res;
  }

  return {
    async inferImage(imageBlob: Blob, metadata?: Record<string, unknown>) {
      const form = new FormData();
      form.append("image", imageBlob, "image");
      if (metadata) {
        form.append("metadata", JSON.stringify(metadata));
      }
      await request("POST", `/${sessionId}/infer_image`, form);
    },

    async predict(metadata: Record<string, unknown>) {
      const res = await request("POST", `/${sessionId}/predict`, metadata, "application/json");
      return res.json();
    },

    async release() {
      await request("DELETE", `/${sessionId}`).catch(() => {
        // Best-effort; the service will TTL-sweep the seat anyway.
      });
    },
  };
}
