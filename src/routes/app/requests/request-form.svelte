<script lang="ts">
	import { createRequest, updateRequest } from '$lib/api/requests.js';
	import type {
		RequestCreate,
		RequestResponse,
		RequestUpdate,
		PartResponse
	} from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import { formatDateLocal, nowJakarta, toISOStringJakarta } from '$lib/utils.js';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Field, FieldLabel, FieldGroup } from '$lib/components/ui/field/index.js';
	import PartSelect from '$lib/components/part-select.svelte';
	import QrScanner from '$lib/components/qr-scanner.svelte';

	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import AlertCircleIcon from '@tabler/icons-svelte/icons/alert-circle';

	interface Props {
		request: RequestResponse | null;
		parts: PartResponse[];
		requestNumber: string;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { request, parts, requestNumber, onSuccess, onCancel }: Props = $props();

	interface LineItem {
		part_id: string;
		qty: number;
		is_urgent: boolean;
	}

	const destinations = ['Lift KS', 'Lift SU2ID'];

	let requestedAt = $state('');
	let destination = $state('');
	let notes = $state('');
	let items = $state<LineItem[]>([]);
	let saving = $state(false);
	let newPartId = $state('');
	let newQty = $state(1);
	let newUrgent = $state(false);

	const isEditing = $derived(!!request);
	const availableParts = $derived(parts.filter((p) => p.is_active));
	const urgentCount = $derived(items.filter((i) => i.is_urgent).length);

	const duplicatePartIds = $derived(() => {
		const partIds = items.map((i) => i.part_id).filter(Boolean);
		const seen: string[] = [];
		const duplicates: string[] = [];
		for (const id of partIds) {
			if (seen.includes(id)) {
				if (!duplicates.includes(id)) duplicates.push(id);
			} else {
				seen.push(id);
			}
		}
		return duplicates;
	});

	const hasDuplicates = $derived(duplicatePartIds.length > 0);

	$effect(() => {
		if (request) {
			requestedAt = request.requested_at.split('T')[0];
			destination = request.destination ?? '';
			notes = request.notes ?? '';
			items = request.items.map((item) => ({
				part_id: item.part_id,
				qty: item.qty,
				is_urgent: item.is_urgent
			}));
		} else {
			requestedAt = formatDateLocal(nowJakarta());
			destination = '';
			notes = '';
			items = [];
		}
	});

	function addComposedItem() {
		if (!newPartId) return;
		const qty = Math.max(1, newQty || 1);
		if (items.some((i) => i.part_id === newPartId)) {
			toast.error('Duplicate parts', { description: 'This part is already in the request.' });
			return;
		}
		items = [...items, { part_id: newPartId, qty, is_urgent: newUrgent }];
		newPartId = '';
		newQty = 1;
		newUrgent = false;
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
	}

	function updateItemQty(index: number, qty: number) {
		items = items.map((item, i) => (i === index ? { ...item, qty: Math.max(0, qty) } : item));
	}

	function updateItemUrgent(index: number, isUrgent: boolean) {
		items = items.map((item, i) => (i === index ? { ...item, is_urgent: isUrgent } : item));
	}

	function getPartInfo(partId: string): PartResponse | undefined {
		return parts.find((p) => p.id === partId);
	}

	function handleQrScan(scannedValue: string) {
		const foundPart = availableParts.find(
			(p) => p.part_number.toLowerCase() === scannedValue.toLowerCase()
		);

		if (!foundPart) {
			toast.error('Part tidak ditemukan', {
				description: `Part dengan nomor "${scannedValue}" tidak ditemukan.`
			});
			return;
		}

		const existingIndex = items.findIndex((item) => item.part_id === foundPart.id);

		if (existingIndex >= 0) {
			items = items.map((item, i) => (i === existingIndex ? { ...item, qty: item.qty + 1 } : item));
			toast.success('Qty ditambahkan', {
				description: `${foundPart.part_number} qty +1 (total: ${items[existingIndex].qty + 1})`
			});
		} else {
			items = [...items, { part_id: foundPart.id, qty: 1, is_urgent: false }];
			toast.success('Part ditambahkan', {
				description: `${foundPart.part_number}`
			});
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		if (items.length === 0) {
			toast.error('No items', { description: 'Please add at least one item.' });
			return;
		}

		const invalidItems = items.filter((item) => !item.part_id || item.qty < 1);
		if (invalidItems.length > 0) {
			toast.error('Invalid items', {
				description: 'Please ensure all items have a part selected and quantity > 0.'
			});
			return;
		}

		if (hasDuplicates) {
			toast.error('Duplicate parts', {
				description: 'Please remove duplicate parts from the request.'
			});
			return;
		}

		if (!destination) {
			toast.error('Missing destination', { description: 'Please select a destination.' });
			return;
		}

		saving = true;
		try {
			if (isEditing && request) {
				const updateData: RequestUpdate = {
					destination: destination || undefined,
					notes: notes || undefined,
					items: items.map((item) => ({
						part_id: item.part_id,
						qty: item.qty,
						is_urgent: item.is_urgent
					}))
				};
				await updateRequest(request.id, updateData);
				toast.success('Request updated', {
					description: `${request.request_number} has been updated.`
				});
			} else {
				const now = nowJakarta();
				const [year, month, day] = requestedAt.split('-').map(Number);
				const requestedDateTime = new Date(
					year,
					month - 1,
					day,
					now.getHours(),
					now.getMinutes(),
					now.getSeconds(),
					now.getMilliseconds()
				);

				const createData: RequestCreate = {
					request_number: requestNumber,
					requested_by: auth.user?.id ?? '',
					requested_at: toISOStringJakarta(requestedDateTime),
					destination: destination || undefined,
					notes: notes || undefined,
					items: items.map((item) => ({
						part_id: item.part_id,
						qty: item.qty,
						is_urgent: item.is_urgent
					}))
				};
				await createRequest(createData);
				toast.success('Request created', {
					description: `${requestNumber} has been created.`
				});
			}
			onSuccess();
		} catch (e) {
			const error = e as ApiError;
			toast.error(isEditing ? 'Failed to update request' : 'Failed to create request', {
				description: error.detail
			});
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<FieldGroup>
		<div class="grid gap-4 sm:grid-cols-3">
			<Field>
				<FieldLabel>Request Number</FieldLabel>
				<Input value={requestNumber} disabled class="font-mono" />
			</Field>

			<Field>
				<FieldLabel for="requestedAt">Request Date *</FieldLabel>
				<Input id="requestedAt" type="date" bind:value={requestedAt} required disabled={saving} />
			</Field>

			<Field>
				<FieldLabel for="destination">Destination *</FieldLabel>
				<Select.Root type="single" bind:value={destination}>
					<Select.Trigger id="destination" disabled={saving}>
						{destination || 'Select destination'}
					</Select.Trigger>
					<Select.Content>
						{#each destinations as dest (dest)}
							<Select.Item value={dest}>{dest}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</Field>
		</div>

		<div class="grid gap-4 sm:grid-cols-1">
			<Field>
				<FieldLabel for="notes">Notes</FieldLabel>
				<Input id="notes" bind:value={notes} placeholder="Optional notes..." disabled={saving} />
			</Field>
		</div>
	</FieldGroup>

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border bg-background/50 p-4 lg:h-full">
			<div class="mb-3 flex items-center justify-between">
				<FieldLabel>QR</FieldLabel>
				<Badge variant="secondary">Scanner</Badge>
			</div>
			<div class="flex flex-col rounded-xl border bg-muted/30 p-4 lg:h-[420px]">
				<QrScanner onScan={handleQrScan} pauseDuration={2000} disabled={saving} />
				<p class="mt-2 text-center text-xs text-muted-foreground">
					Scan QR code part untuk menambahkan item. Scan ulang part yang sama akan menambah qty.
				</p>
			</div>
		</div>

		<div class="rounded-xl border bg-background/50 p-4 lg:h-full">
			<div class="flex items-center justify-between">
				<FieldLabel>Add Item</FieldLabel>
				<Badge variant="secondary">Composer</Badge>
			</div>
			<div class="mt-3 flex flex-col gap-3 lg:h-[420px]">
				<PartSelect
					parts={availableParts}
					value={newPartId}
					onValueChange={(v) => (newPartId = v ?? '')}
					disabled={saving}
				/>
				<div class="space-y-1">
					<div class="text-xs font-medium text-muted-foreground">Quantity</div>
					<Input
						type="number"
						value={newQty}
						onfocus={(e) => (e.target as HTMLInputElement).select()}
						onclick={(e) => (e.target as HTMLInputElement).select()}
						oninput={(e) => {
							const raw = (e.target as HTMLInputElement).value;
							const parsed = parseInt(raw, 10);
							newQty = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
						}}
						min={1}
						disabled={saving}
					/>
				</div>
				<div class="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
					<div class="text-sm">
						<div class="font-medium">Urgent</div>
						<div class="text-xs text-muted-foreground">Mark this item urgent when adding</div>
					</div>
					<Checkbox
						checked={newUrgent}
						onCheckedChange={(v) => (newUrgent = !!v)}
						disabled={saving}
					/>
				</div>
				<div class="flex-1"></div>
				<Button
					type="button"
					onclick={addComposedItem}
					disabled={saving || !newPartId}
					class="w-full"
				>
					<PlusIcon class="size-4" />
					Add Item
				</Button>
			</div>
		</div>
	</div>

	<div class="rounded-xl border bg-background/50 p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<FieldLabel>Details</FieldLabel>
				{#if urgentCount > 0}
					<Badge variant="destructive" class="gap-1">
						<AlertCircleIcon class="size-3" />
						{urgentCount}
					</Badge>
				{/if}
				{#if hasDuplicates}
					<Badge variant="destructive">Duplicates</Badge>
				{/if}
			</div>
			<Badge variant="secondary">Total: {items.reduce((sum, i) => sum + i.qty, 0)}</Badge>
		</div>
		<div class="mt-4 space-y-2">
			{#if items.length === 0}
				<div class="rounded-lg border-2 border-dashed p-6 text-center">
					<p class="text-sm text-muted-foreground">No items added yet.</p>
				</div>
			{:else}
				{#each items as item, index (index)}
					<div class="rounded-xl border bg-card p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<div class="rounded-lg border bg-background/50 px-3 py-2">
									<div class="truncate text-sm font-medium">
										{getPartInfo(item.part_id)?.part_number ?? 'Unknown part'}
									</div>
									{#if getPartInfo(item.part_id)?.part_name}
										<div class="truncate text-xs text-muted-foreground">
											{getPartInfo(item.part_id)?.part_name}
										</div>
									{/if}
								</div>
							</div>
							<div class="w-28">
								<Input
									type="number"
									value={item.qty}
									onfocus={(e) => (e.target as HTMLInputElement).select()}
									onclick={(e) => (e.target as HTMLInputElement).select()}
									oninput={(e) => {
										const raw = (e.target as HTMLInputElement).value;
										const parsed = parseInt(raw, 10);
										updateItemQty(index, Number.isFinite(parsed) ? parsed : 0);
									}}
									min={1}
									disabled={saving}
								/>
							</div>
							<div class="flex flex-col items-center gap-2">
								<Checkbox
									checked={item.is_urgent}
									onCheckedChange={(v) => updateItemUrgent(index, !!v)}
									disabled={saving}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onclick={() => removeItem(index)}
									disabled={saving}
								>
									<TrashIcon class="size-4 text-destructive" />
								</Button>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<div
		class="sticky bottom-0 -mx-4 mt-4 border-t bg-background/80 p-4 backdrop-blur md:mx-0 md:rounded-xl md:border md:bg-card"
	>
		<div class="flex items-center justify-end gap-2">
			<Button type="button" variant="outline" onclick={onCancel} disabled={saving}>Cancel</Button>
			<Button type="submit" disabled={saving || items.length === 0 || hasDuplicates}>
				{#if saving}
					<LoaderCircleIcon class="size-4 animate-spin" />
					{isEditing ? 'Updating...' : 'Creating...'}
				{:else}
					{isEditing ? 'Update Request' : 'Create Request'}
				{/if}
			</Button>
		</div>
	</div>
</form>
