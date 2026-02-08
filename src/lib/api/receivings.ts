/**
 * Receivings API service
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	ReceivingResponse,
	ReceivingCreate,
	ReceivingUpdate,
	PaginatedResponse,
	PaginationParams
} from './types.js';

export interface ReceivingsListParams extends PaginationParams {
	status_filter?: 'draft' | 'completed' | 'cancelled';
	pending_gr?: boolean;
	doc_number?: string;
}

function invalidateReceivingsCache(): void {
	apiCache.invalidate('receivings*');
	apiCache.invalidate(cacheKeys.dashboard());
	apiCache.invalidate('parts*'); // Stock may change
	apiCache.invalidate('movements*');
}

export async function getReceivings(
	params?: ReceivingsListParams
): Promise<PaginatedResponse<ReceivingResponse>> {
	return apiCache.getOrFetch(
		cacheKeys.receivings(params as Record<string, unknown> | undefined),
		() =>
			api.get<PaginatedResponse<ReceivingResponse>>(
				'/v1/inventory/receivings',
				params as Record<string, string | number | boolean>
			),
		30_000
	);
}

export async function getReceiving(id: string): Promise<ReceivingResponse> {
	return apiCache.getOrFetch(
		`receiving:${id}`,
		() => api.get<ReceivingResponse>(`/v1/inventory/receivings/${id}`),
		30_000
	);
}

export async function createReceiving(data: ReceivingCreate): Promise<ReceivingResponse> {
	const result = await api.post<ReceivingResponse>('/v1/inventory/receivings', data);
	invalidateReceivingsCache();
	return result;
}

export async function updateReceiving(
	id: string,
	data: ReceivingUpdate
): Promise<ReceivingResponse> {
	const result = await api.put<ReceivingResponse>(`/v1/inventory/receivings/${id}`, data);
	invalidateReceivingsCache();
	return result;
}

export async function deleteReceiving(id: string): Promise<void> {
	await api.delete<void>(`/v1/inventory/receivings/${id}`);
	invalidateReceivingsCache();
}

export async function completeReceiving(id: string): Promise<ReceivingResponse> {
	const result = await api.put<ReceivingResponse>(`/v1/inventory/receivings/${id}/complete`);
	invalidateReceivingsCache();
	return result;
}

export async function cancelReceiving(id: string): Promise<ReceivingResponse> {
	const result = await api.put<ReceivingResponse>(`/v1/inventory/receivings/${id}/cancel`);
	invalidateReceivingsCache();
	return result;
}

export async function confirmGR(id: string): Promise<ReceivingResponse> {
	const result = await api.put<ReceivingResponse>(`/v1/inventory/receivings/${id}/confirm-gr`);
	invalidateReceivingsCache();
	return result;
}
