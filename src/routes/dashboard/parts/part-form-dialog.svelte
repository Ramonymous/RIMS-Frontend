<script lang="ts">
	import { createPart, updatePart } from '$lib/api/parts.js';
	import type { PartResponse, PartCreate, PartUpdate } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Field, FieldLabel } from '$lib/components/ui/field/index.js';

	// Icons
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	interface Props {
		open: boolean;
		part: PartResponse | null;
		onSuccess: () => void;
	}

	let { open = $bindable(), part, onSuccess }: Props = $props();

	// Form state
	let partNumber = $state('');
	let partName = $state('');
	let customerCode = $state('');
	let supplierCode = $state('');
	let model = $state('');
	let variant = $state('');
	let standardPacking = $state(1);
	let stock = $state(0);
	let address = $state('');
	let isActive = $state(true);
	let saving = $state(false);

	const isEditing = $derived(!!part);
	const dialogTitle = $derived(isEditing ? 'Edit Part' : 'Create Part');
	const dialogDescription = $derived(
		isEditing ? 'Update the part information.' : 'Add a new part to the inventory.'
	);

	// Reset form when dialog opens/part changes
	$effect(() => {
		if (open) {
			if (part) {
				partNumber = part.part_number;
				partName = part.part_name;
				customerCode = part.customer_code ?? '';
				supplierCode = part.supplier_code ?? '';
				model = part.model ?? '';
				variant = part.variant ?? '';
				standardPacking = part.standard_packing;
				stock = part.stock;
				address = part.address ?? '';
				isActive = part.is_active;
			} else {
				partNumber = '';
				partName = '';
				customerCode = '';
				supplierCode = '';
				model = '';
				variant = '';
				standardPacking = 1;
				stock = 0;
				address = '';
				isActive = true;
			}
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;

		try {
			if (isEditing && part) {
				const updateData: PartUpdate = {
					part_number: partNumber,
					part_name: partName,
					customer_code: customerCode || undefined,
					supplier_code: supplierCode || undefined,
					model: model || undefined,
					variant: variant || undefined,
					standard_packing: standardPacking,
					address: address || undefined,
					is_active: isActive
				};
				await updatePart(part.id, updateData);
				toast.success('Part updated', {
					description: `${partName} has been updated successfully.`
				});
			} else {
				const createData: PartCreate = {
					part_number: partNumber,
					part_name: partName,
					customer_code: customerCode || undefined,
					supplier_code: supplierCode || undefined,
					model: model || undefined,
					variant: variant || undefined,
					standard_packing: standardPacking,
					stock: stock,
					address: address || undefined,
					is_active: isActive
				};
				await createPart(createData);
				toast.success('Part created', {
					description: `${partName} has been added to the inventory.`
				});
			}
			onSuccess();
		} catch (e) {
			const error = e as ApiError;
			toast.error(isEditing ? 'Failed to update part' : 'Failed to create part', {
				description: error.detail
			});
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] max-w-2xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{dialogTitle}</Dialog.Title>
			<Dialog.Description>{dialogDescription}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel for="partNumber">Part Number *</FieldLabel>
					<Input
						id="partNumber"
						bind:value={partNumber}
						placeholder="e.g., PN-001"
						required
						disabled={saving}
					/>
				</Field>

				<Field>
					<FieldLabel for="partName">Part Name *</FieldLabel>
					<Input
						id="partName"
						bind:value={partName}
						placeholder="e.g., Widget A"
						required
						disabled={saving}
					/>
				</Field>

				<Field>
					<FieldLabel for="customerCode">Customer Code</FieldLabel>
					<Input
						id="customerCode"
						bind:value={customerCode}
						placeholder="Customer's part code"
						disabled={saving}
					/>
				</Field>

				<Field>
					<FieldLabel for="supplierCode">Supplier Code</FieldLabel>
					<Input
						id="supplierCode"
						bind:value={supplierCode}
						placeholder="Supplier's part code"
						disabled={saving}
					/>
				</Field>

				<Field>
					<FieldLabel for="model">Model</FieldLabel>
					<Input id="model" bind:value={model} placeholder="Model name" disabled={saving} />
				</Field>

				<Field>
					<FieldLabel for="variant">Variant</FieldLabel>
					<Input id="variant" bind:value={variant} placeholder="Variant code" disabled={saving} />
				</Field>

				<Field>
					<FieldLabel for="standardPacking">Standard Packing *</FieldLabel>
					<Input
						id="standardPacking"
						type="number"
						bind:value={standardPacking}
						min={1}
						required
						disabled={saving}
					/>
				</Field>

				{#if !isEditing}
					<Field>
						<FieldLabel for="stock">Initial Stock</FieldLabel>
						<Input id="stock" type="number" bind:value={stock} min={0} disabled={saving} />
					</Field>
				{/if}

				<Field class="sm:col-span-2">
					<FieldLabel for="address">Storage Address</FieldLabel>
					<Input
						id="address"
						bind:value={address}
						placeholder="e.g., Rack A, Shelf 3"
						disabled={saving}
					/>
				</Field>
			</div>

			<div class="flex items-center gap-2">
				<Checkbox
					id="isActive"
					checked={isActive}
					onCheckedChange={(checked) => (isActive = checked === true)}
					disabled={saving}
				/>
				<label for="isActive" class="cursor-pointer text-sm">
					Part is active and available for transactions
				</label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>
					Cancel
				</Button>
				<Button type="submit" disabled={saving}>
					{#if saving}
						<LoaderCircleIcon class="size-4 animate-spin" />
						{isEditing ? 'Updating...' : 'Creating...'}
					{:else}
						{isEditing ? 'Update Part' : 'Create Part'}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
