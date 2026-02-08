<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		getOutgoings,
		deleteOutgoing,
		completeOutgoing,
		cancelOutgoing,
		confirmGI
	} from '$lib/api/outgoings.js';
	import type { OutgoingResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { formatDateLocal, formatDate, getFirstOfMonth, getLastOfMonth } from '$lib/utils.js';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	// Icons
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import RefreshIcon from '@tabler/icons-svelte/icons/refresh';
	import DotsVerticalIcon from '@tabler/icons-svelte/icons/dots-vertical';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import XIcon from '@tabler/icons-svelte/icons/x';
	import CircleCheckIcon from '@tabler/icons-svelte/icons/circle-check';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	// State
	let outgoings = $state<OutgoingResponse[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	// Date filters - default to current month (Asia/Jakarta timezone)
	let startDate = $state(formatDateLocal(getFirstOfMonth()));
	let endDate = $state(formatDateLocal(getLastOfMonth()));

	// Dialog states
	let deleteDialogOpen = $state(false);
	let outgoingToDelete = $state<OutgoingResponse | null>(null);
	let actionLoading = $state(false);

	// Permissions
	const canCreate = $derived(auth.hasPermission('outgoings.create'));
	const canUpdate = $derived(auth.hasPermission('outgoings.update'));
	const canDelete = $derived(auth.hasPermission('outgoings.delete'));
	const canComplete = $derived(auth.hasPermission('outgoings.complete'));
	const canConfirmGI = $derived(auth.hasPermission('outgoings.confirm_gi'));

	// Filtered outgoings
	const filteredOutgoings = $derived(
		outgoings.filter((outgoing) => {
			const matchesSearch =
				searchQuery === '' || outgoing.doc_number.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesStatus = statusFilter === 'all' || outgoing.status === statusFilter;

			// Date filter
			const outgoingDate = new Date(outgoing.issued_at).toISOString().split('T')[0];
			const matchesDateRange =
				(!startDate || outgoingDate >= startDate) && (!endDate || outgoingDate <= endDate);

			return matchesSearch && matchesStatus && matchesDateRange;
		})
	);

	async function loadData() {
		loading = true;
		try {
			const outgoingsRes = await getOutgoings();
			outgoings = outgoingsRes.items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load data', { description: error.detail });
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		goto(resolve('/app/outgoings/new'));
	}

	function openEditDialog(outgoing: OutgoingResponse) {
		goto(resolve(`/app/outgoings/${outgoing.id}/edit`));
	}

	function openDeleteDialog(outgoing: OutgoingResponse) {
		outgoingToDelete = outgoing;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!outgoingToDelete) return;

		actionLoading = true;
		try {
			await deleteOutgoing(outgoingToDelete.id);
			toast.success('Outgoing deleted', {
				description: `${outgoingToDelete.doc_number} has been deleted.`
			});
			deleteDialogOpen = false;
			outgoingToDelete = null;
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to delete outgoing', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleComplete(outgoing: OutgoingResponse) {
		actionLoading = true;
		try {
			await completeOutgoing(outgoing.id);
			toast.success('Outgoing completed', {
				description: `${outgoing.doc_number} has been completed. Stock updated.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to complete outgoing', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleCancel(outgoing: OutgoingResponse) {
		actionLoading = true;
		try {
			await cancelOutgoing(outgoing.id);
			toast.success('Outgoing cancelled', {
				description: `${outgoing.doc_number} has been cancelled.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to cancel outgoing', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleConfirmGI(outgoing: OutgoingResponse) {
		actionLoading = true;
		try {
			await confirmGI(outgoing.id);
			toast.success('GI confirmed', {
				description: `${outgoing.doc_number} has been confirmed as Goods Issue.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to confirm GI', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'completed':
				return 'default';
			case 'draft':
				return 'secondary';
			case 'cancelled':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	// formatDate is imported from $lib/utils.js

	function isEditable(outgoing: OutgoingResponse): boolean {
		return !outgoing.is_gi && outgoing.status === 'draft';
	}

	onMount(() => {
		loadData();
	});
</script>

<svelte:head>
	<title>Outgoings - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<!-- Header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div class="space-y-1">
			<h1 class="text-3xl font-semibold tracking-tight">Outgoings</h1>
			<p class="text-sm text-muted-foreground">Manage outgoing goods issues</p>
		</div>
		<div class="hidden gap-2 sm:flex">
			{#if canCreate}
				<Button onclick={openCreateDialog}>
					<PlusIcon class="size-4" />
					New Outgoing
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="rounded-xl border bg-card p-3 sm:p-4">
		<div class="grid gap-3 sm:flex sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input placeholder="Search by document number..." bind:value={searchQuery} class="pl-10" />
			</div>
			<div class="grid gap-2 sm:flex sm:items-center sm:gap-2">
				<div class="space-y-1">
					<div class="text-xs font-medium text-muted-foreground sm:sr-only">Start</div>
					<Input type="date" bind:value={startDate} class="w-full sm:w-36" />
				</div>
				<div class="space-y-1">
					<div class="text-xs font-medium text-muted-foreground sm:sr-only">End</div>
					<Input type="date" bind:value={endDate} class="w-full sm:w-36" />
				</div>
			</div>
			<Select.Root type="single" bind:value={statusFilter}>
				<Select.Trigger class="w-full sm:w-40">
					{statusFilter === 'all'
						? 'All Status'
						: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Status</Select.Item>
					<Select.Item value="draft">Draft</Select.Item>
					<Select.Item value="completed">Completed</Select.Item>
					<Select.Item value="cancelled">Cancelled</Select.Item>
				</Select.Content>
			</Select.Root>
			<Button
				variant="outline"
				size="icon"
				onclick={loadData}
				disabled={loading}
				class="justify-self-start sm:justify-self-auto"
			>
				<RefreshIcon class="size-4 {loading ? 'animate-spin' : ''}" />
			</Button>
		</div>
	</div>

	<!-- Mobile Cards -->
	<div class="grid gap-3 md:hidden">
		{#if loading}
			{#each Array(6) as _, i (i)}
				<div class="rounded-xl border bg-card p-4">
					<div class="space-y-3">
						<Skeleton class="h-5 w-40" />
						<Skeleton class="h-4 w-28" />
						<Skeleton class="h-4 w-24" />
					</div>
				</div>
			{/each}
		{:else if filteredOutgoings.length === 0}
			<div class="rounded-xl border bg-card p-6 text-center">
				<p class="text-sm text-muted-foreground">No outgoings found</p>
				{#if canCreate}
					<div class="mt-3">
						<Button variant="outline" size="sm" onclick={openCreateDialog}>
							<PlusIcon class="size-4" />
							Create your first outgoing
						</Button>
					</div>
				{/if}
			</div>
		{:else}
			{#each filteredOutgoings as outgoing (outgoing.id)}
				<div class="rounded-xl border bg-card p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate font-mono text-base font-semibold">{outgoing.doc_number}</div>
							<div class="mt-1 text-sm text-muted-foreground">
								{formatDate(outgoing.issued_at)}
							</div>
						</div>
						<Badge variant={getStatusVariant(outgoing.status)}>
							{outgoing.status.charAt(0).toUpperCase() + outgoing.status.slice(1)}
						</Badge>
					</div>

					<div class="mt-3 flex items-center justify-between text-sm">
						<div class="text-muted-foreground">
							Items
							<span class="ml-1 font-medium text-foreground">{outgoing.total_items}</span>
						</div>
						<div class="text-muted-foreground">
							GI
							<span class="ml-1 font-medium text-foreground">{outgoing.is_gi ? 'Yes' : 'No'}</span>
						</div>
					</div>

					<div class="mt-4 flex items-center justify-end gap-2">
						{#if canUpdate && isEditable(outgoing)}
							<Button variant="outline" size="sm" onclick={() => openEditDialog(outgoing)}>
								<PencilIcon class="size-4" />
								Edit
							</Button>
						{/if}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button variant="ghost" size="icon" {...props}>
										<DotsVerticalIcon class="size-4" />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end">
								{#if canComplete && outgoing.status === 'draft'}
									<DropdownMenu.Item onclick={() => handleComplete(outgoing)}>
										<CheckIcon class="size-4" />
										Complete
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => handleCancel(outgoing)}>
										<XIcon class="size-4" />
										Cancel
									</DropdownMenu.Item>
								{/if}
								{#if canConfirmGI && outgoing.status === 'completed' && !outgoing.is_gi}
									<DropdownMenu.Item onclick={() => handleConfirmGI(outgoing)}>
										<CircleCheckIcon class="size-4" />
										Confirm GI
									</DropdownMenu.Item>
								{/if}
								{#if canDelete && outgoing.status === 'draft'}
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										class="text-destructive"
										onclick={() => openDeleteDialog(outgoing)}
									>
										<TrashIcon class="size-4" />
										Delete
									</DropdownMenu.Item>
								{/if}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Desktop Table -->
	<div class="hidden rounded-xl border bg-card md:block">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Doc Number</Table.Head>
					<Table.Head>Issued At</Table.Head>
					<Table.Head class="text-right">Total Items</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head>GI</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if loading}
					{#each Array(5) as _, i (i)}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
							<Table.Cell><Skeleton class="h-6 w-20" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-8" /></Table.Cell>
							<Table.Cell class="text-right"><Skeleton class="ml-auto h-8 w-8" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if filteredOutgoings.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="h-24 text-center">
							<div class="flex flex-col items-center gap-2 text-muted-foreground">
								<p>No outgoings found</p>
								{#if canCreate}
									<Button variant="outline" size="sm" onclick={openCreateDialog}>
										<PlusIcon class="size-4" />
										Create your first outgoing
									</Button>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each filteredOutgoings as outgoing (outgoing.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{outgoing.doc_number}</Table.Cell>
							<Table.Cell>{formatDate(outgoing.issued_at)}</Table.Cell>
							<Table.Cell class="text-right">{outgoing.total_items}</Table.Cell>
							<Table.Cell>
								<Badge variant={getStatusVariant(outgoing.status)}>
									{outgoing.status.charAt(0).toUpperCase() + outgoing.status.slice(1)}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if outgoing.is_gi}
									<Badge variant="default">
										<CheckIcon class="size-3" />
									</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button variant="ghost" size="icon" {...props}>
												<DotsVerticalIcon class="size-4" />
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										{#if canUpdate && isEditable(outgoing)}
											<DropdownMenu.Item onclick={() => openEditDialog(outgoing)}>
												<PencilIcon class="size-4" />
												Edit
											</DropdownMenu.Item>
										{/if}
										{#if canComplete && outgoing.status === 'draft'}
											<DropdownMenu.Item onclick={() => handleComplete(outgoing)}>
												<CheckIcon class="size-4" />
												Complete
											</DropdownMenu.Item>
											<DropdownMenu.Item onclick={() => handleCancel(outgoing)}>
												<XIcon class="size-4" />
												Cancel
											</DropdownMenu.Item>
										{/if}
										{#if canConfirmGI && outgoing.status === 'completed' && !outgoing.is_gi}
											<DropdownMenu.Item onclick={() => handleConfirmGI(outgoing)}>
												<CircleCheckIcon class="size-4" />
												Confirm GI
											</DropdownMenu.Item>
										{/if}
										{#if canDelete && outgoing.status === 'draft'}
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												class="text-destructive"
												onclick={() => openDeleteDialog(outgoing)}
											>
												<TrashIcon class="size-4" />
												Delete
											</DropdownMenu.Item>
										{/if}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Stats -->
	{#if !loading}
		<div class="text-sm text-muted-foreground">
			Showing {filteredOutgoings.length} of {outgoings.length} outgoings
		</div>
	{/if}
</div>

{#if canCreate}
	<div class="fixed right-4 bottom-4 z-50 md:hidden">
		<Button
			class="size-14 rounded-full p-0 shadow-lg"
			onclick={openCreateDialog}
			aria-label="New Outgoing"
		>
			<PlusIcon class="size-6" />
			<span class="sr-only">New Outgoing</span>
		</Button>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Outgoing</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{outgoingToDelete?.doc_number}</strong>? This action
				cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={actionLoading}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={confirmDelete}
				disabled={actionLoading}
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
			>
				{#if actionLoading}
					<LoaderCircleIcon class="size-4 animate-spin" />
					Deleting...
				{:else}
					Delete
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
