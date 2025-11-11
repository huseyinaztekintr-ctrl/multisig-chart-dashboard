import { ethers } from 'ethers';

/**
 * Safely fetch recent logs using small block chunks to respect RPC limits (≤2048 blocks/window)
 */
export async function getRecentLogsChunked(
  provider: ethers.Provider,
  baseFilter: { address?: string; topics?: (string | string[] | null)[] },
  options?: { toBlock?: number; chunkSize?: number; limit?: number; maxChunks?: number }
): Promise<any[]> {
  const latest = options?.toBlock ?? (await provider.getBlockNumber());
  const chunkSize = Math.max(1, options?.chunkSize ?? 2000);
  const limit = Math.max(1, options?.limit ?? 5);
  const maxChunks = Math.max(1, options?.maxChunks ?? 60);

  let to = latest;
  let collected: any[] = [];
  let chunksTried = 0;

  while (collected.length < limit && to >= 0 && chunksTried < maxChunks) {
    const from = Math.max(to - chunkSize + 1, 0);

    try {
      const logs = await provider.getLogs({
        ...(baseFilter.address ? { address: baseFilter.address } : {}),
        topics: baseFilter.topics as any,
        fromBlock: from,
        toBlock: to,
      } as any);
      if (logs?.length) {
        collected = collected.concat(logs);
      }
    } catch (e) {
      // Silently continue to previous window on errors (e.g., range too big)
      // console.warn('getLogs window failed', { from, to, e });
    }

    // Move window backward
    to = from - 1;
    chunksTried += 1;
  }

  // Sort ascending and take the latest N
  collected.sort((a: any, b: any) =>
    a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : a.blockNumber - b.blockNumber
  );

  return collected.slice(-limit);
}
