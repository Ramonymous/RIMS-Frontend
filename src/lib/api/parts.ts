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
}

export async function getParts(params?: PartsListParams): Promise<PaginatedResponse<PartResponse>> {
	return api.get<PaginatedResponse<PartResponse>>(
		'/parts',
		params as Record<string, string | number | boolean>
	);
}

export async function getPart(id: string): Promise<PartResponse> {
	return api.get<PartResponse>(`/parts/${id}`);
}

export async function createPart(data: PartCreate): Promise<PartResponse> {
	const result = await api.post<PartResponse>('/parts', data);
	apiCache.invalidate('parts:*'); // Invalidate all parts cache entries
	apiCache.invalidate(cacheKeys.dashboard()); // Invalidate dashboard
	return result;
}

export async function updatePart(id: string, data: PartUpdate): Promise<PartResponse> {
	const result = await api.put<PartResponse>(`/parts/${id}`, data);
	apiCache.invalidate('parts:*');
	apiCache.invalidate(cacheKeys.part(id));
	apiCache.invalidate(cacheKeys.dashboard());
	return result;
}

export async function deletePart(id: string): Promise<void> {
	await api.delete<void>(`/parts/${id}`);
	apiCache.invalidate('parts:*');
	apiCache.invalidate(cacheKeys.part(id));
	apiCache.invalidate(cacheKeys.dashboard());
}

export async function getPartMovements(
	id: string,
	params?: PaginationParams
): Promise<PaginatedResponse<PartMovementResponse>> {
	return api.get<PaginatedResponse<PartMovementResponse>>(
		`/parts/${id}/movements`,
		params as Record<string, string | number | boolean>
	);
}
