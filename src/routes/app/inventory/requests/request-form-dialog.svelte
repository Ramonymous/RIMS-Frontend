<script lang="ts">
	import { createRequest, updateRequest } from '$lib/api/requests.js';
	import type {
		RequestResponse,
		RequestCreate,
		RequestUpdate,
		PartResponse
	} from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import { formatDateLocal, nowJakarta, toISOStringJakarta } from '$lib/utils.js';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Field, FieldLabel, FieldGroup } from '$lib/components/ui/field/index.js';
	import PartSelect from '$lib/components/part-select.svelte';
	import QrScanner from '$lib/components/qr-scanner.svelte';

	// Icons
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import AlertCircleIcon from '@tabler/icons-svelte/icons/alert-circle';
	import QrcodeIcon from '@tabler/icons-svelte/icons/qrcode';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import ChevronUpIcon from '@tabler/icons-svelte/icons/chevron-up';

	interface Props {
		open: boolean;
		request: RequestResponse | null;
		parts: PartResponse[];
		requestNumber: string;
		onSuccess: () => void;
	}

	let { open = $bindable(), request, parts, requestNumber, onSuccess }: Props = $props();

	interface LineItem {
		part_id: string;
		qty: number;
		is_urgent: boolean;
	}

	// Destination options
	const destinations = ['Lift KS', 'Lift SU2ID'];

	// Form state
	let requestedAt = $state('');
	let destination = $state('');
	let notes = $state('');
	let items = $state<LineItem[]>([]);
	let saving = $state(false);
	let qrScannerOpen = $state(false);

	const isEditing = $derived(!!request);
	const dialogTitle = $derived(isEditing ? 'Edit Request' : 'Create Request');
	const dialogDescription = $derived(
		isEditing ? 'Update the part request.' : 'Create a new part request.'
	);

	// Get available parts (active only)
	const availableParts = $derived(parts.filter((p) => p.is_active));

	// Count urgent items
	const urgentCount = $derived(items.filter((i) => i.is_urgent).length);

	// Check for duplicate parts - using arrays instead of Sets
	const duplicatePartIds = $derived(() => {
		const partIds = items.map((i) => i.part_id).filter(Boolean);
		const seen: string[] = [];
		const duplicates: string[] = [];
		for (const id of partIds) {
			if (seen.includes(id)) {
				if (!duplicates.includes(id)) {
					duplicates.push(id);
				}
			} else {
				seen.push(id);
			}
		}
		return duplicates;
	});

	const hasDuplicates = $derived(duplicatePartIds.length > 0);

	// Reset form when dialog opens/request changes
	$effect(() => {
		if (open) {
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
		}
	});

	// formatDateLocal is imported from $lib/utils.js

	function addItem() {
		items = [...items, { part_id: '', qty: 1, is_urgent: false }];
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
	}

	function updateItemPart(index: number, partId: string | undefined) {
		if (!partId) return;
		items = items.map((item, i) => (i === index ? { ...item, part_id: partId } : item));
	}

	function updateItemQty(index: number, qty: number) {
		items = items.map((item, i) => (i === index ? { ...item, qty: Math.max(1, qty) } : item));
	}

	function updateItemUrgent(index: number, isUrgent: boolean) {
		items = items.map((item, i) => (i === index ? { ...item, is_urgent: isUrgent } : item));
	}

	function getPartInfo(partId: string): PartResponse | undefined {
		return parts.find((p) => p.id === partId);
	}

	function isDuplicate(partId: string): boolean {
		return duplicatePartIds().includes(partId);
	}

	function handleQrScan(scannedValue: string) {
		// Find part by part_number matching the scanned QR code
		const foundPart = availableParts.find(
			(p) => p.part_number.toLowerCase() === scannedValue.toLowerCase()
		);

		if (!foundPart) {
			toast.error('Part tidak ditemukan', {
				description: `Part dengan nomor "${scannedValue}" tidak ditemukan.`
			});
			return;
		}

		// Check if part already exists in items
		const existingIndex = items.findIndex((item) => item.part_id === foundPart.id);

		if (existingIndex >= 0) {
			// Increment quantity if already exists
			items = items.map((item, i) => (i === existingIndex ? { ...item, qty: item.qty + 1 } : item));
			toast.success('Qty ditambahkan', {
				description: `${foundPart.part_number} qty +1 (total: ${items[existingIndex].qty + 1})`
			});
		} else {
			// Add new item
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
				// Combine selected date with current time in Jakarta timezone
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

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>{dialogTitle}</Dialog.Title>
			<Dialog.Description>{dialogDescription}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="flex-1 space-y-6 overflow-y-auto py-4">
			<FieldGroup>
				<div class="grid gap-4 sm:grid-cols-3">
					<Field>
						<FieldLabel>Request Number</FieldLabel>
						<Input value={requestNumber} disabled class="font-mono" />
					</Field>

					<Field>
						<FieldLabel for="requestedAt">Request Date *</FieldLabel>
						<Input
							id="requestedAt"
							type="date"
							bind:value={requestedAt}
							required
							disabled={saving || isEditing}
						/>
					</Field>

					<Field>
						<FieldLabel for="destination">Destination *</FieldLabel>
						<Select.Root type="single" bind:value={destination}>
							<Select.Trigger class="w-full" disabled={saving}>
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

				<Field>
					<FieldLabel for="notes">Notes</FieldLabel>
					<Input
						id="notes"
						bind:value={notes}
						placeholder="Additional notes..."
						disabled={saving}
					/>
				</Field>
			</FieldGroup>

			<!-- Duplicate Warning -->
			{#if hasDuplicates}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3"
				>
					<AlertCircleIcon class="size-4 text-destructive" />
					<span class="text-sm text-destructive">
						Duplicate parts detected! Each part can only be added once.
					</span>
				</div>
			{/if}

			<!-- QR Scanner Section -->
			<div class="space-y-3">
				<Button
					type="button"
					variant="outline"
					class="w-full justify-between"
					disabled={saving}
					onclick={() => (qrScannerOpen = !qrScannerOpen)}
				>
					<span class="flex items-center gap-2">
						<QrcodeIcon class="size-4" />
						Scan QR Code untuk Tambah Item
					</span>
					{#if qrScannerOpen}
						<ChevronUpIcon class="size-4" />
					{:else}
						<ChevronDownIcon class="size-4" />
					{/if}
				</Button>

				{#if qrScannerOpen}
					<div class="rounded-xl border bg-muted/30 p-4">
						<QrScanner onScan={handleQrScan} pauseDuration={2000} disabled={saving} />
						<p class="mt-2 text-center text-xs text-muted-foreground">
							Scan QR code part untuk menambahkan item. Scan ulang part yang sama akan menambah qty.
						</p>
					</div>
				{/if}
			</div>

			<!-- Line Items -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<FieldLabel>Items</FieldLabel>
						{#if urgentCount > 0}
							<Badge variant="destructive" class="gap-1">
								<AlertCircleIcon class="size-3" />
								{urgentCount} urgent
							</Badge>
						{/if}
					</div>
					<Button type="button" variant="outline" size="sm" onclick={addItem} disabled={saving}>
						<PlusIcon class="size-4" />
						Add Item
					</Button>
				</div>

				{#if items.length === 0}
					<div class="rounded-lg border-2 border-dashed p-8 text-center">
						<p class="text-muted-foreground">No items added yet. Click "Add Item" to start.</p>
					</div>
				{:else}
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-[40%]">Part</Table.Head>
									<Table.Head class="w-20 text-center">Qty</Table.Head>
									<Table.Head class="w-24 text-center">Stock</Table.Head>
									<Table.Head class="w-24 text-center">Urgent</Table.Head>
									<Table.Head class="w-16"></Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each items as item, index (index)}
									{@const partInfo = getPartInfo(item.part_id)}
									{@const isLowStock = partInfo && partInfo.stock < item.qty}
									{@const isDup = item.part_id && isDuplicate(item.part_id)}
									<Table.Row class={isDup ? 'bg-destructive/5' : ''}>
										<Table.Cell>
											<PartSelect
												parts={availableParts}
												value={item.part_id}
												onValueChange={(partId: string | undefined) =>
													updateItemPart(index, partId)}
												placeholder="Select a part"
												class="w-full"
												disabled={saving}
											/>
											{#if isDup}
												<p class="mt-1 text-xs text-destructive">Duplicate part</p>
											{/if}
										</Table.Cell>
										<Table.Cell>
											<Input
												type="number"
												value={item.qty}
												min={1}
												class="w-20 text-center"
												onchange={(e) =>
													updateItemQty(index, parseInt((e.target as HTMLInputElement).value) || 1)}
												disabled={saving}
											/>
										</Table.Cell>
										<Table.Cell class="text-center">
											{#if partInfo}
												<span
													class={isLowStock
														? 'font-medium text-destructive'
														: 'text-muted-foreground'}
												>
													{partInfo.stock}
												</span>
											{:else}
												<span class="text-muted-foreground">-</span>
											{/if}
										</Table.Cell>
										<Table.Cell class="text-center">
											<Checkbox
												checked={item.is_urgent}
												onCheckedChange={(checked) => updateItemUrgent(index, !!checked)}
												disabled={saving}
											/>
										</Table.Cell>
										<Table.Cell class="text-center">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onclick={() => removeItem(index)}
												disabled={saving}
												class="text-muted-foreground hover:text-destructive"
											>
												<TrashIcon class="size-4" />
											</Button>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				{/if}
			</div>
		</form>

		<Dialog.Footer class="border-t pt-4">
			<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>
				Cancel
			</Button>
			<Button
				type="button"
				onclick={() => handleSubmit(new SubmitEvent('submit'))}
				disabled={saving || items.length === 0 || hasDuplicates}
			>
				{#if saving}
					<LoaderCircleIcon class="size-4 animate-spin" />
					Saving...
				{:else}
					{isEditing ? 'Update Request' : 'Create Request'}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
