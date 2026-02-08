<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getRequests } from '$lib/api/requests.js';
	import { getParts } from '$lib/api/parts.js';
	import type { PartResponse, RequestResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import RequestForm from '../request-form.svelte';

	let parts = $state<PartResponse[]>([]);
	let requests = $state<RequestResponse[]>([]);
	let loading = $state(true);

	const canCreate = $derived(auth.hasPermission('requests.create'));

	function generateRequestNumber(): string {
		const now = new Date();
		const dd = String(now.getDate()).padStart(2, '0');
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const yy = String(now.getFullYear()).slice(-2);
		const datePrefix = `REQ-${dd}${mm}${yy}`;

		const todayDocs = requests.filter((r) => r.request_number.startsWith(datePrefix));
		let maxNum = 0;
		todayDocs.forEach((r) => {
			const reqParts = r.request_number.split('-');
			if (reqParts.length === 3) {
				const num = parseInt(reqParts[2], 10);
				if (num > maxNum) maxNum = num;
			}
		});

		const nextNum = String(maxNum + 1).padStart(4, '0');
		return `${datePrefix}-${nextNum}`;
	}

	onMount(async () => {
		loading = true;
		try {
			const [requestsRes, partsRes] = await Promise.all([getRequests(), getParts()]);
			requests = requestsRes.items;
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
	<title>New Request - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-bold">New Request</h1>
			<p class="text-muted-foreground">Create a part request</p>
		</div>
		<Button variant="outline" onclick={() => goto(resolve('/app/requests'))} disabled={loading}>
			Back
		</Button>
	</div>

	{#if !canCreate}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">You don't have permission to create requests.</p>
		</div>
	{:else if loading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-72" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else}
		<div class="w-full rounded-xl border bg-card p-4 md:p-6">
			<RequestForm
				request={null}
				{parts}
				requestNumber={generateRequestNumber()}
				onCancel={() => goto(resolve('/app/requests'))}
				onSuccess={() => goto(resolve('/app/requests'))}
			/>
		</div>
	{/if}
</div>
