import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

// Timezone configuration
export const TIMEZONE = 'Asia/Jakarta';

/**
 * Get current date in Asia/Jakarta timezone
 */
export function nowJakarta(): Date {
	return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Format a Date object to YYYY-MM-DD string in Asia/Jakarta timezone
 */
export function formatDateLocal(date: Date): string {
	const jakartaDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
	const year = jakartaDate.getFullYear();
	const month = String(jakartaDate.getMonth() + 1).padStart(2, '0');
	const day = String(jakartaDate.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Format an ISO date string to localized display format in Asia/Jakarta timezone
 */
export function formatDateTime(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('id-ID', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format an ISO date string to date only in Asia/Jakarta timezone
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('id-ID', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Convert a Date (representing Jakarta time) to an ISO string with correct UTC offset.
 * This avoids the timezone shift that occurs with toISOString().
 */
export function toISOStringJakarta(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	const ms = String(date.getMilliseconds()).padStart(3, '0');
	// Jakarta is UTC+7
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+07:00`;
}

/**
 * Get first day of current month in Asia/Jakarta timezone
 */
export function getFirstOfMonth(): Date {
	const now = nowJakarta();
	return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Get last day of current month in Asia/Jakarta timezone
 */
export function getLastOfMonth(): Date {
	const now = nowJakarta();
	return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

/**
 * Debounce a function call
 * @param fn Function to debounce
 * @param delay Delay in milliseconds (default: 300ms)
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
	fn: T,
	delay = 300
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, delay);
	};
}

/**
 * Throttle a function call
 * @param fn Function to throttle
 * @param limit Time limit in milliseconds
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
	fn: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle = false;

	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			fn(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}
