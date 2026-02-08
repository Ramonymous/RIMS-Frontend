<script lang="ts">
	import type { OutgoingResponse, PartResponse } from '$lib/api/types.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import OutgoingForm from './outgoing-form.svelte';

	interface Props {
		open: boolean;
		outgoing: OutgoingResponse | null;
		parts: PartResponse[];
		docNumber: string;
		onSuccess: () => void;
	}

	let { open = $bindable(), outgoing, parts, docNumber, onSuccess }: Props = $props();

	const isEditing = $derived(!!outgoing);
	const dialogTitle = $derived(isEditing ? 'Edit Outgoing' : 'Create Outgoing');
	const dialogDescription = $derived(
		isEditing ? 'Update the outgoing document.' : 'Create a new outgoing document.'
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>{dialogTitle}</Dialog.Title>
			<Dialog.Description>{dialogDescription}</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 overflow-y-auto py-4">
			<OutgoingForm {outgoing} {parts} {docNumber} onCancel={() => (open = false)} {onSuccess} />
		</div>
	</Dialog.Content>
</Dialog.Root>
