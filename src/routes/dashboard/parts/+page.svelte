<script lang="ts">
	import { getParts, deletePart, createPart } from '$lib/api/parts.js';
	import type { PartResponse, PartCreate } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import * as XLSX from 'xlsx';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import PartFormDialog from './part-form-dialog.svelte';
	import PartImportDialog from './part-import-dialog.svelte';

	// Icons
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import RefreshIcon from '@tabler/icons-svelte/icons/refresh';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import FileSpreadsheetIcon from '@tabler/icons-svelte/icons/file-spreadsheet';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	// State
	let parts = $state<PartResponse[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');

	// Dialog states
	let formDialogOpen = $state(false);
	let importDialogOpen = $state(false);
	let selectedPart = $state<PartResponse | null>(null);
	let deleteDialogOpen = $state(false);
	let partToDelete = $state<PartResponse | null>(null);
	let deleting = $state(false);

	// Permissions
	const canCreate = $derived(auth.hasPermission('parts.create'));
	const canUpdate = $derived(auth.hasPermission('parts.update'));
	const canDelete = $derived(auth.hasPermission('parts.delete'));

	// Filtered parts
	const filteredParts = $derived(
		parts.filter((part) => {
			const matchesSearch =
				searchQuery === '' ||
				part.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
				part.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(part.customer_code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
				(part.supplier_code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

			const matchesStatus =
				statusFilter === 'all' ||
				(statusFilter === 'active' && part.is_active) ||
				(statusFilter === 'inactive' && !part.is_active) ||
				statusFilter === part.stock_status;

			return matchesSearch && matchesStatus;
		})
	);

	async function loadParts() {
		loading = true;
		try {
			const response = await getParts();
			parts = response.items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load parts', { description: error.detail });
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		selectedPart = null;
		formDialogOpen = true;
	}

	function openEditDialog(part: PartResponse) {
		selectedPart = part;
		formDialogOpen = true;
	}

	function openDeleteDialog(part: PartResponse) {
		partToDelete = part;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!partToDelete) return;

		deleting = true;
		try {
			await deletePart(partToDelete.id);
			toast.success('Part deleted', {
				description: `${partToDelete.part_name} has been deleted.`
			});
			deleteDialogOpen = false;
			partToDelete = null;
			await loadParts();
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to delete part', { description: error.detail });
		} finally {
			deleting = false;
		}
	}

	function handleFormSuccess() {
		formDialogOpen = false;
		loadParts();
	}

	function handleImportSuccess() {
		importDialogOpen = false;
		loadParts();
	}

	function getStockStatusVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'in_stock':
				return 'default';
			case 'low_stock':
				return 'secondary';
			case 'out_of_stock':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getStockStatusLabel(status: string): string {
		switch (status) {
			case 'in_stock':
				return 'In Stock';
			case 'low_stock':
				return 'Low Stock';
			case 'out_of_stock':
				return 'Out of Stock';
			default:
				return status;
		}
	}

	onMount(() => {
		loadParts();
	});
</script>

<svelte:head>
	<title>Parts - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">Parts Management</h1>
			<p class="text-muted-foreground">Manage your parts inventory</p>
		</div>
		<div class="flex gap-2">
			{#if canCreate}
				<Button variant="outline" onclick={() => (importDialogOpen = true)}>
					<FileSpreadsheetIcon class="size-4" />
					Import Excel
				</Button>
				<Button onclick={openCreateDialog}>
					<PlusIcon class="size-4" />
					Add Part
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				placeholder="Search by part number, name, or code..."
				bind:value={searchQuery}
				class="pl-10"
			/>
		</div>
		<Select.Root type="single" bind:value={statusFilter}>
			<Select.Trigger class="w-full sm:w-48">
				{statusFilter === 'all'
					? 'All Status'
					: statusFilter === 'active'
						? 'Active'
						: statusFilter === 'inactive'
							? 'Inactive'
							: getStockStatusLabel(statusFilter)}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All Status</Select.Item>
				<Select.Item value="active">Active</Select.Item>
				<Select.Item value="inactive">Inactive</Select.Item>
				<Select.Item value="in_stock">In Stock</Select.Item>
				<Select.Item value="low_stock">Low Stock</Select.Item>
				<Select.Item value="out_of_stock">Out of Stock</Select.Item>
			</Select.Content>
		</Select.Root>
		<Button variant="outline" size="icon" onclick={loadParts} disabled={loading}>
			<RefreshIcon class="size-4 {loading ? 'animate-spin' : ''}" />
		</Button>
	</div>

	<!-- Table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Part Number</Table.Head>
					<Table.Head>Part Name</Table.Head>
					<Table.Head class="hidden md:table-cell">Customer Code</Table.Head>
					<Table.Head class="hidden lg:table-cell">Model</Table.Head>
					<Table.Head class="text-right">Stock</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if loading}
					{#each Array(5) as _}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell class="hidden md:table-cell"><Skeleton class="h-4 w-20" /></Table.Cell>
							<Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-16" /></Table.Cell>
							<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
							<Table.Cell><Skeleton class="h-6 w-20" /></Table.Cell>
							<Table.Cell class="text-right"><Skeleton class="ml-auto h-8 w-20" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if filteredParts.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="h-24 text-center">
							<div class="flex flex-col items-center gap-2 text-muted-foreground">
								<p>No parts found</p>
								{#if canCreate}
									<Button variant="outline" size="sm" onclick={openCreateDialog}>
										<PlusIcon class="size-4" />
										Add your first part
									</Button>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each filteredParts as part (part.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{part.part_number}</Table.Cell>
							<Table.Cell>{part.part_name}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{part.customer_code ?? '-'}</Table.Cell>
							<Table.Cell class="hidden lg:table-cell">{part.model ?? '-'}</Table.Cell>
							<Table.Cell class="text-right">{part.stock}</Table.Cell>
							<Table.Cell>
								<div class="flex gap-1">
									<Badge variant={getStockStatusVariant(part.stock_status)}>
										{getStockStatusLabel(part.stock_status)}
									</Badge>
									{#if !part.is_active}
										<Badge variant="outline">Inactive</Badge>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1">
									{#if canUpdate}
										<Button variant="ghost" size="icon" onclick={() => openEditDialog(part)}>
											<PencilIcon class="size-4" />
										</Button>
									{/if}
									{#if canDelete}
										<Button variant="ghost" size="icon" onclick={() => openDeleteDialog(part)}>
											<TrashIcon class="size-4 text-destructive" />
										</Button>
									{/if}
								</div>
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
			Showing {filteredParts.length} of {parts.length} parts
		</div>
	{/if}
</div>

<!-- Part Form Dialog -->
<PartFormDialog bind:open={formDialogOpen} part={selectedPart} onSuccess={handleFormSuccess} />

<!-- Import Dialog -->
<PartImportDialog bind:open={importDialogOpen} onSuccess={handleImportSuccess} />

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Part</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{partToDelete?.part_name}</strong>? This action
				cannot be undone if the part has no transactions.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={confirmDelete}
				disabled={deleting}
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
			>
				{#if deleting}
					<LoaderCircleIcon class="size-4 animate-spin" />
					Deleting...
				{:else}
					Delete
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
