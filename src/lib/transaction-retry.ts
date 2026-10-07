/**
 * Serializable transactions that lose a conflict are retried. Under load several can keep losing to
 * each other, so attempts are spaced with a random, growing pause instead of being fired back to back.
 */
export const SERIALIZABLE_MAX_ATTEMPTS = 5;

export function retryPause(attempt: number): Promise<void> {
  const ceiling = 25 * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, ceiling / 2 + Math.random() * (ceiling / 2)));
}
