<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getReceivings } from '$lib/api/receivings.js';
	import { getParts } from '$lib/api/parts.js';
	import type { PartResponse, ReceivingResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import ReceivingForm from '../receiving-form.svelte';

	let parts = $state<PartResponse[]>([]);
	let receivings = $state<ReceivingResponse[]>([]);
	let loading = $state(true);

	const canCreate = $derived(auth.hasPermission('receivings.create'));

	function generateDocNumber(): string {
		const now = new Date();
		const dd = String(now.getDate()).padStart(2, '0');
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const yy = String(now.getFullYear()).slice(-2);
		const datePrefix = `RCV-${dd}${mm}${yy}`;

		const todayDocs = receivings.filter((r) => r.doc_number.startsWith(datePrefix));
		let maxNum = 0;
		todayDocs.forEach((r) => {
			const parts = r.doc_number.split('-');
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
			const [receivingsRes, partsRes] = await Promise.all([getReceivings(), getParts()]);
			receivings = receivingsRes.items;
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
	<title>New Receiving - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<div class="flex items-center justify-between gap-2">
		<div>
			<h1 class="text-2xl font-bold">New Receiving</h1>
			<p class="text-muted-foreground">Create an incoming goods receipt</p>
		</div>
		<Button variant="outline" onclick={() => goto(resolve('/app/receivings'))} disabled={loading}>
			Back
		</Button>
	</div>

	{#if !canCreate}
		<div class="rounded-md border p-6">
			<p class="text-sm text-muted-foreground">You don't have permission to create receivings.</p>
		</div>
	{:else if loading}
		<div class="space-y-4">
			<Skeleton class="h-10 w-72" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else}
		<div class="w-full rounded-xl border bg-card p-4 md:p-6">
			<ReceivingForm
				receiving={null}
				{parts}
				docNumber={generateDocNumber()}
				onCancel={() => goto(resolve('/app/receivings'))}
				onSuccess={() => goto(resolve('/app/receivings'))}
			/>
		</div>
	{/if}
</div>
