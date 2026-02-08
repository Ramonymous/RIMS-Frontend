<script lang="ts">
	import type { ReceivingResponse, PartResponse } from '$lib/api/types.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import ReceivingForm from './receiving-form.svelte';

	interface Props {
		open: boolean;
		receiving: ReceivingResponse | null;
		parts: PartResponse[];
		docNumber: string;
		onSuccess: () => void;
	}

	let { open = $bindable(), receiving, parts, docNumber, onSuccess }: Props = $props();

	const isEditing = $derived(!!receiving);
	const dialogTitle = $derived(isEditing ? 'Edit Receiving' : 'Create Receiving');
	const dialogDescription = $derived(
		isEditing ? 'Update the receiving document.' : 'Create a new receiving document.'
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>{dialogTitle}</Dialog.Title>
			<Dialog.Description>{dialogDescription}</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 overflow-y-auto py-4">
			<ReceivingForm {receiving} {parts} {docNumber} onCancel={() => (open = false)} {onSuccess} />
		</div>
	</Dialog.Content>
</Dialog.Root>
