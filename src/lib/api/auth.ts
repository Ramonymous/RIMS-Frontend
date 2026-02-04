/**
 * Authentication API functions
 */

import api from './client.js';
import type { LoginRequest, TokenResponse } from './types.js';

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
	const response = await api.post<TokenResponse>('/auth/login', credentials);

	// Store the access token
	localStorage.setItem('access_token', response.access_token);
	localStorage.setItem('user', JSON.stringify(response.user));

	return response;
}

export function logout(): void {
	localStorage.removeItem('access_token');
	localStorage.removeItem('user');
}

export function getStoredToken(): string | null {
	return localStorage.getItem('access_token');
}

export function getStoredUser(): TokenResponse['user'] | null {
	const userStr = localStorage.getItem('user');
	if (!userStr) return null;
	try {
		return JSON.parse(userStr);
	} catch {
		return null;
	}
}

export function isAuthenticated(): boolean {
	return !!getStoredToken();
}
