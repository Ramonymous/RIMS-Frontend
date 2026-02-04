<script lang="ts">
	import BoxIcon from '@tabler/icons-svelte/icons/box';
	import PackageImportIcon from '@tabler/icons-svelte/icons/package-import';
	import PackageExportIcon from '@tabler/icons-svelte/icons/package-export';
	import AlertTriangleIcon from '@tabler/icons-svelte/icons/alert-triangle';
	import TrendingDownIcon from '@tabler/icons-svelte/icons/trending-down';
	import TrendingUpIcon from '@tabler/icons-svelte/icons/trending-up';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import type { DashboardStats } from '$lib/api/dashboard.js';

	interface Props {
		stats: DashboardStats | null;
		loading?: boolean;
	}

	let { stats, loading = false }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
	<!-- Total Parts -->
	<Card.Root class="relative overflow-hidden">
		<div class="absolute top-0 right-0 -mt-4 -mr-4 size-28 rounded-full bg-slate-500/5"></div>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Description class="text-sm font-medium">Total Parts</Card.Description>
			<div class="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
				<BoxIcon class="size-5 text-slate-600 dark:text-slate-400" />
			</div>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<Skeleton class="h-8 w-20" />
			{:else}
				<div class="text-3xl font-bold tracking-tight tabular-nums">{stats?.parts.total ?? 0}</div>
			{/if}
			<div class="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
				<span>{stats?.parts.active ?? 0} active</span>
				<span>·</span>
				<span>{stats?.parts.inStock ?? 0} in stock</span>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Receivings -->
	<Card.Root class="relative overflow-hidden">
		<div class="absolute top-0 right-0 -mt-4 -mr-4 size-28 rounded-full bg-emerald-500/5"></div>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Description class="text-sm font-medium">Receivings</Card.Description>
			<div class="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/40">
				<PackageImportIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
			</div>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<Skeleton class="h-8 w-20" />
			{:else}
				<div class="text-3xl font-bold tracking-tight tabular-nums">
					{stats?.receivings.total ?? 0}
				</div>
			{/if}
			<div class="mt-1.5 flex items-center gap-2 text-xs">
				{#if (stats?.receivings.pendingGR ?? 0) > 0}
					<Badge
						variant="outline"
						class="h-5 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
					>
						{stats?.receivings.pendingGR} pending GR
					</Badge>
				{:else}
					<span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
						<TrendingUpIcon class="size-3" />
						All processed
					</span>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Outgoings -->
	<Card.Root class="relative overflow-hidden">
		<div class="absolute top-0 right-0 -mt-4 -mr-4 size-28 rounded-full bg-blue-500/5"></div>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Description class="text-sm font-medium">Outgoings</Card.Description>
			<div class="rounded-xl bg-blue-100 p-2.5 dark:bg-blue-900/40">
				<PackageExportIcon class="size-5 text-blue-600 dark:text-blue-400" />
			</div>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<Skeleton class="h-8 w-20" />
			{:else}
				<div class="text-3xl font-bold tracking-tight tabular-nums">
					{stats?.outgoings.total ?? 0}
				</div>
			{/if}
			<div class="mt-1.5 flex items-center gap-2 text-xs">
				{#if (stats?.outgoings.pendingGI ?? 0) > 0}
					<Badge
						variant="outline"
						class="h-5 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
					>
						{stats?.outgoings.pendingGI} pending GI
					</Badge>
				{:else}
					<span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
						<TrendingUpIcon class="size-3" />
						All processed
					</span>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Alerts -->
	<Card.Root class="relative overflow-hidden">
		<div class="absolute top-0 right-0 -mt-4 -mr-4 size-28 rounded-full bg-rose-500/5"></div>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Description class="text-sm font-medium">Stock Alerts</Card.Description>
			<div class="rounded-xl bg-rose-100 p-2.5 dark:bg-rose-900/40">
				<AlertTriangleIcon class="size-5 text-rose-600 dark:text-rose-400" />
			</div>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<Skeleton class="h-8 w-20" />
			{:else}
				<div class="text-3xl font-bold tracking-tight tabular-nums">
					{(stats?.parts.lowStock ?? 0) + (stats?.parts.outOfStock ?? 0)}
				</div>
			{/if}
			<div class="mt-1.5 flex items-center gap-2 text-xs">
				{#if (stats?.parts.outOfStock ?? 0) > 0}
					<Badge variant="destructive" class="h-5">
						<TrendingDownIcon class="mr-1 size-3" />
						{stats?.parts.outOfStock} out of stock
					</Badge>
				{:else}
					<span class="text-muted-foreground">
						{stats?.parts.lowStock ?? 0} low stock items
					</span>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>
