/**
 * Dashboard API service - uses dedicated backend endpoint
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	RawDashboardResponse,
	DashboardStats,
	PartResponse,
	ReceivingResponse,
	OutgoingResponse,
	RequestResponse,
	PartMovementResponse
} from './types.js';

// Re-export types for backward compatibility
export type { DashboardStats };

export interface DashboardData {
	stats: DashboardStats;
	recentReceivings: ReceivingResponse[];
	recentOutgoings: OutgoingResponse[];
	lowStockParts: PartResponse[];
	pendingRequests: RequestResponse[];
	recentMovements: PartMovementResponse[];
}

export async function getDashboardStats(days: number = 30): Promise<DashboardData> {
	// Use cache with 30 second TTL
	return apiCache.getOrFetch(
		cacheKeys.dashboard(),
		async () => {
			// Fetch from dedicated dashboard endpoint
			const response = await api.get<RawDashboardResponse>('/dashboard', { days });

			// Transform snake_case response to camelCase for frontend consistency
			return {
				stats: {
					parts: {
						total: response.stats.parts.total,
						active: response.stats.parts.active,
						inStock: response.stats.parts.in_stock,
						lowStock: response.stats.parts.low_stock,
						outOfStock: response.stats.parts.out_of_stock
					},
					receivings: {
						total: response.stats.receivings.total,
						draft: response.stats.receivings.draft,
						completed: response.stats.receivings.completed,
						pendingGR: response.stats.receivings.pending_gr
					},
					outgoings: {
						total: response.stats.outgoings.total,
						draft: response.stats.outgoings.draft,
						completed: response.stats.outgoings.completed,
						pendingGI: response.stats.outgoings.pending_gi
					},
					requests: {
						total: response.stats.requests.total,
						draft: response.stats.requests.draft,
						completed: response.stats.requests.completed
					}
				},
				recentReceivings: response.recent_receivings,
				recentOutgoings: response.recent_outgoings,
				lowStockParts: response.low_stock_parts,
				pendingRequests: response.pending_requests,
				recentMovements: response.recent_movements
			};
		},
		30_000 // 30 second cache TTL
	);
}

/**
 * Invalidate dashboard cache - call after mutations
 */
export function invalidateDashboardCache(): void {
	apiCache.invalidate(cacheKeys.dashboard());
}
