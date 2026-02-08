<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getReceiving } from '$lib/api/receivings.js';
	import { getParts } from '$lib/api/parts.js';
	import type { PartResponse, ReceivingResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import ReceivingForm from '../../receiving-form.svelte';

	let receiving = $state<ReceivingResponse | null>(null);
	let parts = $state<PartResponse[]>([]);
	let loading = $state(true);

	const canUpdate = $derived(auth.hasPermission('receivings.update'));

	onMount(async () => {
		loading = true;
		try {
			const receivingId = $page.params.receivingId;
			if (!receivingId) {
				toast.error('Invalid route', { description: 'Missing receiving id.' });
				return;
			}
			const [receivingRes, partsRes] = await Promise.all([getReceiving(receivingId), getParts()]);
			receiving = receivingRes;
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
	<title>Edit Receiving - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-bold">Edit Receiving</h1>
			<p class="text-muted-foreground">Update an incoming goods receipt</p>
		</div>
		<Button variant="outline" onclick={() => goto(resolve('/app/receivings'))} disabled={loading}>
			Back
		</Button>
	</div>

	{#if !canUpdate}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">You don't have permission to update receivings.</p>
		</div>
	{:else if loading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-72" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else if !receiving}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">Receiving not found.</p>
		</div>
	{:else}
		<div class="w-full rounded-xl border bg-card p-4 md:p-6">
			<ReceivingForm
				{receiving}
				{parts}
				docNumber={receiving.doc_number}
				onCancel={() => goto(resolve('/app/receivings'))}
				onSuccess={() => goto(resolve('/app/receivings'))}
			/>
		</div>
	{/if}
</div>
