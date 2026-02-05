<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { flip } from 'svelte/animate';
	import { fade, slide, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { getParts, pickRequestItem } from '$lib/api/parts.js';
	import { getRequests, supplyRequestItem } from '$lib/api/requests.js';
	import type { PartResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import { sseClient, type RequestItemEvent } from '$lib/services/sse.svelte.js';
	import { voiceService } from '$lib/services/voice.svelte.js';
	import { formatDateTime } from '$lib/utils.js';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import QrScanner from '$lib/components/qr-scanner.svelte';

	// Icons
	import RefreshIcon from '@tabler/icons-svelte/icons/refresh';
	import VolumeIcon from '@tabler/icons-svelte/icons/volume';
	import VolumeOffIcon from '@tabler/icons-svelte/icons/volume-off';
	import AlertCircleIcon from '@tabler/icons-svelte/icons/alert-circle';
	import PackageIcon from '@tabler/icons-svelte/icons/package';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import MapPinIcon from '@tabler/icons-svelte/icons/map-pin';
	import WifiIcon from '@tabler/icons-svelte/icons/wifi';
	import WifiOffIcon from '@tabler/icons-svelte/icons/wifi-off';
	import UserIcon from '@tabler/icons-svelte/icons/user';
	import ClockIcon from '@tabler/icons-svelte/icons/clock';
	import HashIcon from '@tabler/icons-svelte/icons/hash';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import ScanIcon from '@tabler/icons-svelte/icons/scan';
	import KeyboardIcon from '@tabler/icons-svelte/icons/keyboard';
	import MinusIcon from '@tabler/icons-svelte/icons/minus';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import BuildingWarehouseIcon from '@tabler/icons-svelte/icons/building-warehouse';

	// Types for pending items
	interface PendingItem {
		id: string;
		part: {
			id: string;
			part_number: string;
			part_name: string;
			stock: number;
			address?: string | null;
		};
		qty: number;
		is_urgent: boolean;
		is_supplied: boolean;
		request: {
			id: string;
			request_number: string;
			requested_by_name: string | null;
			destination: string | null;
			requested_at: string;
		};
	}

	// State
	let parts = $state<PartResponse[]>([]);
	let pendingItems = $state<PendingItem[]>([]);
	let loading = $state(true);
	let currentTime = $state(Date.now());
	let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
	let reminderInterval: ReturnType<typeof setInterval> | null = null;

	// Voice state from service
	const voiceState = $derived(voiceService.state);
	const sseState = $derived(sseClient.state);

	// Permissions
	const canSupply = $derived(auth.hasPermission('requests.supply'));
	const canChecklocation = $derived(auth.hasPermission('requests.locations'));

	// Supply dialog state
	let supplyDialogOpen = $state(false);
	let selectedItem = $state<PendingItem | null>(null);
	let supplyLoading = $state(false);

	// Verification state
	let verificationStep = $state<'verify' | 'quantity'>('verify');
	let partNumberInput = $state('');
	let supplyQty = $state(0);
	let isVerified = $state(false);
	let verificationError = $state<string | null>(null);

	// Computed delays for each item
	const itemDelays = $derived.by(() => {
		const now = currentTime;
		const delays = new SvelteMap<string, number>();
		for (const item of pendingItems) {
			const requestTime = new Date(item.request.requested_at).getTime();
			delays.set(item.id, Math.floor((now - requestTime) / 60000));
		}
		return delays;
	});

	// Derived Stats
	const stats = $derived.by(() => {
		const urgent = pendingItems.filter((i) => i.is_urgent).length;
		const delayed = pendingItems.filter((i) => (itemDelays.get(i.id) || 0) > 10).length;
		return {
			total: pendingItems.length,
			urgent,
			delayed,
			normal: pendingItems.length - urgent - delayed
		};
	});

	// Sorted items: urgent → delayed → normal
	const sortedItems = $derived.by(() => {
		const delays = itemDelays;
		return [...pendingItems].sort((a, b) => {
			const aDelay = delays.get(a.id) || 0;
			const bDelay = delays.get(b.id) || 0;

			if (a.is_urgent && !b.is_urgent) return -1;
			if (!a.is_urgent && b.is_urgent) return 1;

			const aIsDelayed = aDelay > 5;
			const bIsDelayed = bDelay > 5;

			if (aIsDelayed && !bIsDelayed) return -1;
			if (!aIsDelayed && bIsDelayed) return 1;

			if (aIsDelayed && bIsDelayed) {
				return bDelay - aDelay;
			}

			return (
				new Date(b.request.requested_at).getTime() - new Date(a.request.requested_at).getTime()
			);
		});
	});

	function getDelayMinutes(itemId: string): number {
		return itemDelays.get(itemId) || 0;
	}

	function getItemStatusColor(item: PendingItem): string {
		if (item.is_urgent) return 'bg-red-500';
		const delay = getDelayMinutes(item.id);
		if (delay > 10) return 'bg-orange-500';
		if (delay > 5) return 'bg-yellow-500';
		return 'bg-blue-500';
	}

	function getStatusText(item: PendingItem): { text: string; class: string } {
		if (item.is_urgent)
			return {
				text: 'URGENT',
				class: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200'
			};
		const delay = getDelayMinutes(item.id);
		if (delay > 10)
			return {
				text: 'LATE',
				class:
					'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200'
			};
		if (delay > 5)
			return {
				text: 'WAITING',
				class:
					'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200'
			};
		return {
			text: 'NEW',
			class: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200'
		};
	}

	async function loadData() {
		loading = true;
		try {
			const [partsRes, requestsRes] = await Promise.all([
				getParts(),
				getRequests({ status_filter: 'completed' })
			]);

			const partsData = partsRes.items;
			const requestsData = requestsRes.items;
			parts = partsData;

			const items: PendingItem[] = [];
			for (const request of requestsData) {
				for (const item of request.items || []) {
					if (!item.is_supplied) {
						const part = partsData.find((p) => p.id === item.part_id);
						if (part) {
							items.push({
								id: item.id,
								part: {
									id: part.id,
									part_number: part.part_number,
									part_name: part.part_name,
									stock: part.stock,
									address: part.address
								},
								qty: item.qty,
								is_urgent: item.is_urgent,
								is_supplied: item.is_supplied,
								request: {
									id: request.id,
									request_number: request.request_number,
									requested_by_name: request.requested_by_name,
									destination: request.destination,
									requested_at: request.requested_at
								}
							});
						}
					}
				}
			}

			pendingItems = items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load data', { description: error.detail });
		} finally {
			loading = false;
		}
	}

	function announcePendingItems(items: PendingItem[]) {
		if (!voiceState.isEnabled || items.length === 0) return;

		const now = Date.now();
		const urgentItems: PendingItem[] = [];
		const delayedItems: PendingItem[] = [];
		const recentItems: PendingItem[] = [];

		for (const item of items) {
			const requestTime = new Date(item.request.requested_at).getTime();
			const delayMinutes = Math.floor((now - requestTime) / 60000);

			if (item.is_urgent) {
				urgentItems.push(item);
			} else if (delayMinutes > 5) {
				delayedItems.push(item);
			} else if (delayMinutes <= 5) {
				recentItems.push(item);
			}
		}

		const totalNeedAttention = urgentItems.length + delayedItems.length + recentItems.length;
		if (totalNeedAttention > 0) {
			for (const item of urgentItems) {
				voiceService.announceItem(item, false);
			}
			for (const item of delayedItems) {
				voiceService.announceItem(item, true);
			}
			if (recentItems.length <= 3) {
				for (const item of recentItems) {
					voiceService.announceItem(item, false);
				}
			} else if (recentItems.length > 0) {
				toast.info(`${recentItems.length} permintaan baru`, {
					description: 'Ada beberapa permintaan yang perlu disuplai'
				});
			}
		}
	}

	function handleNewItem(event: RequestItemEvent) {
		if (pendingItems.some((item) => item.id === event.id)) {
			return;
		}

		const newItem: PendingItem = {
			id: event.id,
			part: event.part,
			qty: event.qty,
			is_urgent: event.is_urgent,
			is_supplied: event.is_supplied,
			request: {
				id: event.request.id,
				request_number: event.request.request_number,
				destination: event.request.destination,
				requested_at: event.request.requested_at,
				requested_by_name: null
			}
		};

		pendingItems = [newItem, ...pendingItems];
		voiceService.announceItem(newItem, false);
		// toast.info('Permintaan baru diterima', {
		// 	description: `${newItem.part.part_number} untuk ${newItem.request.destination}`
		// });
	}

	function handleItemSupplied(data: { item_id: string; part_number: string }) {
		pendingItems = pendingItems.filter((item) => item.id !== data.item_id);
		voiceService.clearAnnouncedItem(data.item_id);
	}

	function toggleVoice() {
		voiceService.toggle();
		if (voiceState.isEnabled) {
			toast.success('Suara diaktifkan', {
				description: 'Anda akan mendengar pengumuman untuk permintaan baru'
			});
		} else {
			toast.info('Suara dinonaktifkan');
		}
	}

	async function runCheckLocation(item: PendingItem) {
		// Safety check for permissions
		if (!canChecklocation) {
			toast.error('Akses Ditolak', {
				description: 'Anda tidak memiliki izin (requests.locations) untuk fitur ini.'
			});
			return;
		}

		try {
			// Visual feedback that the action was triggered
			toast.info('Mengecek lokasi...', {
				description: `Mencari part ${item.part.part_number}. Perhatikan lampu di rak.`
			});

			// Call the API
			await pickRequestItem(item.part.part_number);
		} catch (e) {
			const error = e as ApiError;
			toast.error('Gagal mengecek lokasi', {
				description: error.detail || 'Terjadi kesalahan pada sistem IoT.'
			});
		}
	}

	function openSupplyDialog(item: PendingItem) {
		selectedItem = item;
		verificationStep = 'verify';
		partNumberInput = '';
		supplyQty = item.qty; // Default to requested quantity
		isVerified = false;
		verificationError = null;
		supplyDialogOpen = true;
	}

	function closeSupplyDialog() {
		supplyDialogOpen = false;
		selectedItem = null;
		verificationStep = 'verify';
		partNumberInput = '';
		supplyQty = 0;
		isVerified = false;
		verificationError = null;
	}

	function handleQrScan(scannedText: string) {
		partNumberInput = scannedText.trim();
		verifyPartNumber();
	}

	function verifyPartNumber() {
		if (!selectedItem) return;

		verificationError = null;
		const inputNormalized = partNumberInput.trim().toUpperCase();
		const expectedNormalized = selectedItem.part.part_number.trim().toUpperCase();

		if (inputNormalized === expectedNormalized) {
			isVerified = true;
			verificationStep = 'quantity';
			toast.success('Part number cocok!');
		} else {
			isVerified = false;
			verificationError = `Part number tidak cocok.`;
		}
	}

	async function confirmSupply() {
		if (!selectedItem || !isVerified) return;

		if (supplyQty <= 0) {
			toast.error('Jumlah supply harus lebih dari 0');
			return;
		}
		if (selectedItem && supplyQty > selectedItem.part.stock) {
			toast.error(
				`Jumlah supply tidak boleh melebihi stok gudang (${selectedItem.part.stock} pcs).`
			);
			return;
		}

		supplyLoading = true;
		try {
			await supplyRequestItem(selectedItem.id, supplyQty);
			voiceService.clearAnnouncedItem(selectedItem.id);
			pendingItems = pendingItems.filter((item) => item.id !== selectedItem!.id);

			toast.success('Item telah disuplai', {
				description: `${selectedItem.part.part_number} - ${supplyQty} pcs sudah disuplai`
			});

			closeSupplyDialog();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Gagal menyuplai item', { description: error.detail });
		} finally {
			supplyLoading = false;
		}
	}

	function checkReminders() {
		if (!voiceState.isEnabled) return;

		const delays = itemDelays;
		for (const item of pendingItems) {
			const delay = delays.get(item.id) || 0;
			if (item.is_urgent || delay > 5) {
				voiceService.remindItem(item);
			}
		}
	}

	onMount(async () => {
		await loadData();
		await voiceService.initialize();
		sseClient.connect();
		sseClient.onRequestItemCreated(handleNewItem);

		setTimeout(() => {
			if (pendingItems.length > 0) {
				announcePendingItems(pendingItems);
			}
		}, 1000);

		timeUpdateInterval = setInterval(() => {
			currentTime = Date.now();
		}, 60000);

		reminderInterval = setInterval(checkReminders, 300000);
	});

	onDestroy(() => {
		if (timeUpdateInterval) clearInterval(timeUpdateInterval);
		if (reminderInterval) clearInterval(reminderInterval);
		sseClient.disconnect();
	});
</script>

<svelte:head>
	<title>Supply Requests - ProjectRIMS</title>
</svelte:head>

<div class="flex min-h-screen flex-col gap-6 bg-muted/30 p-4 md:p-6">
	<!-- Header & Controls -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h1 class="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
					Pending Requests
					{#if sseState.isConnected}
						<span class="relative flex h-3 w-3">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
							></span>
							<span class="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
						</span>
					{:else}
						<Badge variant="outline" class="gap-1 border-dashed text-muted-foreground">
							<WifiOffIcon class="size-3" /> Offline
						</Badge>
					{/if}
				</h1>
				<p class="mt-1 text-muted-foreground">
					Monitor and fulfill material requests in real-time.
				</p>
			</div>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					onclick={toggleVoice}
					title={voiceState.isEnabled ? 'Mute' : 'Unmute'}
					class="relative h-10 w-10 rounded-full border-2"
				>
					{#if voiceState.isEnabled}
						<VolumeIcon class="size-5 text-primary" />
					{:else}
						<VolumeOffIcon class="size-5 text-muted-foreground" />
					{/if}
					{#if voiceState.isEnabled && voiceState.queueLength > 0}
						<span
							class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-background"
						>
							{voiceState.queueLength}
						</span>
					{/if}
				</Button>
				<Button variant="outline" size="lg" onclick={loadData} disabled={loading} class="gap-2">
					<RefreshIcon class="size-4 {loading ? 'animate-spin' : ''}" />
					Refresh
				</Button>
			</div>
		</div>

		<!-- Status Summary / KPI Cards -->
		{#if !loading && pendingItems.length > 0}
			<div class="grid grid-cols-2 gap-4 md:grid-cols-4" transition:slide>
				<div class="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
					<div
						class="rounded-md bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
					>
						<PackageIcon class="size-5" />
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground uppercase">Total Pending</p>
						<p class="text-xl font-bold">{stats.total}</p>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
					<div class="rounded-md bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-400">
						<AlertCircleIcon class="size-5" />
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground uppercase">Urgent</p>
						<p class="text-xl font-bold">{stats.urgent}</p>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
					<div
						class="rounded-md bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
					>
						<ClockIcon class="size-5" />
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground uppercase">Delayed</p>
						<p class="text-xl font-bold">{stats.delayed}</p>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-lg border bg-card p-3 opacity-60 shadow-sm">
					<div class="rounded-md bg-muted p-2">
						<CheckIcon class="size-5 text-muted-foreground" />
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground uppercase">Last Update</p>
						<p class="text-sm font-medium">
							{new Date(currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<Separator />

	<!-- Items List Grid -->
	{#if loading}
		<div class="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each Array(8) as _}
				<Card.Root class="h-[220px]">
					<Card.Content class="flex h-full flex-col justify-between p-6">
						<div class="space-y-3">
							<div class="flex justify-between">
								<Skeleton class="h-5 w-20" />
								<Skeleton class="h-5 w-16 rounded-full" />
							</div>
							<Skeleton class="h-8 w-3/4" />
							<Skeleton class="h-4 w-1/2" />
						</div>
						<div class="space-y-2">
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-9 w-full" />
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else if sortedItems.length === 0}
		<div
			class="flex animate-in flex-col items-center justify-center py-20 text-center duration-500 fade-in zoom-in"
		>
			<div class="mb-6 rounded-full bg-muted/50 p-6">
				<PackageIcon class="size-16 text-muted-foreground/50" />
			</div>
			<h3 class="mb-2 text-2xl font-semibold tracking-tight">All Caught Up!</h3>
			<p class="mx-auto max-w-sm text-muted-foreground">
				Tidak ada permintaan pending saat ini. Istirahat sejenak atau cek kembali nanti.
			</p>
			<Button variant="outline" class="mt-6" onclick={loadData}>Check Again</Button>
		</div>
	{:else}
		<div class="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each sortedItems as item (item.id)}
				{@const status = getStatusText(item)}
				<div
					animate:flip={{ duration: 400, easing: quintOut }}
					transition:scale={{ duration: 200, start: 0.95 }}
					class="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
				>
					<!-- Colored Status Strip (Left Border) -->
					<div class={`absolute top-0 left-0 h-full w-1.5 ${getItemStatusColor(item)}`}></div>

					<div class="flex h-full flex-col gap-4 p-5 pl-6">
						<!-- Header: Part No & Status Label -->
						<div class="flex items-start justify-between">
							<div class="space-y-1">
								<h3 class="mt-1 font-mono text-2xl font-bold tracking-tight">
									{item.part.part_number}
								</h3>
								<p class="line-clamp-1 text-sm text-muted-foreground" title={item.part.part_name}>
									{item.part.part_name}
								</p>
							</div>
							<div class="flex flex-col items-end">
								<span
									class={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.class}`}
								>
									{status.text}
								</span>
							</div>
						</div>

						<Separator class="bg-border/50" />

						<!-- Details: Location, User, Time, Qty -->
						<div class="space-y-2.5 text-sm">
							<div class="flex items-center gap-2.5 text-muted-foreground">
								<div class="rounded-md bg-muted p-1.5">
									<MapPinIcon class="size-3.5" />
								</div>
								<span class="truncate font-medium text-foreground"
									>{item.request.destination || 'No Destination'}</span
								>
								<span class="ml-auto text-xs text-muted-foreground/70"
									>{item.part.address || 'N/A'}</span
								>
							</div>

							<div class="flex items-center gap-2.5 text-muted-foreground">
								<div class="rounded-md bg-muted p-1.5">
									<UserIcon class="size-3.5" />
								</div>
								<span class="truncate">{item.request.requested_by_name || 'Unknown User'}</span>
							</div>

							<div class="flex items-center gap-2.5 text-muted-foreground">
								<div
									class={`rounded-md p-1.5 ${getDelayMinutes(item.id) > 5 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-muted'}`}
								>
									<ClockIcon class="size-3.5" />
								</div>
								<span class="tabular-nums">{formatDateTime(item.request.requested_at)}</span>
								{#if getDelayMinutes(item.id) > 0}
									<span class="ml-auto text-xs font-medium text-orange-500"
										>+{getDelayMinutes(item.id)}m</span
									>
								{/if}
							</div>
						</div>

						<!-- Action Button -->
						<div class="mt-auto pt-2">
							{#if canSupply}
								<Button
									variant={item.is_urgent ? 'destructive' : 'default'}
									class="w-full shadow-sm"
									onclick={() => openSupplyDialog(item)}
								>
									<CheckIcon class="mr-2 size-4" />
									Supply Items
								</Button>
							{/if}
							{#if canChecklocation}
								<Button
									variant="outline"
									class="mt-2 w-full shadow-sm"
									onclick={() => runCheckLocation(item)}
								>
									<CheckIcon class="mr-2 size-4" />
									Check Location
								</Button>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Supply Dialog with Verification -->
<Dialog.Root bind:open={supplyDialogOpen} onOpenChange={(open) => !open && closeSupplyDialog()}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header class="border-b pb-4">
			<Dialog.Title class="text-xl">Fulfill Request</Dialog.Title>
			<Dialog.Description>Verifikasi part number sebelum melakukan supply.</Dialog.Description>
		</Dialog.Header>

		{#if selectedItem}
			<div class="space-y-6 py-4">
				<!-- Summary Card inside Dialog -->
				<div class="space-y-3 rounded-lg border bg-muted/40 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs font-medium text-muted-foreground uppercase">Part Number</p>
							<p class="font-mono text-lg font-bold">{selectedItem.part.part_number}</p>
						</div>
						<div class="text-right">
							<p class="text-xs font-medium text-muted-foreground uppercase">Required</p>
							<p class="text-lg font-bold">
								{selectedItem.qty}
								<span class="text-sm font-normal text-muted-foreground">kbn</span>
							</p>
						</div>
					</div>
					<div
						class="flex items-center gap-2 rounded border bg-background/50 p-2 text-sm text-muted-foreground"
					>
						<BuildingWarehouseIcon class="size-4" />
						<span
							>Stock Gudang: <span class="font-medium text-foreground"
								>{selectedItem.part.stock} pcs</span
							></span
						>
					</div>
				</div>

				{#if verificationStep === 'verify'}
					<!-- Verification Step -->
					<div class="space-y-4" in:slide={{ axis: 'x', duration: 300 }}>
						<Tabs.Root value="scan" class="w-full">
							<Tabs.List class="mb-4 grid w-full grid-cols-2">
								<Tabs.Trigger value="scan" class="gap-2"
									><ScanIcon class="size-4" /> Scan QR</Tabs.Trigger
								>
								<Tabs.Trigger value="manual" class="gap-2"
									><KeyboardIcon class="size-4" /> Manual</Tabs.Trigger
								>
							</Tabs.List>

							<Tabs.Content value="scan" class="mt-0">
								<div
									class="relative overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/20 bg-black/5"
								>
									<QrScanner onScan={handleQrScan} pauseDuration={2000} />
									<div
										class="pointer-events-none absolute inset-0 flex items-center justify-center border-[30px] border-black/30"
									>
										<div class="relative size-48 rounded-lg border-2 border-white/50">
											<div
												class="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-green-500"
											></div>
											<div
												class="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-green-500"
											></div>
											<div
												class="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-green-500"
											></div>
											<div
												class="absolute right-0 bottom-0 h-4 w-4 border-r-2 border-b-2 border-green-500"
											></div>
										</div>
									</div>
								</div>
								<p class="mt-2 text-center text-xs text-muted-foreground">
									Arahkan kamera ke QR Code pada bin/part.
								</p>
							</Tabs.Content>

							<Tabs.Content value="manual" class="mt-0 space-y-4">
								<div class="space-y-2">
									<Label for="part-number">Input Part Number</Label>
									<div class="relative">
										<HashIcon class="absolute top-3 left-3 size-4 text-muted-foreground" />
										<Input
											id="part-number"
											bind:value={partNumberInput}
											placeholder="Contoh: BOLT-M8-20"
											class="pl-9 font-mono uppercase"
											onkeydown={(e) => e.key === 'Enter' && verifyPartNumber()}
										/>
									</div>
								</div>
								<Button
									onclick={verifyPartNumber}
									class="w-full"
									disabled={!partNumberInput.trim()}
								>
									Verifikasi
								</Button>
							</Tabs.Content>
						</Tabs.Root>

						{#if verificationError}
							<div
								class="shake flex animate-in items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm font-medium text-destructive"
							>
								<AlertCircleIcon class="size-4 shrink-0" />
								<span>{verificationError}</span>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Quantity Step -->
					<div class="space-y-6" in:slide={{ axis: 'x', duration: 300, delay: 100 }}>
						<div
							class="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400"
						>
							<div class="rounded-full bg-green-500 p-1 text-white">
								<CheckIcon class="size-3 shrink-0" />
							</div>
							<div class="flex flex-col">
								<span class="font-bold">Terverifikasi</span>
								<span class="font-mono text-xs opacity-90">{selectedItem.part.part_number}</span>
							</div>
						</div>

						<div class="space-y-3">
							<Label class="block text-center text-muted-foreground">Konfirmasi Jumlah Supply</Label
							>
							<div class="flex items-center justify-center gap-4">
								<Button
									variant="outline"
									size="icon"
									class="size-12 rounded-full border-2"
									onclick={() => (supplyQty = Math.max(1, supplyQty - 1))}
									disabled={supplyLoading || supplyQty <= 1}
								>
									<MinusIcon class="size-6" />
								</Button>
								<div class="relative w-24">
									<input
										type="number"
										bind:value={supplyQty}
										min={1}
										max={selectedItem ? selectedItem.part.stock : 1}
										class="h-12 border-2 p-0 text-center text-2xl font-bold focus-visible:border-primary focus-visible:ring-0"
										oninput={() => {
											if (!selectedItem) return;
											if (supplyQty > selectedItem.part.stock) {
												supplyQty = selectedItem.part.stock;
											} else if (supplyQty < 1) {
												supplyQty = 1;
											}
										}}
									/>
								</div>
								<Button
									variant="outline"
									size="icon"
									class="size-12 rounded-full border-2"
									onclick={() => {
										if (!selectedItem) return;
										if (supplyQty < selectedItem.part.stock) {
											supplyQty++;
										}
									}}
									disabled={supplyLoading || !selectedItem || supplyQty >= selectedItem.part.stock}
								>
									<PlusIcon class="size-6" />
								</Button>
							</div>
							{#if supplyQty > selectedItem.part.stock}
								<div
									class="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
								>
									<AlertCircleIcon class="size-4 shrink-0" />
									<span
										>Jumlah supply tidak boleh melebihi stok gudang ({selectedItem.part.stock} pcs).</span
									>
								</div>
							{/if}
						</div>

						<div class="grid grid-cols-2 gap-3 pt-2">
							<Button
								variant="ghost"
								onclick={() => {
									verificationStep = 'verify';
									partNumberInput = '';
									isVerified = false;
								}}
								disabled={supplyLoading}
							>
								Back
							</Button>
							<Button
								onclick={confirmSupply}
								disabled={supplyLoading || supplyQty <= 0}
								class="bg-green-600 text-white hover:bg-green-700"
							>
								{#if supplyLoading}
									<LoaderCircleIcon class="mr-2 size-4 animate-spin" />
									Processing...
								{:else}
									<CheckIcon class="mr-2 size-4" />
									Confirm
								{/if}
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
