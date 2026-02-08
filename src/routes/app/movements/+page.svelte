<script lang="ts">
	import { getMovementsByPart } from '$lib/api/movements.js';
	import { getParts } from '$lib/api/parts.js';
	import { getReceivings } from '$lib/api/receivings.js';
	import { getOutgoings } from '$lib/api/outgoings.js';
	import type {
		PartMovementResponse,
		PartResponse,
		ReceivingResponse,
		OutgoingResponse
	} from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type * as XLSXNS from 'xlsx';
	import {
		formatDateLocal,
		formatDate as formatDateUtil,
		formatDateTime,
		getFirstOfMonth,
		getLastOfMonth
	} from '$lib/utils.js';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import PartSelect from '$lib/components/part-select.svelte';

	// Icons
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import RefreshIcon from '@tabler/icons-svelte/icons/refresh';
	import ArrowUpIcon from '@tabler/icons-svelte/icons/arrow-up';
	import ArrowDownIcon from '@tabler/icons-svelte/icons/arrow-down';
	import DownloadIcon from '@tabler/icons-svelte/icons/download';
	import HistoryIcon from '@tabler/icons-svelte/icons/history';
	import PackageIcon from '@tabler/icons-svelte/icons/package';

	// State
	let parts = $state<PartResponse[]>([]);
	let movements = $state<PartMovementResponse[]>([]);
	let receivings = $state<ReceivingResponse[]>([]);
	let outgoings = $state<OutgoingResponse[]>([]);
	let loading = $state(true);
	let loadingMovements = $state(false);

	let xlsxModule = $state<typeof XLSXNS | null>(null);

	async function getXlsx() {
		if (xlsxModule) return xlsxModule;
		xlsxModule = await import('xlsx');
		return xlsxModule;
	}

	async function mapWithConcurrency<T, R>(
		items: readonly T[],
		limit: number,
		mapper: (item: T) => Promise<R>
	) {
		const results: R[] = [];
		let index = 0;

		async function worker() {
			while (index < items.length) {
				const i = index;
				index++;
				results[i] = await mapper(items[i]);
			}
		}

		const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
		await Promise.all(workers);
		return results;
	}

	// Stock tab state
	let activeTab = $state<'stock' | 'movements'>('stock');
	let stockSearchQuery = $state('');
	let stockStatusFilter = $state<string>('all');

	// Movements tab state
	let selectedPartId = $state<string | undefined>(undefined);
	let typeFilter = $state<string>('all');

	// Date filters - default to current month (Asia/Jakarta timezone)
	let startDate = $state(formatDateLocal(getFirstOfMonth()));
	let endDate = $state(formatDateLocal(getLastOfMonth()));

	// Filtered parts for stock tab
	const filteredParts = $derived(
		parts.filter((p) => {
			const matchesSearch =
				stockSearchQuery === '' ||
				p.part_number.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
				p.part_name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
				(p.customer_code?.toLowerCase().includes(stockSearchQuery.toLowerCase()) ?? false);

			const matchesStatus =
				stockStatusFilter === 'all' ||
				p.stock_status === stockStatusFilter ||
				(stockStatusFilter === 'active' && p.is_active) ||
				(stockStatusFilter === 'inactive' && !p.is_active);

			return matchesSearch && matchesStatus;
		})
	);

	// Filtered movements
	const filteredMovements = $derived(
		movements.filter((movement) => {
			const matchesType = typeFilter === 'all' || movement.type === typeFilter;

			// Part filter
			const matchesPart = !selectedPartId || movement.part_id === selectedPartId;

			// Date filter
			const movementDate = new Date(movement.created_at).toISOString().split('T')[0];
			const matchesDateRange =
				(!startDate || movementDate >= startDate) && (!endDate || movementDate <= endDate);

			return matchesType && matchesPart && matchesDateRange;
		})
	);

	// Stats for movements
	const totalIn = $derived(
		filteredMovements.filter((m) => m.type === 'in').reduce((sum, m) => sum + m.qty, 0)
	);
	const totalOut = $derived(
		filteredMovements.filter((m) => m.type === 'out').reduce((sum, m) => sum + m.qty, 0)
	);

	async function loadInitialData() {
		loading = true;
		try {
			const [partsRes, receivingsRes, outgoingsRes] = await Promise.all([
				getParts(),
				getReceivings(),
				getOutgoings()
			]);
			parts = partsRes.items;
			receivings = receivingsRes.items;
			outgoings = outgoingsRes.items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load data', { description: error.detail });
		} finally {
			loading = false;
		}
	}

	async function loadAllMovements() {
		loadingMovements = true;
		try {
			// Load movements for all parts (bounded concurrency to avoid hammering backend)
			const perPart = await mapWithConcurrency(parts, 5, async (part) => {
				const partMovementsRes = await getMovementsByPart(part.id, { limit: 100 });
				return partMovementsRes.items;
			});

			const allMovements: PartMovementResponse[] = perPart.flat();
			// Sort by created_at descending
			movements = allMovements.sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load movements', { description: error.detail });
			movements = [];
		} finally {
			loadingMovements = false;
		}
	}

	function getPartInfo(partId: string): PartResponse | undefined {
		return parts.find((p) => p.id === partId);
	}

	function getDocNumber(movement: PartMovementResponse): string {
		if (movement.reference_type === 'Receivings') {
			const receiving = receivings.find((r) => r.id === movement.reference_id);
			return receiving?.doc_number ?? movement.reference_id.slice(0, 8);
		} else {
			const outgoing = outgoings.find((o) => o.id === movement.reference_id);
			return outgoing?.doc_number ?? movement.reference_id.slice(0, 8);
		}
	}

	// Use formatDateTime for full date+time and formatDateUtil for date only (from $lib/utils)

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

	function formatStockStatus(status: string): string {
		return status
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	async function downloadStockReport() {
		const XLSX = await getXlsx();
		const data = filteredParts.map((part) => ({
			'Part Number': part.part_number,
			'Part Name': part.part_name,
			'Customer Code': part.customer_code ?? '',
			'Supplier Code': part.supplier_code ?? '',
			Model: part.model ?? '',
			Variant: part.variant ?? '',
			'Standard Packing': part.standard_packing,
			'Current Stock': part.stock,
			'Stock Status': formatStockStatus(part.stock_status),
			Address: part.address ?? '',
			Active: part.is_active ? 'Yes' : 'No'
		}));

		const ws = XLSX.utils.json_to_sheet(data);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');

		// Auto-size columns
		const colWidths = Object.keys(data[0] || {}).map((key) => ({
			wch:
				Math.max(
					key.length,
					...data.map((row) => String((row as Record<string, unknown>)[key] ?? '').length)
				) + 2
		}));
		ws['!cols'] = colWidths;

		const filename = `Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
		XLSX.writeFile(wb, filename);
		toast.success('Stock report downloaded', { description: filename });
	}

	async function downloadMovementsReport() {
		const XLSX = await getXlsx();
		const data = filteredMovements.map((movement) => {
			const part = getPartInfo(movement.part_id);
			return {
				Date: formatDateUtil(movement.created_at),
				'Part Number': part?.part_number ?? '',
				'Part Name': part?.part_name ?? '',
				Type: movement.type === 'in' ? 'Incoming' : 'Outgoing',
				Reference: `${movement.reference_type === 'Receivings' ? 'RCV' : 'OUT'} - ${getDocNumber(movement)}`,
				'Stock Before': movement.stock_before,
				Quantity: movement.type === 'in' ? `+${movement.qty}` : `-${movement.qty}`,
				'Stock After': movement.stock_after
			};
		});

		const ws = XLSX.utils.json_to_sheet(data);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Movements Report');

		// Auto-size columns
		const colWidths = Object.keys(data[0] || {}).map((key) => ({
			wch:
				Math.max(
					key.length,
					...data.map((row) => String((row as Record<string, unknown>)[key] ?? '').length)
				) + 2
		}));
		ws['!cols'] = colWidths;

		const filename = `Movements_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
		XLSX.writeFile(wb, filename);
		toast.success('Movements report downloaded', { description: filename });
	}

	onMount(() => {
		const tabParam = $page.url.searchParams.get('tab');
		activeTab = tabParam === 'movements' ? 'movements' : 'stock';
		const stockStatusParam = $page.url.searchParams.get('stock_status');
		if (
			stockStatusParam &&
			['all', 'in_stock', 'low_stock', 'out_of_stock', 'active', 'inactive'].includes(
				stockStatusParam
			)
		) {
			stockStatusFilter = stockStatusParam;
		}

		loadInitialData().then(() => {
			if (parts.length > 0) {
				loadAllMovements();
			}
		});
	});
</script>

<svelte:head>
	<title>Movements - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 md:p-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">Stock & Movements</h1>
			<p class="text-muted-foreground">View stock levels and movement history</p>
		</div>
		<Button
			variant="outline"
			onclick={() => {
				loadInitialData().then(() => loadAllMovements());
			}}
			disabled={loading}
		>
			<RefreshIcon class="size-4 {loading ? 'animate-spin' : ''}" />
			Refresh
		</Button>
	</div>

	<Tabs.Root bind:value={activeTab} class="w-full">
		<Tabs.List class="grid w-full max-w-md grid-cols-2">
			<Tabs.Trigger value="stock">
				<PackageIcon class="mr-2 size-4" />
				Stock
			</Tabs.Trigger>
			<Tabs.Trigger value="movements">
				<HistoryIcon class="mr-2 size-4" />
				Movements
			</Tabs.Trigger>
		</Tabs.List>

		<!-- Stock Tab -->
		<Tabs.Content value="stock" class="mt-4 space-y-4">
			<!-- Filters -->
			<div class="rounded-xl border bg-card p-4">
				<div class="grid gap-3 sm:flex sm:flex-row sm:items-center">
					<div class="relative flex-1">
						<SearchIcon
							class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							placeholder="Search by part number, name, customer code..."
							bind:value={stockSearchQuery}
							class="pl-10"
						/>
					</div>
					<Select.Root type="single" bind:value={stockStatusFilter}>
						<Select.Trigger class="w-full sm:w-44">
							{stockStatusFilter === 'all' ? 'All Status' : formatStockStatus(stockStatusFilter)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">All Status</Select.Item>
							<Select.Item value="in_stock">In Stock</Select.Item>
							<Select.Item value="low_stock">Low Stock</Select.Item>
							<Select.Item value="out_of_stock">Out of Stock</Select.Item>
							<Select.Item value="active">Active</Select.Item>
							<Select.Item value="inactive">Inactive</Select.Item>
						</Select.Content>
					</Select.Root>
					<Button
						variant="outline"
						onclick={downloadStockReport}
						disabled={loading || filteredParts.length === 0}
						class="justify-self-start sm:justify-self-auto"
					>
						<DownloadIcon class="size-4" />
						Export Excel
					</Button>
				</div>
			</div>

			<!-- Stock Table -->
			<div class="hidden rounded-md border bg-card md:block">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Part Number</Table.Head>
							<Table.Head>Part Name</Table.Head>
							<Table.Head>Customer Code</Table.Head>
							<Table.Head>Model</Table.Head>
							<Table.Head class="text-right">Stock</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Address</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if loading}
							{#each Array(10) as _, i (i)}
								<Table.Row>
									<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
									<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
									<Table.Cell><Skeleton class="h-6 w-20" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-16" /></Table.Cell>
								</Table.Row>
							{/each}
						{:else if filteredParts.length === 0}
							<Table.Row>
								<Table.Cell colspan={7} class="h-24 text-center">
									<div class="flex flex-col items-center gap-2 text-muted-foreground">
										<PackageIcon class="size-8" />
										<p>No parts found</p>
									</div>
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredParts as part (part.id)}
								<Table.Row class={!part.is_active ? 'opacity-50' : ''}>
									<Table.Cell class="font-mono font-medium">{part.part_number}</Table.Cell>
									<Table.Cell>{part.part_name}</Table.Cell>
									<Table.Cell class="text-muted-foreground">{part.customer_code ?? '-'}</Table.Cell>
									<Table.Cell class="text-muted-foreground">{part.model ?? '-'}</Table.Cell>
									<Table.Cell class="text-right font-mono font-semibold">{part.stock}</Table.Cell>
									<Table.Cell>
										<Badge variant={getStockStatusVariant(part.stock_status)}>
											{formatStockStatus(part.stock_status)}
										</Badge>
									</Table.Cell>
									<Table.Cell class="text-muted-foreground">{part.address ?? '-'}</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>

			<!-- Stock Cards (Mobile) -->
			<div class="space-y-2 md:hidden">
				{#if loading}
					{#each Array(8) as _, i (i)}
						<div class="rounded-xl border bg-card p-4">
							<Skeleton class="h-4 w-40" />
							<div class="mt-2"><Skeleton class="h-4 w-56" /></div>
							<div class="mt-3 grid grid-cols-2 gap-2">
								<Skeleton class="h-6 w-full" />
								<Skeleton class="h-6 w-full" />
							</div>
						</div>
					{/each}
				{:else if filteredParts.length === 0}
					<div class="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
						No parts found
					</div>
				{:else}
					{#each filteredParts as part (part.id)}
						<div class="rounded-xl border bg-card p-4 {!part.is_active ? 'opacity-60' : ''}">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="truncate font-mono text-sm font-semibold">{part.part_number}</div>
									<div class="truncate text-sm text-muted-foreground">{part.part_name ?? '-'}</div>
								</div>
								<div class="text-right">
									<div class="font-mono text-xl font-bold">{part.stock}</div>
									<div class="text-xs text-muted-foreground">Stock</div>
								</div>
							</div>
							<div class="mt-3 flex flex-wrap items-center gap-2">
								<Badge variant={getStockStatusVariant(part.stock_status)}>
									{formatStockStatus(part.stock_status)}
								</Badge>
								{#if part.address}
									<Badge variant="outline">{part.address}</Badge>
								{/if}
								{#if part.customer_code}
									<Badge variant="secondary">{part.customer_code}</Badge>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Stats -->
			{#if !loading}
				<div class="text-sm text-muted-foreground">
					Showing {filteredParts.length} of {parts.length} parts
				</div>
			{/if}
		</Tabs.Content>

		<!-- Movements Tab -->
		<Tabs.Content value="movements" class="mt-4 space-y-4">
			<!-- Filters -->
			<div class="rounded-xl border bg-card p-4">
				<div class="grid gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
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
					<PartSelect
						{parts}
						bind:value={selectedPartId}
						placeholder="All Parts"
						class="w-full sm:w-64"
					/>
					{#if selectedPartId}
						<Button variant="ghost" size="sm" onclick={() => (selectedPartId = undefined)}>
							Clear
						</Button>
					{/if}
					<Select.Root type="single" bind:value={typeFilter}>
						<Select.Trigger class="w-full sm:w-36">
							{typeFilter === 'all' ? 'All Types' : typeFilter === 'in' ? 'Incoming' : 'Outgoing'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">All Types</Select.Item>
							<Select.Item value="in">Incoming</Select.Item>
							<Select.Item value="out">Outgoing</Select.Item>
						</Select.Content>
					</Select.Root>
					<Button
						variant="outline"
						onclick={downloadMovementsReport}
						disabled={loadingMovements || filteredMovements.length === 0}
						class="justify-self-start sm:justify-self-auto"
					>
						<DownloadIcon class="size-4" />
						Export Excel
					</Button>
				</div>
			</div>

			<!-- Stats Cards -->
			<div class="grid grid-cols-3 gap-3 sm:gap-4">
				<div class="rounded-lg border p-4 text-center">
					<div class="text-2xl font-bold text-green-600">+{totalIn}</div>
					<div class="text-sm text-muted-foreground">Total In</div>
				</div>
				<div class="rounded-lg border p-4 text-center">
					<div class="text-2xl font-bold text-red-600">-{totalOut}</div>
					<div class="text-sm text-muted-foreground">Total Out</div>
				</div>
				<div class="rounded-lg border p-4 text-center">
					<div class="text-2xl font-bold">{filteredMovements.length}</div>
					<div class="text-sm text-muted-foreground">Transactions</div>
				</div>
			</div>

			<!-- Movements Table -->
			<div class="hidden rounded-md border bg-card md:block">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-12">Type</Table.Head>
							<Table.Head>Date</Table.Head>
							<Table.Head>Part</Table.Head>
							<Table.Head>Reference</Table.Head>
							<Table.Head class="text-right">Before</Table.Head>
							<Table.Head class="text-right">Qty</Table.Head>
							<Table.Head class="text-right">After</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if loadingMovements}
							{#each Array(10) as _, i (i)}
								<Table.Row>
									<Table.Cell><Skeleton class="h-6 w-6" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
									<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
									<Table.Cell><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
									<Table.Cell><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
									<Table.Cell><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
								</Table.Row>
							{/each}
						{:else if filteredMovements.length === 0}
							<Table.Row>
								<Table.Cell colspan={7} class="h-24 text-center">
									<div class="flex flex-col items-center gap-2 text-muted-foreground">
										<HistoryIcon class="size-8" />
										<p>No movements found</p>
									</div>
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredMovements as movement (movement.id)}
								{@const part = getPartInfo(movement.part_id)}
								<Table.Row>
									<Table.Cell>
										{#if movement.type === 'in'}
											<div class="rounded bg-green-100 p-1.5 text-green-600">
												<ArrowDownIcon class="size-4" />
											</div>
										{:else}
											<div class="rounded bg-red-100 p-1.5 text-red-600">
												<ArrowUpIcon class="size-4" />
											</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-sm">
										{formatDateTime(movement.created_at)}
									</Table.Cell>
									<Table.Cell>
										<div class="font-mono text-xs">{part?.part_number ?? '-'}</div>
										<div class="max-w-40 truncate text-xs text-muted-foreground">
											{part?.part_name ?? '-'}
										</div>
									</Table.Cell>
									<Table.Cell>
										<div class="flex items-center gap-2">
											<Badge
												variant={movement.reference_type === 'Receivings' ? 'default' : 'secondary'}
											>
												{movement.reference_type === 'Receivings' ? 'RCV' : 'OUT'}
											</Badge>
											<span class="font-mono text-sm">{getDocNumber(movement)}</span>
										</div>
									</Table.Cell>
									<Table.Cell class="text-right font-mono">
										{movement.stock_before}
									</Table.Cell>
									<Table.Cell
										class="text-right font-mono {movement.type === 'in'
											? 'text-green-600'
											: 'text-red-600'}"
									>
										{movement.type === 'in' ? '+' : '-'}{movement.qty}
									</Table.Cell>
									<Table.Cell class="text-right font-mono font-medium">
										{movement.stock_after}
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>

			<!-- Movements Cards (Mobile) -->
			<div class="space-y-2 md:hidden">
				{#if loadingMovements}
					{#each Array(8) as _, i (i)}
						<div class="rounded-xl border bg-card p-4">
							<div class="flex items-center justify-between">
								<Skeleton class="h-6 w-20" />
								<Skeleton class="h-4 w-24" />
							</div>
							<div class="mt-2"><Skeleton class="h-4 w-56" /></div>
							<div class="mt-3 grid grid-cols-3 gap-2">
								<Skeleton class="h-6 w-full" />
								<Skeleton class="h-6 w-full" />
								<Skeleton class="h-6 w-full" />
							</div>
						</div>
					{/each}
				{:else if filteredMovements.length === 0}
					<div class="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
						No movements found
					</div>
				{:else}
					{#each filteredMovements as movement (movement.id)}
						{@const part = getPartInfo(movement.part_id)}
						<div class="rounded-xl border bg-card p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										{#if movement.type === 'in'}
											<Badge variant="default">IN</Badge>
										{:else}
											<Badge variant="secondary">OUT</Badge>
										{/if}
										<span class="text-xs text-muted-foreground"
											>{formatDateTime(movement.created_at)}</span
										>
									</div>
									<div class="mt-2 truncate font-mono text-sm font-semibold">
										{part?.part_number ?? '-'}
									</div>
									<div class="truncate text-sm text-muted-foreground">{part?.part_name ?? '-'}</div>
								</div>
								<div class="text-right">
									<div class="text-xs text-muted-foreground">Qty</div>
									<div
										class="font-mono text-xl font-bold {movement.type === 'in'
											? 'text-green-600'
											: 'text-red-600'}"
									>
										{movement.type === 'in' ? '+' : '-'}{movement.qty}
									</div>
								</div>
							</div>
							<div class="mt-3 flex items-center gap-2">
								<Badge variant={movement.reference_type === 'Receivings' ? 'default' : 'secondary'}>
									{movement.reference_type === 'Receivings' ? 'RCV' : 'OUT'}
								</Badge>
								<span class="font-mono text-sm">{getDocNumber(movement)}</span>
							</div>
							<div class="mt-3 grid grid-cols-2 gap-2 text-center">
								<div class="rounded-lg border bg-muted/30 p-2">
									<div class="text-xs text-muted-foreground">Before</div>
									<div class="font-mono text-sm font-semibold">{movement.stock_before}</div>
								</div>
								<div class="rounded-lg border bg-muted/30 p-2">
									<div class="text-xs text-muted-foreground">After</div>
									<div class="font-mono text-sm font-semibold">{movement.stock_after}</div>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Stats -->
			{#if !loadingMovements}
				<div class="text-sm text-muted-foreground">
					Showing {filteredMovements.length} of {movements.length} movements
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
