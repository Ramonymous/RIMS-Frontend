/**
 * Authentication store using Svelte 5 runes
 */

import {
	getStoredToken,
	getStoredUser,
	logout as authLogout,
	login as authLogin
} from '$lib/api/auth.js';
import type { UserResponse, LoginRequest } from '$lib/api/types.js';

interface AuthState {
	user: UserResponse | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}

function createAuthStore() {
	let user = $state<UserResponse | null>(null);
	let token = $state<string | null>(null);
	let isLoading = $state(false);

	// Initialize from localStorage (client-side only)
	function initialize() {
		if (typeof window !== 'undefined') {
			token = getStoredToken();
			user = getStoredUser();
		}
	}

	async function login(credentials: LoginRequest): Promise<void> {
		isLoading = true;
		try {
			const response = await authLogin(credentials);
			token = response.access_token;
			user = response.user;
		} finally {
			isLoading = false;
		}
	}

	function logout(): void {
		authLogout();
		token = null;
		user = null;
	}

	function hasPermission(permission: string): boolean {
		return user?.permissions.includes(permission) ?? false;
	}

	return {
		get user() {
			return user;
		},
		get token() {
			return token;
		},
		get isAuthenticated() {
			return !!token;
		},
		get isLoading() {
			return isLoading;
		},
		initialize,
		login,
		logout,
		hasPermission
	};
}

export const auth = createAuthStore();
