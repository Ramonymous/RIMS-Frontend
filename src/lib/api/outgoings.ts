/**
 * Outgoings API service
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	OutgoingResponse,
	OutgoingCreate,
	OutgoingUpdate,
	PaginatedResponse,
	PaginationParams
} from './types.js';

export interface OutgoingsListParams extends PaginationParams {
	status_filter?: 'draft' | 'completed' | 'cancelled';
	pending_gi?: boolean;
	doc_number?: string;
}

function invalidateOutgoingsCache(): void {
	apiCache.invalidate('outgoings*');
	apiCache.invalidate(cacheKeys.dashboard());
	apiCache.invalidate('parts*'); // Stock may change
	apiCache.invalidate('movements*');
}

export async function getOutgoings(
	params?: OutgoingsListParams
): Promise<PaginatedResponse<OutgoingResponse>> {
	return api.get<PaginatedResponse<OutgoingResponse>>(
		'/outgoings',
		params as Record<string, string | number | boolean>
	);
}

export async function getOutgoing(id: string): Promise<OutgoingResponse> {
	return api.get<OutgoingResponse>(`/outgoings/${id}`);
}

export async function createOutgoing(data: OutgoingCreate): Promise<OutgoingResponse> {
	const result = await api.post<OutgoingResponse>('/outgoings', data);
	invalidateOutgoingsCache();
	return result;
}

export async function updateOutgoing(id: string, data: OutgoingUpdate): Promise<OutgoingResponse> {
	const result = await api.put<OutgoingResponse>(`/outgoings/${id}`, data);
	invalidateOutgoingsCache();
	return result;
}

export async function deleteOutgoing(id: string): Promise<void> {
	await api.delete<void>(`/outgoings/${id}`);
	invalidateOutgoingsCache();
}

export async function completeOutgoing(id: string): Promise<OutgoingResponse> {
	const result = await api.put<OutgoingResponse>(`/outgoings/${id}/complete`);
	invalidateOutgoingsCache();
	return result;
}

export async function cancelOutgoing(id: string): Promise<OutgoingResponse> {
	const result = await api.put<OutgoingResponse>(`/outgoings/${id}/cancel`);
	invalidateOutgoingsCache();
	return result;
}

export async function confirmGI(id: string): Promise<OutgoingResponse> {
	const result = await api.put<OutgoingResponse>(`/outgoings/${id}/confirm-gi`);
	invalidateOutgoingsCache();
	return result;
}
