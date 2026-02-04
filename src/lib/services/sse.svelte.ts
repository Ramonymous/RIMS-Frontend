/**
 * Server-Sent Events (SSE) client for real-time updates.
 *
 * Connects to the FastAPI SSE endpoint and provides
 * reactive state for connection status and incoming events.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface SSEEvent {
	type: string;
	data: Record<string, unknown>;
	timestamp: string;
}

export interface RequestItemEvent {
	id: string;
	part: {
		id: string;
		part_number: string;
		part_name: string;
		stock: number;
	};
	qty: number;
	is_urgent: boolean;
	is_supplied: boolean;
	request: {
		id: string;
		request_number: string;
		destination: string;
		requested_at: string;
	};
}

type EventHandler<T = unknown> = (data: T) => void;

class SSEClient {
	private eventSource: EventSource | null = null;
	private handlers: Map<string, Set<EventHandler>> = new Map();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 1000;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	private _state = $state({
		isConnected: false,
		isConnecting: false,
		error: null as string | null,
		lastEventTime: null as Date | null
	});

	get state() {
		return this._state;
	}

	/**
	 * Connect to the SSE endpoint.
	 */
	connect(): void {
		if (this.eventSource || this._state.isConnecting) {
			return;
		}

		this._state.isConnecting = true;
		this._state.error = null;

		try {
			const url = `${API_BASE_URL}/events/stream`;
			this.eventSource = new EventSource(url);

			this.eventSource.onopen = () => {
				console.log('[SSE] Connected to event stream');
				this._state.isConnected = true;
				this._state.isConnecting = false;
				this.reconnectAttempts = 0;
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as SSEEvent;
					this._state.lastEventTime = new Date();
					this.dispatchEvent(data.type, data.data);
				} catch (e) {
					console.error('[SSE] Failed to parse event:', e);
				}
			};

			this.eventSource.onerror = (error) => {
				console.error('[SSE] Connection error:', error);
				this._state.isConnected = false;
				this._state.isConnecting = false;
				this._state.error = 'Connection lost';

				// Close and attempt reconnect
				this.eventSource?.close();
				this.eventSource = null;
				this.scheduleReconnect();
			};
		} catch (e) {
			console.error('[SSE] Failed to connect:', e);
			this._state.isConnecting = false;
			this._state.error = 'Failed to connect';
			this.scheduleReconnect();
		}
	}

	/**
	 * Disconnect from the SSE endpoint.
	 */
	disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		this._state.isConnected = false;
		this._state.isConnecting = false;
		this.reconnectAttempts = 0;
		console.log('[SSE] Disconnected');
	}

	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('[SSE] Max reconnection attempts reached');
			this._state.error = 'Connection failed after multiple attempts';
			return;
		}

		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
		this.reconnectAttempts++;

		console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimer = setTimeout(() => {
			this.connect();
		}, delay);
	}

	/**
	 * Subscribe to a specific event type.
	 */
	on<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
		if (!this.handlers.has(eventType)) {
			this.handlers.set(eventType, new Set());
		}

		this.handlers.get(eventType)!.add(handler as EventHandler);

		// Return unsubscribe function
		return () => {
			this.handlers.get(eventType)?.delete(handler as EventHandler);
		};
	}

	/**
	 * Subscribe to request item created events.
	 */
	onRequestItemCreated(handler: EventHandler<RequestItemEvent>): () => void {
		return this.on('request_item_created', handler);
	}

	/**
	 * Subscribe to request item supplied events.
	 */
	onRequestItemSupplied(
		handler: EventHandler<{ item_id: string; part_number: string }>
	): () => void {
		return this.on('request_item_supplied', handler);
	}

	private dispatchEvent(eventType: string, data: unknown): void {
		const handlers = this.handlers.get(eventType);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(data);
				} catch (e) {
					console.error(`[SSE] Handler error for ${eventType}:`, e);
				}
			}
		}
	}
}

// Singleton instance
export const sseClient = new SSEClient();
