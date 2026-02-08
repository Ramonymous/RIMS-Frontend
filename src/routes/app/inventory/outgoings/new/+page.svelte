<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getOutgoings } from '$lib/api/outgoings.js';
	import { getParts } from '$lib/api/parts.js';
	import type { OutgoingResponse, PartResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import OutgoingForm from '../outgoing-form.svelte';

	let parts = $state<PartResponse[]>([]);
	let outgoings = $state<OutgoingResponse[]>([]);
	let loading = $state(true);

	const canCreate = $derived(auth.hasPermission('outgoings.create'));

	function generateDocNumber(): string {
		const now = new Date();
		const dd = String(now.getDate()).padStart(2, '0');
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const yy = String(now.getFullYear()).slice(-2);
		const datePrefix = `OUT-${dd}${mm}${yy}`;

		const todayDocs = outgoings.filter((o) => o.doc_number.startsWith(datePrefix));
		let maxNum = 0;
		todayDocs.forEach((o) => {
			const parts = o.doc_number.split('-');
			if (parts.length === 3) {
				const num = parseInt(parts[2], 10);
				if (num > maxNum) maxNum = num;
			}
		});

		const nextNum = String(maxNum + 1).padStart(4, '0');
		return `${datePrefix}-${nextNum}`;
	}

	onMount(async () => {
		loading = true;
		try {
			const [outgoingsRes, partsRes] = await Promise.all([getOutgoings(), getParts()]);
			outgoings = outgoingsRes.items;
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
	<title>New Outgoing - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-bold">New Outgoing</h1>
			<p class="text-muted-foreground">Create an outgoing goods issue</p>
		</div>
		<Button
			variant="outline"
			onclick={() => goto(resolve('/app/inventory/outgoings'))}
			disabled={loading}
		>
			Back
		</Button>
	</div>

	{#if !canCreate}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">You don't have permission to create outgoings.</p>
		</div>
	{:else if loading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-72" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else}
		<div class="w-full rounded-xl border bg-card p-4 md:p-6">
			<OutgoingForm
				outgoing={null}
				{parts}
				docNumber={generateDocNumber()}
				onCancel={() => goto(resolve('/app/inventory/outgoings'))}
				onSuccess={() => goto(resolve('/app/inventory/outgoings'))}
			/>
		</div>
	{/if}
</div>
