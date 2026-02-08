/**
 * Users API service
 */

import api from './client.js';
import { apiCache, cacheKeys } from './cache.js';
import type {
	UserResponse,
	UserCreate,
	UserUpdate,
	PaginatedResponse,
	PaginationParams
} from './types.js';

export type UsersListParams = PaginationParams;

function invalidateUsersCache(): void {
	apiCache.invalidate('users*');
}

export async function getUsers(params?: UsersListParams): Promise<PaginatedResponse<UserResponse>> {
	return apiCache.getOrFetch(
		cacheKeys.users(params as Record<string, unknown> | undefined),
		() =>
			api.get<PaginatedResponse<UserResponse>>(
				'/v1/users',
				params as Record<string, string | number | boolean>
			),
		30_000
	);
}

export async function getUser(id: string): Promise<UserResponse> {
	return apiCache.getOrFetch(`user:${id}`, () => api.get<UserResponse>(`/v1/users/${id}`), 30_000);
}

export async function createUser(data: UserCreate): Promise<UserResponse> {
	const result = await api.post<UserResponse>('/v1/users', data);
	invalidateUsersCache();
	return result;
}

export async function updateUser(id: string, data: UserUpdate): Promise<UserResponse> {
	const result = await api.put<UserResponse>(`/v1/users/${id}`, data);
	invalidateUsersCache();
	return result;
}

export async function deleteUser(id: string): Promise<void> {
	await api.delete<void>(`/v1/users/${id}`);
	invalidateUsersCache();
}
