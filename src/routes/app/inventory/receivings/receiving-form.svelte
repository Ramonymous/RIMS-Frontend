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

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Field, FieldLabel, FieldGroup } from '$lib/components/ui/field/index.js';
	import PartSelect from '$lib/components/part-select.svelte';
	import QrScanner from '$lib/components/qr-scanner.svelte';

	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';

	interface Props {
		receiving: ReceivingResponse | null;
		parts: PartResponse[];
		docNumber: string;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { receiving, parts, docNumber, onSuccess, onCancel }: Props = $props();

	interface LineItem {
		part_id: string;
		qty: number;
	}

	let receivedAt = $state('');
	let notes = $state('');
	let items = $state<LineItem[]>([]);
	let saving = $state(false);
	let newPartId = $state('');
	let newQty = $state(1);

	const isEditing = $derived(!!receiving);
	const selectedPartIds = $derived(items.map((i) => i.part_id));
	const availableParts = $derived(parts.filter((p) => p.is_active));

	$effect(() => {
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
	});

	function addComposedItem() {
		if (!newPartId) return;
		const qty = Math.max(1, newQty || 1);
		const existingIndex = items.findIndex((i) => i.part_id === newPartId);
		if (existingIndex >= 0) {
			items = items.map((it, idx) => (idx === existingIndex ? { ...it, qty: it.qty + qty } : it));
		} else {
			items = [...items, { part_id: newPartId, qty }];
		}
		newPartId = '';
		newQty = 1;
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
	}

	function updateItemQty(index: number, qty: number) {
		items = items.map((item, i) => (i === index ? { ...item, qty: Math.max(0, qty) } : item));
	}

	function getPartInfo(partId: string): PartResponse | undefined {
		return parts.find((p) => p.id === partId);
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
			items = [...items, { part_id: foundPart.id, qty: 1 }];
			toast.success('Part ditambahkan', {
				description: `${foundPart.part_number} - ${foundPart.part_name ?? ''}`
			});
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<div class="space-y-4">
		<div class="rounded-xl border bg-background/50 p-4">
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
		</div>

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
				<div class="mb-3 flex items-center justify-between">
					<FieldLabel>Add Item</FieldLabel>
					<Badge variant="secondary">Composer</Badge>
				</div>
				<div class="flex flex-col gap-3 lg:h-[420px]">
					<PartSelect
						parts={availableParts}
						value={newPartId}
						onValueChange={(v) => (newPartId = v ?? '')}
						disabledPartIds={selectedPartIds}
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
				<FieldLabel>Details</FieldLabel>
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
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<div
		class="sticky bottom-0 -mx-4 mt-4 border-t bg-background/80 p-4 backdrop-blur md:mx-0 md:rounded-xl md:border md:bg-card"
	>
		<div class="flex items-center justify-end gap-2">
			<Button type="button" variant="outline" onclick={onCancel} disabled={saving}>Cancel</Button>
			<Button type="submit" disabled={saving || items.length === 0}>
				{#if saving}
					<LoaderCircleIcon class="size-4 animate-spin" />
					{isEditing ? 'Updating...' : 'Creating...'}
				{:else}
					{isEditing ? 'Update Receiving' : 'Create Receiving'}
				{/if}
			</Button>
		</div>
	</div>
</form>
