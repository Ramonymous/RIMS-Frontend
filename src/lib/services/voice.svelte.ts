/**
 * Voice announcement service using Web Speech API.
 *
 * Provides text-to-speech functionality for announcing
 * new request items with priority queue management.
 * Uses Indonesian (id-ID) voice synthesis.
 *
 * Announcement order: urgent → delayed → normal
 *
 * Pronunciations:
 * - urgent: "Perhatian, Ada permintaan part urgent: {part}"
 * - delay: "Part {part} masih menunggu" (reminder every 5 minutes)
 * - normal: "Ada permintaan part {part}"
 */

interface VoiceState {
	isSupported: boolean;
	isEnabled: boolean;
	isSpeaking: boolean;
	permissionGranted: boolean;
	queueLength: number;
}

interface RequestItemForVoice {
	id: string;
	part: {
		part_number: string;
		part_name: string;
		stock: number;
	};
	qty: number;
	is_urgent: boolean;
	request: {
		destination: string | null;
		request_number: string;
	};
}

type AnnouncementType = 'urgent' | 'delayed' | 'normal' | 'reminder';

interface QueueItem {
	item: RequestItemForVoice;
	type: AnnouncementType;
	priority: number; // Lower = higher priority (urgent=0, delayed=1, normal=2)
}

class VoiceService {
	private synthesis: SpeechSynthesis | null = null;
	private queue: QueueItem[] = [];
	private isProcessing = false;
	private announcedItems = new Set<string>(); // Track announced items to avoid duplicates
	private reminderItems = new Map<string, number>(); // Track reminder timestamps
	private _state = $state<VoiceState>({
		isSupported: false,
		isEnabled: false,
		isSpeaking: false,
		permissionGranted: false,
		queueLength: 0
	});

	constructor() {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			this.synthesis = window.speechSynthesis;
			this._state.isSupported = true;
		}
	}

	get state(): VoiceState {
		return this._state;
	}

	/**
	 * Initialize the voice service and check for permission.
	 */
	async initialize(): Promise<boolean> {
		if (!this.synthesis) {
			console.warn('Speech synthesis not supported in this browser');
			return false;
		}

		const synthesis = this.synthesis;

		// Try a silent utterance to check if voice is available
		return new Promise((resolve) => {
			const testUtterance = new SpeechSynthesisUtterance('');
			testUtterance.volume = 0;
			testUtterance.onend = () => {
				this._state.permissionGranted = true;
				resolve(true);
			};
			testUtterance.onerror = () => {
				resolve(false);
			};

			// Wait for voices to load
			const checkVoices = () => {
				const voices = synthesis.getVoices();
				if (voices.length > 0) {
					synthesis.speak(testUtterance);
				} else {
					setTimeout(checkVoices, 100);
				}
			};

			if (synthesis.getVoices().length > 0) {
				synthesis.speak(testUtterance);
			} else {
				synthesis.onvoiceschanged = checkVoices;
				setTimeout(() => {
					this._state.permissionGranted = true;
					resolve(true);
				}, 500);
			}
		});
	}

	/**
	 * Enable voice announcements.
	 */
	enable(): void {
		if (this._state.isSupported) {
			this._state.isEnabled = true;
			this._state.permissionGranted = true;
		}
	}

	/**
	 * Disable voice announcements and clear queue.
	 */
	disable(): void {
		this._state.isEnabled = false;
		this.queue = [];
		this._state.queueLength = 0;
		if (this.synthesis) {
			this.synthesis.cancel();
		}
		this._state.isSpeaking = false;
	}

	/**
	 * Toggle voice announcements.
	 */
	toggle(): boolean {
		if (this._state.isEnabled) {
			this.disable();
		} else {
			this.enable();
		}
		return this._state.isEnabled;
	}

	/**
	 * Announce a new request item.
	 * Priority: urgent (0) → delayed (1) → normal (2)
	 */
	announceItem(item: RequestItemForVoice, isDelayed: boolean = false): void {
		if (!this._state.isEnabled) return;

		// Avoid duplicate announcements for the same item
		const key = `${item.id}-new`;
		if (this.announcedItems.has(key)) return;
		this.announcedItems.add(key);

		let type: AnnouncementType;
		let priority: number;

		if (item.is_urgent) {
			type = 'urgent';
			priority = 0;
		} else if (isDelayed) {
			type = 'delayed';
			priority = 1;
		} else {
			type = 'normal';
			priority = 2;
		}

		this.queueAnnouncement({ item, type, priority });
	}

	/**
	 * Remind about an existing pending item.
	 * Only reminds if 5 minutes have passed since last reminder.
	 */
	remindItem(item: RequestItemForVoice): void {
		if (!this._state.isEnabled) return;

		const now = Date.now();
		const lastReminder = this.reminderItems.get(item.id) || 0;
		const FIVE_MINUTES = 5 * 60 * 1000;

		// Only remind if 5 minutes have passed
		if (now - lastReminder < FIVE_MINUTES) return;

		this.reminderItems.set(item.id, now);

		// Reminders have lower priority than new items
		const priority = item.is_urgent ? 3 : 4;

		this.queueAnnouncement({ item, type: 'reminder', priority });
	}

	/**
	 * Clear the announced items set (useful when items are supplied/removed)
	 */
	clearAnnouncedItem(itemId: string): void {
		this.announcedItems.delete(`${itemId}-new`);
		this.reminderItems.delete(itemId);
	}

	private buildAnnouncementText(item: RequestItemForVoice, type: AnnouncementType): string {
		const partNumber = item.part.part_number;

		switch (type) {
			case 'urgent':
				// "Perhatian, Ada permintaan part urgent: {part}"
				return `Perhatian, Ada permintaan part urgent: ${partNumber}`;

			case 'delayed':
				// For delayed items (>5 min) on first announcement
				return `Part ${partNumber} sudah menunggu lama`;

			case 'reminder':
				// "Part {part} masih menunggu"
				return `Part ${partNumber} masih menunggu`;

			case 'normal':
			default:
				// "Ada permintaan part {part}"
				return `Ada permintaan part ${partNumber}`;
		}
	}

	private queueAnnouncement(queueItem: QueueItem): void {
		// Insert based on priority (lower priority number = higher priority)
		let insertIndex = this.queue.length;
		for (let i = 0; i < this.queue.length; i++) {
			if (queueItem.priority < this.queue[i].priority) {
				insertIndex = i;
				break;
			}
		}
		this.queue.splice(insertIndex, 0, queueItem);

		this._state.queueLength = this.queue.length;
		this.processQueue();
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.queue.length === 0 || !this._state.isEnabled) {
			return;
		}

		this.isProcessing = true;
		this._state.isSpeaking = true;

		const queueItem = this.queue.shift();
		this._state.queueLength = this.queue.length;

		if (queueItem) {
			const text = this.buildAnnouncementText(queueItem.item, queueItem.type);
			await this.speak(text);

			// Small delay between announcements
			await new Promise((resolve) => setTimeout(resolve, 800));
		}

		this.isProcessing = false;
		this._state.isSpeaking = false;

		// Process next item if queue not empty
		if (this.queue.length > 0) {
			this.processQueue();
		}
	}

	private speak(text: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.synthesis) {
				reject(new Error('Speech synthesis not available'));
				return;
			}

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = 0.9; // Slightly slower for clarity
			utterance.pitch = 1.0;
			utterance.volume = 1.0;
			utterance.lang = 'id-ID'; // Indonesian

			// Try to use Indonesian voice
			const voices = this.synthesis.getVoices();
			const indonesianVoice =
				voices.find((v) => v.lang.startsWith('id') || v.lang === 'id-ID') ||
				voices.find(
					(v) => v.lang.startsWith('ms') // Malay as fallback (similar)
				);

			if (indonesianVoice) {
				utterance.voice = indonesianVoice;
			}

			utterance.onend = () => resolve();
			utterance.onerror = (event) => {
				console.error('Speech error:', event);
				resolve(); // Don't reject, just continue
			};

			this.synthesis.speak(utterance);
		});
	}

	/**
	 * Announce multiple items at once.
	 * Sorts by priority: urgent → delayed → normal
	 */
	announceItems(items: RequestItemForVoice[], getDelayMinutes?: (id: string) => number): void {
		if (!this._state.isEnabled) return;

		// Sort: urgent first, then by delay
		const sorted = [...items].sort((a, b) => {
			// Priority 1: Urgent items first
			if (a.is_urgent && !b.is_urgent) return -1;
			if (!a.is_urgent && b.is_urgent) return 1;

			// Priority 2: Delayed items
			if (getDelayMinutes) {
				const aDelay = getDelayMinutes(a.id);
				const bDelay = getDelayMinutes(b.id);
				const aIsDelayed = aDelay > 5;
				const bIsDelayed = bDelay > 5;

				if (aIsDelayed && !bIsDelayed) return -1;
				if (!aIsDelayed && bIsDelayed) return 1;
			}

			return 0;
		});

		for (const item of sorted) {
			const isDelayed = getDelayMinutes ? getDelayMinutes(item.id) > 5 : false;
			this.announceItem(item, isDelayed);
		}
	}
}

// Singleton instance
export const voiceService = new VoiceService();
