<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getRequest } from '$lib/api/requests.js';
	import { getParts } from '$lib/api/parts.js';
	import type { PartResponse, RequestResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import RequestForm from '../../request-form.svelte';

	let request = $state<RequestResponse | null>(null);
	let parts = $state<PartResponse[]>([]);
	let loading = $state(true);

	const canUpdate = $derived(auth.hasPermission('requests.update'));

	onMount(async () => {
		loading = true;
		try {
			const requestId = $page.params.requestId;
			if (!requestId) {
				toast.error('Invalid route', { description: 'Missing request id.' });
				return;
			}
			const [requestRes, partsRes] = await Promise.all([getRequest(requestId), getParts()]);
			request = requestRes;
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
	<title>Edit Request - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-bold">Edit Request</h1>
			<p class="text-muted-foreground">Update a part request</p>
		</div>
		<Button
			variant="outline"
			onclick={() => goto(resolve('/app/inventory/requests'))}
			disabled={loading}
		>
			Back
		</Button>
	</div>

	{#if !canUpdate}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">You don't have permission to update requests.</p>
		</div>
	{:else if loading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-72" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else if !request}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">Request not found.</p>
		</div>
	{:else}
		<div class="w-full rounded-xl border bg-card p-4 md:p-6">
			<RequestForm
				{request}
				{parts}
				requestNumber={request.request_number}
				onCancel={() => goto(resolve('/app/inventory/requests'))}
				onSuccess={() => goto(resolve('/app/inventory/requests'))}
			/>
		</div>
	{/if}
</div>
