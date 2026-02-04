/**
 * API Client for communicating with FastAPI backend
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Request cancellation via AbortController
 * - Rate limit handling (429)
 * - Request deduplication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ApiError {
	detail: string;
	status: number;
	retryAfter?: number;
}

export interface ValidationError {
	loc: (string | number)[];
	msg: string;
	type: string;
}

export interface HTTPValidationError {
	detail: ValidationError[];
}

export interface RequestOptions {
	/** Number of retry attempts for failed requests */
	retries?: number;
	/** AbortSignal for request cancellation */
	signal?: AbortSignal;
	/** Skip authentication header */
	noAuth?: boolean;
}

// Active request tracking for deduplication
const activeRequests = new Map<string, Promise<unknown>>();

class ApiClient {
	private baseUrl: string;
	private defaultRetries = 2;
	private retryDelay = 1000;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	private getAuthHeaders(noAuth?: boolean): HeadersInit {
		const headers: HeadersInit = {
			'Content-Type': 'application/json'
		};
		if (!noAuth) {
			const token = localStorage.getItem('access_token');
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
		}
		return headers;
	}

	/**
	 * Sleep for exponential backoff
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Check if error is retryable
	 */
	private isRetryable(status: number): boolean {
		// Retry on server errors (5xx) and some client errors
		return status >= 500 || status === 408 || status === 429;
	}

	private async handleResponse<T>(response: Response): Promise<T> {
		// Handle rate limiting (429)
		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
			throw {
				detail: 'Rate limit exceeded. Please wait before trying again.',
				status: 429,
				retryAfter
			} as ApiError;
		}

		if (!response.ok) {
			let errorMessage = 'An error occurred';
			try {
				const errorData = await response.json();
				if (typeof errorData.detail === 'string') {
					errorMessage = errorData.detail;
				} else if (Array.isArray(errorData.detail)) {
					// Validation errors
					errorMessage = errorData.detail.map((e: ValidationError) => e.msg).join(', ');
				}
			} catch {
				errorMessage = response.statusText;
			}
			throw { detail: errorMessage, status: response.status } as ApiError;
		}

		// Handle 204 No Content
		if (response.status === 204) {
			return undefined as T;
		}

		return response.json();
	}

	/**
	 * Execute fetch with retry logic
	 */
	private async fetchWithRetry<T>(
		url: string,
		init: RequestInit,
		options: RequestOptions = {}
	): Promise<T> {
		const maxRetries = options.retries ?? this.defaultRetries;
		let lastError: ApiError | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				let response = await fetch(url, {
					...init,
					signal: options.signal
				});

				// Auto refresh token on 401
				if (response.status === 401 && !options.noAuth) {
					const refreshToken = localStorage.getItem('refresh_token');
					if (refreshToken) {
						const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ refresh_token: refreshToken })
						});
						if (refreshRes.ok) {
							const data = await refreshRes.json();
							localStorage.setItem('access_token', data.access_token);
							localStorage.setItem('refresh_token', data.refresh_token);
							// Retry original request with new access token
							if (init.headers && typeof init.headers === 'object') {
								(init.headers as Record<string, string>)['Authorization'] =
									`Bearer ${data.access_token}`;
							} else {
								init.headers = { ...this.getAuthHeaders(false) };
							}
							response = await fetch(url, {
								...init,
								signal: options.signal
							});
						} else {
							// Refresh failed, clear tokens
							localStorage.removeItem('access_token');
							localStorage.removeItem('refresh_token');
						}
					}
				}

				// Don't retry on success or non-retryable errors
				if (response.ok || !this.isRetryable(response.status)) {
					return this.handleResponse<T>(response);
				}

				// Handle rate limiting with Retry-After
				if (response.status === 429) {
					const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
					if (attempt < maxRetries) {
						await this.sleep(retryAfter * 1000);
						continue;
					}
				}

				lastError = await this.handleResponse<T>(response).catch((e) => e);
			} catch (e) {
				// Handle abort
				if (e instanceof Error && e.name === 'AbortError') {
					throw { detail: 'Request cancelled', status: 0 } as ApiError;
				}

				// Network errors are retryable
				if (attempt < maxRetries) {
					await this.sleep(this.retryDelay * Math.pow(2, attempt));
					continue;
				}

				throw { detail: 'Network error. Please check your connection.', status: 0 } as ApiError;
			}
		}

		throw lastError || { detail: 'Request failed after retries', status: 0 };
	}

	/**
	 * Generate request key for deduplication
	 */
	private getRequestKey(method: string, endpoint: string, params?: unknown): string {
		return `${method}:${endpoint}:${params ? JSON.stringify(params) : ''}`;
	}

	async get<T>(
		endpoint: string,
		params?: Record<string, string | number | boolean>,
		options?: RequestOptions
	): Promise<T> {
		const url = new URL(`${this.baseUrl}${endpoint}`);
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, String(value));
				}
			});
		}

		// Deduplicate GET requests
		const requestKey = this.getRequestKey('GET', endpoint, params);
		const existing = activeRequests.get(requestKey);
		if (existing) {
			return existing as Promise<T>;
		}

		const promise = this.fetchWithRetry<T>(
			url.toString(),
			{
				method: 'GET',
				headers: this.getAuthHeaders(options?.noAuth)
			},
			options
		).finally(() => {
			activeRequests.delete(requestKey);
		});

		activeRequests.set(requestKey, promise);
		return promise;
	}

	async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
		return this.fetchWithRetry<T>(
			`${this.baseUrl}${endpoint}`,
			{
				method: 'POST',
				headers: this.getAuthHeaders(options?.noAuth),
				body: data ? JSON.stringify(data) : undefined
			},
			options
		);
	}

	async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
		return this.fetchWithRetry<T>(
			`${this.baseUrl}${endpoint}`,
			{
				method: 'PUT',
				headers: this.getAuthHeaders(options?.noAuth),
				body: data ? JSON.stringify(data) : undefined
			},
			options
		);
	}

	async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
		return this.fetchWithRetry<T>(
			`${this.baseUrl}${endpoint}`,
			{
				method: 'DELETE',
				headers: this.getAuthHeaders(options?.noAuth)
			},
			options
		);
	}
}

export const api = new ApiClient();
export default api;
