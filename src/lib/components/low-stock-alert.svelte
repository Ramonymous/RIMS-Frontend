<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import type { PartResponse } from '$lib/api/types.js';
	import AlertTriangleIcon from '@tabler/icons-svelte/icons/alert-triangle';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';

	interface Props {
		parts: PartResponse[];
		loading?: boolean;
	}

	let { parts, loading = false }: Props = $props();

	function getStockVariant(status: string): 'destructive' | 'secondary' | 'outline' {
		switch (status) {
			case 'out_of_stock':
				return 'destructive';
			case 'low_stock':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	function formatStockStatus(status: string): string {
		return status.replace(/_/g, ' ');
	}
</script>

<Card.Root>
	<Card.Header class="pb-3">
		<Card.Title class="flex items-center gap-2 text-base sm:text-lg">
			<div class="rounded-lg bg-amber-100 p-1.5 dark:bg-amber-900/40">
				<AlertTriangleIcon class="size-4 text-amber-600 dark:text-amber-400" />
			</div>
			Low Stock Alerts
		</Card.Title>
		<Card.Description class="text-xs sm:text-sm">Parts that need attention</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if loading}
			<div class="space-y-3">
				{#each Array(5) as _, i (i)}
					<div class="flex items-center justify-between">
						<Skeleton class="h-5 w-40" />
						<Skeleton class="h-5 w-16" />
					</div>
				{/each}
			</div>
		{:else if parts.length === 0}
			<div class="py-8 text-center">
				<p class="text-sm text-muted-foreground">
					No stock alerts - all parts are well stocked! 🎉
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each parts as part (part.id)}
					<div class="flex items-center justify-between border-b py-2 last:border-0">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<span class="truncate text-sm font-medium">{part.part_name}</span>
							<span class="truncate text-xs text-muted-foreground">
								{part.part_number}
							</span>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<Badge variant={getStockVariant(part.stock_status)}>
								{formatStockStatus(part.stock_status)}
							</Badge>
							<span class="w-12 text-right text-sm font-medium tabular-nums">
								{part.stock}
							</span>
						</div>
					</div>
				{/each}
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="mt-4 w-full"
				href="/dashboard/parts?status=low_stock"
			>
				View all low stock parts
				<ArrowRightIcon class="ml-2 size-4" />
			</Button>
		{/if}
	</Card.Content>
</Card.Root>
