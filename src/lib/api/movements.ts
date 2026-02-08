/**
 * Part Movements API service
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type { PartMovementResponse, PaginatedResponse, PaginationParams } from './types.js';

export interface MovementsListParams extends PaginationParams {
	part_id?: string;
	type?: 'in' | 'out';
	reference_type?: 'Receivings' | 'Outgoings';
	start_date?: string;
	end_date?: string;
}

export async function getMovements(
	params?: MovementsListParams
): Promise<PaginatedResponse<PartMovementResponse>> {
	return apiCache.getOrFetch(
		cacheKeys.movements(params as Record<string, unknown> | undefined),
		() =>
			api.get<PaginatedResponse<PartMovementResponse>>(
				'/movements',
				params as Record<string, string | number | boolean>
			),
		15_000
	);
}

export async function getMovementsByPart(
	partId: string,
	params?: PaginationParams
): Promise<PaginatedResponse<PartMovementResponse>> {
	const cacheKey = `movements:part:${partId}:${params ? JSON.stringify(params) : 'all'}`;
	return apiCache.getOrFetch(
		cacheKey,
		() =>
			api.get<PaginatedResponse<PartMovementResponse>>(
				`/parts/${partId}/movements`,
				params as Record<string, string | number | boolean>
			),
		15_000
	);
}
