/**
 * Executes the supplied async function, retrying on failure until it succeeds
 * or until the specified time budget in milliseconds has elapsed.
 *
 * @param fn       The async operation to perform.
 * @param maxMs    Maximum total time to keep retrying (default 5000 ms).
 * @param delayMs  Delay between retries in milliseconds (default 1000 ms).
 */
export async function withRetries<T>(fn: () => Promise<T>, maxMs = 5000, delayMs = 1000): Promise<T> {
  const deadline = Date.now() + maxMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise(res => setTimeout(res, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
