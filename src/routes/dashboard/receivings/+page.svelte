<script lang="ts">
	import {
		getReceivings,
		deleteReceiving,
		completeReceiving,
		cancelReceiving,
		confirmGR
	} from '$lib/api/receivings.js';
	import { getParts } from '$lib/api/parts.js';
	import type { ReceivingResponse, PartResponse } from '$lib/api/types.js';
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
	import ReceivingFormDialog from './receiving-form-dialog.svelte';

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
	let receivings = $state<ReceivingResponse[]>([]);
	let parts = $state<PartResponse[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	// Date filters - default to current month (Asia/Jakarta timezone)
	let startDate = $state(formatDateLocal(getFirstOfMonth()));
	let endDate = $state(formatDateLocal(getLastOfMonth()));

	// Dialog states
	let formDialogOpen = $state(false);
	let selectedReceiving = $state<ReceivingResponse | null>(null);
	let deleteDialogOpen = $state(false);
	let receivingToDelete = $state<ReceivingResponse | null>(null);
	let actionLoading = $state(false);

	// Permissions
	const canCreate = $derived(auth.hasPermission('receivings.create'));
	const canUpdate = $derived(auth.hasPermission('receivings.update'));
	const canDelete = $derived(auth.hasPermission('receivings.delete'));
	const canComplete = $derived(auth.hasPermission('receivings.complete'));
	const canConfirmGR = $derived(auth.hasPermission('receivings.confirm_gr'));

	// Filtered receivings
	const filteredReceivings = $derived(
		receivings.filter((receiving) => {
			const matchesSearch =
				searchQuery === '' ||
				receiving.doc_number.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesStatus = statusFilter === 'all' || receiving.status === statusFilter;

			// Date filter
			const receivingDate = new Date(receiving.received_at).toISOString().split('T')[0];
			const matchesDateRange =
				(!startDate || receivingDate >= startDate) && (!endDate || receivingDate <= endDate);

			return matchesSearch && matchesStatus && matchesDateRange;
		})
	);

	// Generate doc number: RCV-{ddmmyy}-0001
	function generateDocNumber(): string {
		const now = new Date();
		const dd = String(now.getDate()).padStart(2, '0');
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const yy = String(now.getFullYear()).slice(-2);
		const datePrefix = `RCV-${dd}${mm}${yy}`;

		// Find the highest number for today
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

	async function loadData() {
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
	}

	function openCreateDialog() {
		selectedReceiving = null;
		formDialogOpen = true;
	}

	function openEditDialog(receiving: ReceivingResponse) {
		selectedReceiving = receiving;
		formDialogOpen = true;
	}

	function openDeleteDialog(receiving: ReceivingResponse) {
		receivingToDelete = receiving;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!receivingToDelete) return;

		actionLoading = true;
		try {
			await deleteReceiving(receivingToDelete.id);
			toast.success('Receiving deleted', {
				description: `${receivingToDelete.doc_number} has been deleted.`
			});
			deleteDialogOpen = false;
			receivingToDelete = null;
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to delete receiving', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleComplete(receiving: ReceivingResponse) {
		actionLoading = true;
		try {
			await completeReceiving(receiving.id);
			toast.success('Receiving completed', {
				description: `${receiving.doc_number} has been completed. Stock updated.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to complete receiving', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleCancel(receiving: ReceivingResponse) {
		actionLoading = true;
		try {
			await cancelReceiving(receiving.id);
			toast.success('Receiving cancelled', {
				description: `${receiving.doc_number} has been cancelled.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to cancel receiving', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleConfirmGR(receiving: ReceivingResponse) {
		actionLoading = true;
		try {
			await confirmGR(receiving.id);
			toast.success('GR confirmed', {
				description: `${receiving.doc_number} has been confirmed as Goods Receipt.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to confirm GR', { description: error.detail });
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

	function isEditable(receiving: ReceivingResponse): boolean {
		return !receiving.is_gr && receiving.status === 'draft';
	}

	onMount(() => {
		loadData();
	});
</script>

<svelte:head>
	<title>Receivings - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">Receivings</h1>
			<p class="text-muted-foreground">Manage incoming goods receipts</p>
		</div>
		<div class="flex gap-2">
			{#if canCreate}
				<Button onclick={openCreateDialog}>
					<PlusIcon class="size-4" />
					New Receiving
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
					<Table.Head>Received At</Table.Head>
					<Table.Head class="text-right">Total Items</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head>GR</Table.Head>
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
				{:else if filteredReceivings.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="h-24 text-center">
							<div class="flex flex-col items-center gap-2 text-muted-foreground">
								<p>No receivings found</p>
								{#if canCreate}
									<Button variant="outline" size="sm" onclick={openCreateDialog}>
										<PlusIcon class="size-4" />
										Create your first receiving
									</Button>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each filteredReceivings as receiving (receiving.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{receiving.doc_number}</Table.Cell>
							<Table.Cell>{formatDate(receiving.received_at)}</Table.Cell>
							<Table.Cell class="text-right">{receiving.total_items}</Table.Cell>
							<Table.Cell>
								<Badge variant={getStatusVariant(receiving.status)}>
									{receiving.status.charAt(0).toUpperCase() + receiving.status.slice(1)}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if receiving.is_gr}
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
										{#if canUpdate && isEditable(receiving)}
											<DropdownMenu.Item onclick={() => openEditDialog(receiving)}>
												<PencilIcon class="size-4" />
												Edit
											</DropdownMenu.Item>
										{/if}
										{#if canComplete && receiving.status === 'draft'}
											<DropdownMenu.Item onclick={() => handleComplete(receiving)}>
												<CheckIcon class="size-4" />
												Complete
											</DropdownMenu.Item>
											<DropdownMenu.Item onclick={() => handleCancel(receiving)}>
												<XIcon class="size-4" />
												Cancel
											</DropdownMenu.Item>
										{/if}
										{#if canConfirmGR && receiving.status === 'completed' && !receiving.is_gr}
											<DropdownMenu.Item onclick={() => handleConfirmGR(receiving)}>
												<CircleCheckIcon class="size-4" />
												Confirm GR
											</DropdownMenu.Item>
										{/if}
										{#if canDelete && receiving.status === 'draft'}
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												class="text-destructive"
												onclick={() => openDeleteDialog(receiving)}
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
			Showing {filteredReceivings.length} of {receivings.length} receivings
		</div>
	{/if}
</div>

<!-- Receiving Form Dialog -->
<ReceivingFormDialog
	bind:open={formDialogOpen}
	receiving={selectedReceiving}
	{parts}
	docNumber={selectedReceiving ? selectedReceiving.doc_number : generateDocNumber()}
	onSuccess={handleFormSuccess}
/>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Receiving</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{receivingToDelete?.doc_number}</strong>? This
				action cannot be undone.
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
