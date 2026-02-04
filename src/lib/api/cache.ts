/**
 * Simple in-memory cache for API responses
 * Reduces redundant API calls for frequently accessed data
 */

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
}

class ApiCache {
	private cache = new Map<string, CacheEntry<unknown>>();
	private pendingRequests = new Map<string, Promise<unknown>>();
	private defaultTTL = 30_000; // 30 seconds default

	/**
	 * Get cached data if valid
	 */
	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	/**
	 * Set cache data with TTL
	 */
	set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
		const now = Date.now();
		this.cache.set(key, {
			data,
			timestamp: now,
			expiresAt: now + ttl
		});
	}

	/**
	 * Invalidate cache by key or prefix
	 */
	invalidate(keyOrPrefix: string): void {
		if (keyOrPrefix.endsWith('*')) {
			const prefix = keyOrPrefix.slice(0, -1);
			for (const key of this.cache.keys()) {
				if (key.startsWith(prefix)) {
					this.cache.delete(key);
				}
			}
		} else {
			this.cache.delete(keyOrPrefix);
		}
	}

	/**
	 * Clear entire cache
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Deduplicate concurrent requests - returns existing promise if request is in-flight
	 */
	async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
		// Check if request is already in-flight
		const pending = this.pendingRequests.get(key);
		if (pending) {
			return pending as Promise<T>;
		}

		// Start new request
		const promise = fetcher().finally(() => {
			this.pendingRequests.delete(key);
		});

		this.pendingRequests.set(key, promise);
		return promise;
	}

	/**
	 * Get with cache-first strategy
	 * Returns cached data if valid, otherwise fetches and caches
	 */
	async getOrFetch<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttl: number = this.defaultTTL
	): Promise<T> {
		// Check cache first
		const cached = this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Dedupe and fetch
		const data = await this.dedupe(key, fetcher);
		this.set(key, data, ttl);
		return data;
	}

	/**
	 * Stale-while-revalidate strategy
	 * Returns stale data immediately while fetching fresh data in background
	 */
	getStale<T>(key: string): T | null {
		const entry = this.cache.get(key);
		return entry ? (entry.data as T) : null;
	}
}

export const apiCache = new ApiCache();

// Cache key generators for consistency
export const cacheKeys = {
	parts: (params?: Record<string, unknown>) => `parts:${params ? JSON.stringify(params) : 'all'}`,
	part: (id: string) => `part:${id}`,
	receivings: (params?: Record<string, unknown>) =>
		`receivings:${params ? JSON.stringify(params) : 'all'}`,
	outgoings: (params?: Record<string, unknown>) =>
		`outgoings:${params ? JSON.stringify(params) : 'all'}`,
	requests: (params?: Record<string, unknown>) =>
		`requests:${params ? JSON.stringify(params) : 'all'}`,
	users: (params?: Record<string, unknown>) => `users:${params ? JSON.stringify(params) : 'all'}`,
	movements: (params?: Record<string, unknown>) =>
		`movements:${params ? JSON.stringify(params) : 'all'}`,
	dashboard: () => 'dashboard:stats'
};
