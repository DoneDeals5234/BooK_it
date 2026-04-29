/**
 * Fetch handler that serializes request bodies to prevent DataCloneError
 * when requests are intercepted by postMessage (e.g., Builder.io auto-engineer.js)
 *
 * Problem: Firebase SDK and other libraries may create requests with ReadableStream bodies
 * which cannot be cloned via postMessage. This handler converts non-cloneable bodies
 * to serializable formats before they're intercepted.
 *
 * It also adds a Supabase failover layer:
 * - Try the primary Supabase project for up to 5 seconds
 * - If it times out, hits a network error, or returns a server error, retry once
 *   against the fallback Supabase project using the matching fallback anon key
 */

const originalFetch = window.fetch;
const SUPABASE_FAILOVER_TIMEOUT_MS = 5000;

const PRIMARY_SUPABASE_URL = normalizeBaseUrl(import.meta.env.VITE_SUPABASE_URL);
const PRIMARY_SUPABASE_ORIGIN = getOrigin(PRIMARY_SUPABASE_URL);
const PRIMARY_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FALLBACK_SUPABASE_URL = normalizeBaseUrl(import.meta.env.VITE_SUPABASE_FALLBACK_URL);
const FALLBACK_SUPABASE_ORIGIN = getOrigin(FALLBACK_SUPABASE_URL);
const FALLBACK_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_FALLBACK_ANON_KEY;

function normalizeBaseUrl(url?: string): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

function getOrigin(url: string | null): string | null {
  if (!url) return null;

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return new URL(input, window.location.href).toString();
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return new URL(input.url, window.location.href).toString();
}

function isCloneable(body: any): boolean {
  if (!body) return true;

  const primitiveType = typeof body;
  if (primitiveType === 'string' || primitiveType === 'number' || primitiveType === 'boolean') {
    return true;
  }

  if (
    body instanceof ArrayBuffer ||
    body instanceof Uint8Array ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof DataView
  ) {
    return true;
  }

  if (body instanceof ReadableStream) {
    return false;
  }

  const bodyString = Object.prototype.toString.call(body);
  if (bodyString.includes('Function')) {
    return false;
  }

  return true;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return buffer;
}

async function makeBodyCloneable(body: any): Promise<any> {
  if (!body) {
    return undefined;
  }

  if (isCloneable(body)) {
    return body;
  }

  if (body instanceof ReadableStream) {
    try {
      return await streamToBuffer(body);
    } catch (error) {
      console.warn('[fetch-handler] Failed to convert stream to buffer:', error);
      return undefined;
    }
  }

  try {
    if (typeof body === 'object') {
      return JSON.stringify(body);
    }
  } catch (error) {
    console.warn('[fetch-handler] Failed to serialize body:', error);
  }

  return undefined;
}

function isSupabaseFailoverConfigured(): boolean {
  return !!(
    PRIMARY_SUPABASE_ORIGIN &&
    FALLBACK_SUPABASE_ORIGIN &&
    PRIMARY_SUPABASE_ORIGIN !== FALLBACK_SUPABASE_ORIGIN &&
    FALLBACK_SUPABASE_ANON_KEY
  );
}

function isPrimarySupabaseRequest(url: string): boolean {
  if (!PRIMARY_SUPABASE_ORIGIN) {
    return false;
  }

  try {
    return new URL(url).origin === PRIMARY_SUPABASE_ORIGIN;
  } catch {
    return false;
  }
}

function buildFallbackSupabaseUrl(url: string): string | null {
  if (!FALLBACK_SUPABASE_ORIGIN || !isPrimarySupabaseRequest(url)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    parsedUrl.protocol = new URL(FALLBACK_SUPABASE_ORIGIN).protocol;
    parsedUrl.host = new URL(FALLBACK_SUPABASE_ORIGIN).host;
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function createHeaders(headers?: HeadersInit): Headers {
  return new Headers(headers ?? undefined);
}

function buildFallbackHeaders(headers?: HeadersInit): Headers {
  const resolvedHeaders = createHeaders(headers);

  if (!FALLBACK_SUPABASE_ANON_KEY) {
    return resolvedHeaders;
  }

  resolvedHeaders.set('apikey', FALLBACK_SUPABASE_ANON_KEY);

  const authorization = resolvedHeaders.get('Authorization');
  if (!authorization || authorization === `Bearer ${PRIMARY_SUPABASE_ANON_KEY}`) {
    resolvedHeaders.set('Authorization', `Bearer ${FALLBACK_SUPABASE_ANON_KEY}`);
  }

  return resolvedHeaders;
}

function shouldRetryOnResponse(response: Response): boolean {
  return response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
}

function shouldRetryOnError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'AbortError' ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('ERR_')
  );
}

function createTimeoutController(signal?: AbortSignal): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();

  const abortFromOriginalSignal = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', abortFromOriginalSignal, { once: true });
    }
  }

  return {
    controller,
    cleanup: () => {
      signal?.removeEventListener('abort', abortFromOriginalSignal);
    },
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const { controller, cleanup } = createTimeoutController(options.signal);
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException(`Primary Supabase timed out after ${timeoutMs}ms`, 'AbortError'));
  }, timeoutMs);

  try {
    return await originalFetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
    cleanup();
  }
}

async function fetchWithSupabaseFailover(url: string, options: RequestInit): Promise<Response> {
  const fallbackUrl = buildFallbackSupabaseUrl(url);
  if (!fallbackUrl) {
    return fetchWithTimeout(url, options, SUPABASE_FAILOVER_TIMEOUT_MS);
  }

  try {
    const primaryResponse = await fetchWithTimeout(url, options, SUPABASE_FAILOVER_TIMEOUT_MS);

    if (!shouldRetryOnResponse(primaryResponse)) {
      return primaryResponse;
    }

    console.warn('[fetch-handler] Primary Supabase returned retryable response, switching to fallback project:', {
      url,
      status: primaryResponse.status,
      fallbackUrl,
    });
  } catch (error) {
    if (!shouldRetryOnError(error)) {
      throw error;
    }

    console.warn('[fetch-handler] Primary Supabase request failed, switching to fallback project:', {
      url,
      fallbackUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const fallbackOptions: RequestInit = {
    ...options,
    headers: buildFallbackHeaders(options.headers),
  };

  const fallbackResponse = await originalFetch(fallbackUrl, fallbackOptions);

  console.info('[fetch-handler] Fallback Supabase request completed:', {
    url: fallbackUrl,
    status: fallbackResponse.status,
  });

  return fallbackResponse;
}

window.fetch = ((
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  let url: string = toAbsoluteUrl(input);
  let options: RequestInit = { ...init };

  if (input instanceof Request) {
    const request = input;

    options = {
      method: request.method,
      headers: request.headers,
      body: request.body,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      integrity: request.integrity,
      ...(init || {}),
    };
  }

  const executeFetch = async (): Promise<Response> => {
    const useSupabaseFailover = isSupabaseFailoverConfigured() && isPrimarySupabaseRequest(url);

    try {
      if (useSupabaseFailover) {
        return await fetchWithSupabaseFailover(url, options);
      }

      return await originalFetch(url, options);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMsg.includes('Failed to fetch') ||
                            errorMsg.includes('ERR_') ||
                            errorMsg.includes('NetworkError') ||
                            errorMsg.includes('timed out');

      if (isNetworkError) {
        console.warn('[fetch-handler] Network error detected:', {
          url,
          method: options.method || 'GET',
          error: errorMsg,
          hint: 'This may be due to offline status, CORS restrictions, or network connectivity issues',
        });
      } else {
        console.error('[fetch-handler] Fetch failed:', {
          url,
          method: options.method || 'GET',
          hasBody: !!options.body,
          bodyType: options.body ? typeof options.body : 'none',
          error: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      throw error;
    }
  };

  if (options.body && !isCloneable(options.body)) {
    return (async () => {
      try {
        console.debug('[fetch-handler] Non-cloneable body detected, attempting conversion...');
        const cloneableBody = await makeBodyCloneable(options.body);
        if (cloneableBody !== undefined) {
          options.body = cloneableBody;
          console.debug('[fetch-handler] Body converted successfully');
        } else {
          console.warn('[fetch-handler] Body conversion returned undefined, proceeding with original body');
        }
      } catch (error) {
        console.warn('[fetch-handler] Unable to make request body cloneable, proceeding with original:', error instanceof Error ? error.message : String(error));
      }

      return executeFetch();
    })();
  }

  return executeFetch();
}) as typeof fetch;
