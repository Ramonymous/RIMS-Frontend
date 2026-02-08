<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getRequests, deleteRequest, completeRequest, cancelRequest } from '$lib/api/requests.js';
	import type { RequestResponse } from '$lib/api/types.js';
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
	import AlertCircleIcon from '@tabler/icons-svelte/icons/alert-circle';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	// State
	let requests = $state<RequestResponse[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	// Date filters - default to current month (Asia/Jakarta timezone)
	let startDate = $state(formatDateLocal(getFirstOfMonth()));
	let endDate = $state(formatDateLocal(getLastOfMonth()));

	// Dialog states
	let deleteDialogOpen = $state(false);
	let requestToDelete = $state<RequestResponse | null>(null);
	let actionLoading = $state(false);

	// Permissions
	const canCreate = $derived(auth.hasPermission('requests.create'));
	const canUpdate = $derived(auth.hasPermission('requests.update'));
	const canDelete = $derived(auth.hasPermission('requests.delete'));
	const canComplete = $derived(auth.hasPermission('requests.complete'));

	// Filtered requests
	const filteredRequests = $derived(
		requests.filter((request) => {
			const matchesSearch =
				searchQuery === '' ||
				request.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(request.destination?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

			const matchesStatus = statusFilter === 'all' || request.status === statusFilter;

			// Date filter
			const requestDate = new Date(request.requested_at).toISOString().split('T')[0];
			const matchesDateRange =
				(!startDate || requestDate >= startDate) && (!endDate || requestDate <= endDate);

			return matchesSearch && matchesStatus && matchesDateRange;
		})
	);

	async function loadData() {
		loading = true;
		try {
			const requestsRes = await getRequests();
			requests = requestsRes.items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load data', { description: error.detail });
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		goto(resolve('/app/inventory/requests/new'));
	}

	function openEditDialog(request: RequestResponse) {
		goto(resolve(`/app/inventory/requests/${request.id}/edit`));
	}

	function openDeleteDialog(request: RequestResponse) {
		requestToDelete = request;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!requestToDelete) return;

		actionLoading = true;
		try {
			await deleteRequest(requestToDelete.id);
			toast.success('Request deleted', {
				description: `${requestToDelete.request_number} has been deleted.`
			});
			deleteDialogOpen = false;
			requestToDelete = null;
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to delete request', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleComplete(request: RequestResponse) {
		actionLoading = true;
		try {
			await completeRequest(request.id);
			toast.success('Request completed', {
				description: `${request.request_number} has been completed.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to complete request', { description: error.detail });
		} finally {
			actionLoading = false;
		}
	}

	async function handleCancel(request: RequestResponse) {
		actionLoading = true;
		try {
			await cancelRequest(request.id);
			toast.success('Request cancelled', {
				description: `${request.request_number} has been cancelled.`
			});
			await loadData();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to cancel request', { description: error.detail });
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

	function isEditable(request: RequestResponse): boolean {
		return request.status === 'draft';
	}

	function getTotalItems(request: RequestResponse): number {
		return request.items?.reduce((sum, item) => sum + item.qty, 0) ?? 0;
	}

	function getUrgentCount(request: RequestResponse): number {
		return request.items?.filter((item) => item.is_urgent).length ?? 0;
	}

	function getSuppliedCount(request: RequestResponse): number {
		return request.items?.filter((item) => item.is_supplied).length ?? 0;
	}

	onMount(() => {
		loadData();
	});
</script>

<svelte:head>
	<title>Requests - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<!-- Header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div class="space-y-1">
			<h1 class="text-3xl font-semibold tracking-tight">Requests</h1>
			<p class="text-sm text-muted-foreground">Manage part requests</p>
		</div>
		<div class="hidden gap-2 sm:flex">
			{#if canCreate}
				<Button onclick={openCreateDialog}>
					<PlusIcon class="size-4" />
					New Request
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="rounded-xl border bg-card p-3 sm:p-4">
		<div class="grid gap-3 sm:flex sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search by request number or destination..."
					bind:value={searchQuery}
					class="pl-10"
				/>
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
		{:else if filteredRequests.length === 0}
			<div class="rounded-xl border bg-card p-6 text-center">
				<p class="text-sm text-muted-foreground">No requests found</p>
				{#if canCreate}
					<div class="mt-3">
						<Button variant="outline" size="sm" onclick={openCreateDialog}>
							<PlusIcon class="size-4" />
							Create your first request
						</Button>
					</div>
				{/if}
			</div>
		{:else}
			{#each filteredRequests as request (request.id)}
				<div class="rounded-xl border bg-card p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate font-mono text-base font-semibold">{request.request_number}</div>
							<div class="mt-1 text-sm text-muted-foreground">
								{request.destination ?? '-'}
							</div>
						</div>
						<Badge variant={getStatusVariant(request.status)}>
							{request.status.charAt(0).toUpperCase() + request.status.slice(1)}
						</Badge>
					</div>

					<div class="mt-3 flex items-center justify-between text-sm">
						<div class="text-muted-foreground">
							Items
							<span class="ml-1 font-medium text-foreground">{getTotalItems(request)}</span>
						</div>
						<div class="text-muted-foreground">
							Supplied
							<span class="ml-1 font-medium text-foreground">
								{getSuppliedCount(request)} / {request.items?.length ?? 0}
							</span>
						</div>
					</div>

					<div class="mt-3 text-sm text-muted-foreground">
						{formatDate(request.requested_at)}
					</div>

					<div class="mt-4 flex items-center justify-end gap-2">
						{#if canUpdate && isEditable(request)}
							<Button variant="outline" size="sm" onclick={() => openEditDialog(request)}>
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
								{#if canComplete && request.status === 'draft'}
									<DropdownMenu.Item onclick={() => handleComplete(request)}>
										<CheckIcon class="size-4" />
										Complete
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => handleCancel(request)}>
										<XIcon class="size-4" />
										Cancel
									</DropdownMenu.Item>
								{/if}
								{#if canDelete && request.status === 'draft'}
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										class="text-destructive"
										onclick={() => openDeleteDialog(request)}
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
					<Table.Head>Request Number</Table.Head>
					<Table.Head>Requested At</Table.Head>
					<Table.Head>Destination</Table.Head>
					<Table.Head class="text-right">Items</Table.Head>
					<Table.Head class="text-center">Urgent</Table.Head>
					<Table.Head class="text-center">Supplied</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if loading}
					{#each Array(5) as _, i (i)}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
							<Table.Cell class="text-center"><Skeleton class="mx-auto h-4 w-8" /></Table.Cell>
							<Table.Cell class="text-center"><Skeleton class="mx-auto h-4 w-12" /></Table.Cell>
							<Table.Cell><Skeleton class="h-6 w-20" /></Table.Cell>
							<Table.Cell class="text-right"><Skeleton class="ml-auto h-8 w-8" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if filteredRequests.length === 0}
					<Table.Row>
						<Table.Cell colspan={8} class="h-24 text-center">
							<div class="flex flex-col items-center gap-2 text-muted-foreground">
								<p>No requests found</p>
								{#if canCreate}
									<Button variant="outline" size="sm" onclick={openCreateDialog}>
										<PlusIcon class="size-4" />
										Create your first request
									</Button>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each filteredRequests as request (request.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{request.request_number}</Table.Cell>
							<Table.Cell>{formatDate(request.requested_at)}</Table.Cell>
							<Table.Cell>{request.destination ?? '-'}</Table.Cell>
							<Table.Cell class="text-right">{getTotalItems(request)}</Table.Cell>
							<Table.Cell class="text-center">
								{#if getUrgentCount(request) > 0}
									<Badge variant="destructive" class="gap-1">
										<AlertCircleIcon class="size-3" />
										{getUrgentCount(request)}
									</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-center">
								<span class="text-sm">
									{getSuppliedCount(request)} / {request.items?.length ?? 0}
								</span>
							</Table.Cell>
							<Table.Cell>
								<Badge variant={getStatusVariant(request.status)}>
									{request.status.charAt(0).toUpperCase() + request.status.slice(1)}
								</Badge>
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
										{#if canUpdate && isEditable(request)}
											<DropdownMenu.Item onclick={() => openEditDialog(request)}>
												<PencilIcon class="size-4" />
												Edit
											</DropdownMenu.Item>
										{/if}
										{#if canComplete && request.status === 'draft'}
											<DropdownMenu.Item onclick={() => handleComplete(request)}>
												<CheckIcon class="size-4" />
												Complete
											</DropdownMenu.Item>
											<DropdownMenu.Item onclick={() => handleCancel(request)}>
												<XIcon class="size-4" />
												Cancel
											</DropdownMenu.Item>
										{/if}
										{#if canDelete && request.status === 'draft'}
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												class="text-destructive"
												onclick={() => openDeleteDialog(request)}
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
			Showing {filteredRequests.length} of {requests.length} requests
		</div>
	{/if}
</div>

{#if canCreate}
	<div class="fixed right-4 bottom-4 z-50 md:hidden">
		<Button
			class="size-14 rounded-full p-0 shadow-lg"
			onclick={openCreateDialog}
			aria-label="New Request"
		>
			<PlusIcon class="size-6" />
			<span class="sr-only">New Request</span>
		</Button>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Request</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{requestToDelete?.request_number}</strong>? This
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
