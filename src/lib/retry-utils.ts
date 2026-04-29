/**
 * Retry helper with exponential backoff for network requests
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 2,
  delayMs: number = 300
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        console.debug(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retry attempts reached');
}
