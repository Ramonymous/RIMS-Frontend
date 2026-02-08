/**
 * Parts API service
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	PartResponse,
	PartCreate,
	PartUpdate,
	PartMovementResponse,
	PaginatedResponse,
	PaginationParams
} from './types.js';

export interface PartsListParams extends PaginationParams {
	search?: string;
	stock_status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
	is_active?: boolean;
	status_filter?: string;
}

export async function getParts(params?: PartsListParams): Promise<PaginatedResponse<PartResponse>> {
	return apiCache.getOrFetch(
		cacheKeys.parts(params as Record<string, unknown> | undefined),
		() =>
			api.get<PaginatedResponse<PartResponse>>(
				'/v1/inventory/parts',
				params as Record<string, string | number | boolean>
			),
		30_000
	);
}

export async function getPart(id: string): Promise<PartResponse> {
	return apiCache.getOrFetch(
		cacheKeys.part(id),
		() => api.get<PartResponse>(`/v1/inventory/parts/${id}`),
		30_000
	);
}

export async function pickRequestItem(partNumber: string): Promise<PartResponse> {
	const cacheKey = `parts:pick:${partNumber}`;
	const cached = apiCache.get<PartResponse>(cacheKey);
	if (cached) return cached;

	// Kirim object, bukan string di URL
	const result = await api.post<PartResponse>(`/v1/inventory/parts/pick`, {
		part_number: partNumber
	});

	apiCache.set(cacheKey, result);
	return result;
}

export async function createPart(data: PartCreate): Promise<PartResponse> {
	const result = await api.post<PartResponse>('/v1/inventory/parts', data);
	apiCache.invalidate('parts:*'); // Invalidate all parts cache entries
	apiCache.invalidate(cacheKeys.dashboard()); // Invalidate dashboard
	return result;
}

export async function updatePart(id: string, data: PartUpdate): Promise<PartResponse> {
	const result = await api.put<PartResponse>(`/v1/inventory/parts/${id}`, data);
	apiCache.invalidate('parts:*');
	apiCache.invalidate(cacheKeys.part(id));
	apiCache.invalidate(cacheKeys.dashboard());
	return result;
}

export async function deletePart(id: string): Promise<void> {
	await api.delete<void>(`/v1/inventory/parts/${id}`);
	apiCache.invalidate('parts:*');
	apiCache.invalidate(cacheKeys.part(id));
	apiCache.invalidate(cacheKeys.dashboard());
}

export async function getPartMovements(
	id: string,
	params?: PaginationParams
): Promise<PaginatedResponse<PartMovementResponse>> {
	const cacheKey = `movements:part:${id}:${params ? JSON.stringify(params) : 'all'}`;
	return apiCache.getOrFetch(
		cacheKey,
		() =>
			api.get<PaginatedResponse<PartMovementResponse>>(
				`/v1/inventory/parts/${id}/movements`,
				params as Record<string, string | number | boolean>
			),
		15_000
	);
}
