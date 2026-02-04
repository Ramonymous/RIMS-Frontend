<script lang="ts">
	import { createReceiving, updateReceiving } from '$lib/api/receivings.js';
	import type {
		ReceivingResponse,
		ReceivingCreate,
		ReceivingUpdate,
		PartResponse
	} from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Field, FieldLabel, FieldGroup } from '$lib/components/ui/field/index.js';
	import PartSelect from '$lib/components/part-select.svelte';
	import QrScanner from '$lib/components/qr-scanner.svelte';

	// Icons
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import QrcodeIcon from '@tabler/icons-svelte/icons/qrcode';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import ChevronUpIcon from '@tabler/icons-svelte/icons/chevron-up';

	interface Props {
		open: boolean;
		receiving: ReceivingResponse | null;
		parts: PartResponse[];
		docNumber: string;
		onSuccess: () => void;
	}

	let { open = $bindable(), receiving, parts, docNumber, onSuccess }: Props = $props();

	interface LineItem {
		part_id: string;
		qty: number;
	}

	// Form state
	let receivedAt = $state('');
	let notes = $state('');
	let items = $state<LineItem[]>([]);
	let saving = $state(false);
	let qrScannerOpen = $state(false);

	const isEditing = $derived(!!receiving);
	const dialogTitle = $derived(isEditing ? 'Edit Receiving' : 'Create Receiving');
	const dialogDescription = $derived(
		isEditing ? 'Update the receiving document.' : 'Create a new receiving document.'
	);

	// Get available parts (exclude already selected)
	const selectedPartIds = $derived(items.map((i) => i.part_id));
	const availableParts = $derived(parts.filter((p) => p.is_active));

	// Reset form when dialog opens/receiving changes
	$effect(() => {
		if (open) {
			if (receiving) {
				receivedAt = receiving.received_at.split('T')[0];
				notes = receiving.notes ?? '';
				items = receiving.items.map((item) => ({
					part_id: item.part_id,
					qty: item.qty
				}));
			} else {
				const now = new Date();
				receivedAt = now.toISOString().split('T')[0];
				notes = '';
				items = [];
			}
		}
	});

	function addItem() {
		items = [...items, { part_id: '', qty: 1 }];
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

	function getPartNumber(partId: string): string {
		const part = parts.find((p) => p.id === partId);
		return part ? part.part_number : 'Select a part';
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

		saving = true;

		try {
			if (isEditing && receiving) {
				const updateData: ReceivingUpdate = {
					notes: notes || undefined,
					items: items.map((item) => ({
						part_id: item.part_id,
						qty: item.qty
					}))
				};
				await updateReceiving(receiving.id, updateData);
				toast.success('Receiving updated', {
					description: `${receiving.doc_number} has been updated.`
				});
			} else {
				const createData: ReceivingCreate = {
					doc_number: docNumber,
					received_by: auth.user?.id ?? '',
					received_at: new Date(receivedAt).toISOString(),
					notes: notes || undefined,
					items: items.map((item) => ({
						part_id: item.part_id,
						qty: item.qty
					}))
				};
				await createReceiving(createData);
				toast.success('Receiving created', {
					description: `${docNumber} has been created.`
				});
			}
			onSuccess();
		} catch (e) {
			const error = e as ApiError;
			toast.error(isEditing ? 'Failed to update receiving' : 'Failed to create receiving', {
				description: error.detail
			});
		} finally {
			saving = false;
		}
	}
	// QR scan handler
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
			items = [...items, { part_id: foundPart.id, qty: 1 }];
			toast.success('Part ditambahkan', {
				description: `${foundPart.part_number} - ${foundPart.part_name ?? ''}`
			});
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
						<FieldLabel>Document Number</FieldLabel>
						<Input value={docNumber} disabled class="font-mono" />
					</Field>

					<Field>
						<FieldLabel for="receivedAt">Received Date *</FieldLabel>
						<Input
							id="receivedAt"
							type="date"
							bind:value={receivedAt}
							required
							disabled={saving || isEditing}
						/>
					</Field>

					<Field>
						<FieldLabel for="notes">Notes</FieldLabel>
						<Input
							id="notes"
							bind:value={notes}
							placeholder="Optional notes..."
							disabled={saving}
						/>
					</Field>
				</div>
			</FieldGroup>

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
					<FieldLabel>Items</FieldLabel>
					<Button type="button" variant="outline" size="sm" onclick={addItem} disabled={saving}>
						<PlusIcon class="size-4" />
						Add Item
					</Button>
				</div>

				{#if items.length === 0}
					<div class="rounded-lg border-2 border-dashed p-8 text-center">
						<p class="text-muted-foreground">No items added yet. Click \"Add Item\" to start.</p>
					</div>
				{:else}
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-12">#</Table.Head>
									<Table.Head>Part</Table.Head>
									<Table.Head class="w-32">Quantity</Table.Head>
									<Table.Head class="w-16"></Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each items as item, index (index)}
									<Table.Row>
										<Table.Cell class="text-muted-foreground">{index + 1}</Table.Cell>
										<Table.Cell>
											<PartSelect
												parts={availableParts}
												value={item.part_id}
												onValueChange={(v) => updateItemPart(index, v)}
												disabledPartIds={selectedPartIds.filter((id) => id !== item.part_id)}
												disabled={saving}
											/>
										</Table.Cell>
										<Table.Cell>
											<Input
												type="number"
												value={item.qty}
												oninput={(e) =>
													updateItemQty(index, parseInt((e.target as HTMLInputElement).value) || 1)}
												min={1}
												disabled={saving}
											/>
										</Table.Cell>
										<Table.Cell>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onclick={() => removeItem(index)}
												disabled={saving}
											>
												<TrashIcon class="size-4 text-destructive" />
											</Button>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>

					<div class="flex justify-end">
						<Badge variant="secondary">
							Total: {items.reduce((sum, i) => sum + i.qty, 0)} items
						</Badge>
					</div>
				{/if}
			</div>

			<!-- QR scan handler -->

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>
					Cancel
				</Button>
				<Button type="submit" disabled={saving || items.length === 0}>
					{#if saving}
						<LoaderCircleIcon class="size-4 animate-spin" />
						{isEditing ? 'Updating...' : 'Creating...'}
					{:else}
						{isEditing ? 'Update Receiving' : 'Create Receiving'}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
