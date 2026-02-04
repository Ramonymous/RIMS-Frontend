/**
 * Requests API service
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	RequestResponse,
	RequestCreate,
	RequestUpdate,
	PaginatedResponse,
	PaginationParams
} from './types.js';

export interface RequestsListParams extends PaginationParams {
	status_filter?: 'draft' | 'completed' | 'cancelled';
	request_number?: string;
}

function invalidateRequestsCache(): void {
	apiCache.invalidate('requests*');
	apiCache.invalidate(cacheKeys.dashboard());
}

export async function getRequests(
	params?: RequestsListParams
): Promise<PaginatedResponse<RequestResponse>> {
	return api.get<PaginatedResponse<RequestResponse>>(
		'/requests',
		params as Record<string, string | number | boolean>
	);
}

export async function getRequest(id: string): Promise<RequestResponse> {
	return api.get<RequestResponse>(`/requests/${id}`);
}

export async function createRequest(data: RequestCreate): Promise<RequestResponse> {
	const result = await api.post<RequestResponse>('/requests', data);
	invalidateRequestsCache();
	return result;
}

export async function updateRequest(id: string, data: RequestUpdate): Promise<RequestResponse> {
	const result = await api.put<RequestResponse>(`/requests/${id}`, data);
	invalidateRequestsCache();
	return result;
}

export async function deleteRequest(id: string): Promise<void> {
	await api.delete<void>(`/requests/${id}`);
	invalidateRequestsCache();
}

export async function completeRequest(id: string): Promise<RequestResponse> {
	const result = await api.put<RequestResponse>(`/requests/${id}/complete`);
	invalidateRequestsCache();
	return result;
}

export async function cancelRequest(id: string): Promise<RequestResponse> {
	const result = await api.put<RequestResponse>(`/requests/${id}/cancel`);
	invalidateRequestsCache();
	return result;
}

export async function supplyRequestItem(itemId: string, qty?: number): Promise<RequestResponse> {
	const queryParams = qty ? `?qty=${qty}` : '';
	const result = await api.put<RequestResponse>(`/requests/items/${itemId}/supply${queryParams}`);
	invalidateRequestsCache();
	return result;
}
