<script lang="ts">
	import {
		getOutgoings,
		deleteOutgoing,
		completeOutgoing,
		cancelOutgoing,
		confirmGI
	} from '$lib/api/outgoings.js';
	import { getParts } from '$lib/api/parts.js';
	import type { OutgoingResponse, PartResponse } from '$lib/api/types.js';
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
	import OutgoingFormDialog from './outgoing-form-dialog.svelte';

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
	let parts = $state<PartResponse[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	// Date filters - default to current month (Asia/Jakarta timezone)
	let startDate = $state(formatDateLocal(getFirstOfMonth()));
	let endDate = $state(formatDateLocal(getLastOfMonth()));

	// Dialog states
	let formDialogOpen = $state(false);
	let selectedOutgoing = $state<OutgoingResponse | null>(null);
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

	// Generate doc number: OUT-{ddmmyy}-0001
	function generateDocNumber(): string {
		const now = new Date();
		const dd = String(now.getDate()).padStart(2, '0');
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const yy = String(now.getFullYear()).slice(-2);
		const datePrefix = `OUT-${dd}${mm}${yy}`;

		// Find the highest number for today
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

	async function loadData() {
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
	}

	function openCreateDialog() {
		selectedOutgoing = null;
		formDialogOpen = true;
	}

	function openEditDialog(outgoing: OutgoingResponse) {
		selectedOutgoing = outgoing;
		formDialogOpen = true;
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

	function handleFormSuccess() {
		formDialogOpen = false;
		loadData();
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
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">Outgoings</h1>
			<p class="text-muted-foreground">Manage outgoing goods issues</p>
		</div>
		<div class="flex gap-2">
			{#if canCreate}
				<Button onclick={openCreateDialog}>
					<PlusIcon class="size-4" />
					New Outgoing
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input placeholder="Search by document number..." bind:value={searchQuery} class="pl-10" />
		</div>
		<div class="flex items-center gap-2">
			<Input type="date" bind:value={startDate} class="w-36" />
			<span class="text-muted-foreground">to</span>
			<Input type="date" bind:value={endDate} class="w-36" />
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
		<Button variant="outline" size="icon" onclick={loadData} disabled={loading}>
			<RefreshIcon class="size-4 {loading ? 'animate-spin' : ''}" />
		</Button>
	</div>

	<!-- Table -->
	<div class="rounded-md border">
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

<!-- Outgoing Form Dialog -->
<OutgoingFormDialog
	bind:open={formDialogOpen}
	outgoing={selectedOutgoing}
	{parts}
	docNumber={selectedOutgoing ? selectedOutgoing.doc_number : generateDocNumber()}
	onSuccess={handleFormSuccess}
/>

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
