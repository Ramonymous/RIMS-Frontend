<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getOutgoing } from '$lib/api/outgoings.js';
	import { getParts } from '$lib/api/parts.js';
	import type { OutgoingResponse, PartResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import OutgoingForm from '../../outgoing-form.svelte';

	let outgoing = $state<OutgoingResponse | null>(null);
	let parts = $state<PartResponse[]>([]);
	let loading = $state(true);

	const canUpdate = $derived(auth.hasPermission('outgoings.update'));

	onMount(async () => {
		loading = true;
		try {
			const outgoingId = $page.params.outgoingId;
			if (!outgoingId) {
				toast.error('Invalid route', { description: 'Missing outgoing id.' });
				return;
			}
			const [outgoingRes, partsRes] = await Promise.all([getOutgoing(outgoingId), getParts()]);
			outgoing = outgoingRes;
			parts = partsRes.items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load data', { description: error.detail });
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Edit Outgoing - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-bold">Edit Outgoing</h1>
			<p class="text-muted-foreground">Update an outgoing goods issue</p>
		</div>
		<Button variant="outline" onclick={() => goto(resolve('/app/outgoings'))} disabled={loading}>
			Back
		</Button>
	</div>

	{#if !canUpdate}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">You don't have permission to update outgoings.</p>
		</div>
	{:else if loading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-72" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else if !outgoing}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">Outgoing not found.</p>
		</div>
	{:else}
		<div class="w-full rounded-xl border bg-card p-4 md:p-6">
			<OutgoingForm
				{outgoing}
				{parts}
				docNumber={outgoing.doc_number}
				onCancel={() => goto(resolve('/app/outgoings'))}
				onSuccess={() => goto(resolve('/app/outgoings'))}
			/>
		</div>
	{/if}
</div>
