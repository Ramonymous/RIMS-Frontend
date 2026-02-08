import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	RequestResponse,
	RequestCreate,
	RequestUpdate,
	PaginatedResponse,
	PaginationParams
} from './types.js';

/**
 * Types & Interfaces
 */
export interface RequestsListParams extends PaginationParams {
	status_filter?: 'draft' | 'completed' | 'cancelled';
	request_number?: string;
}

/**
 * Cache Helpers
 */
function invalidateRequestsCache(): void {
	apiCache.invalidate('requests*');
	apiCache.invalidate(cacheKeys.dashboard());
}

/**
 * Requests API Service
 */

// --- Read Operations ---

export async function getRequests(
	params?: RequestsListParams
): Promise<PaginatedResponse<RequestResponse>> {
	return apiCache.getOrFetch(
		cacheKeys.requests(params as Record<string, unknown> | undefined),
		() =>
			api.get<PaginatedResponse<RequestResponse>>(
				'/v1/inventory/requests',
				params as Record<string, string | number | boolean>
			),
		30_000
	);
}

export async function getRequest(id: string): Promise<RequestResponse> {
	return apiCache.getOrFetch(
		`request:${id}`,
		() => api.get<RequestResponse>(`/v1/inventory/requests/${id}`),
		30_000
	);
}

// --- Write Operations ---

export async function createRequest(data: RequestCreate): Promise<RequestResponse> {
	const result = await api.post<RequestResponse>('/v1/inventory/requests', data);
	invalidateRequestsCache();
	return result;
}

export async function updateRequest(id: string, data: RequestUpdate): Promise<RequestResponse> {
	const result = await api.put<RequestResponse>(`/v1/inventory/requests/${id}`, data);
	invalidateRequestsCache();
	return result;
}

export async function deleteRequest(id: string): Promise<void> {
	await api.delete<void>(`/v1/inventory/requests/${id}`);
	invalidateRequestsCache();
}

// --- Action Operations ---

export async function completeRequest(id: string): Promise<RequestResponse> {
	const result = await api.put<RequestResponse>(`/v1/inventory/requests/${id}/complete`);
	invalidateRequestsCache();
	return result;
}

export async function cancelRequest(id: string): Promise<RequestResponse> {
	const result = await api.put<RequestResponse>(`/v1/inventory/requests/${id}/cancel`);
	invalidateRequestsCache();
	return result;
}

export async function supplyRequestItem(itemId: string, qty?: number): Promise<RequestResponse> {
	const queryParams = qty ? `?qty=${qty}` : '';
	const result = await api.put<RequestResponse>(
		`/v1/inventory/requests/items/${itemId}/supply${queryParams}`
	);
	invalidateRequestsCache();
	return result;
}
