<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ReceivingResponse, OutgoingResponse } from '$lib/api/types.js';
	import PackageImportIcon from '@tabler/icons-svelte/icons/package-import';
	import PackageExportIcon from '@tabler/icons-svelte/icons/package-export';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';

	interface Props {
		receivings: ReceivingResponse[];
		outgoings: OutgoingResponse[];
		loading?: boolean;
	}

	let { receivings, outgoings, loading = false }: Props = $props();

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
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
</script>

<Card.Root>
	<Card.Header class="pb-3">
		<Card.Title class="text-base sm:text-lg">Recent Activity</Card.Title>
		<Card.Description class="text-xs sm:text-sm">Latest receivings and outgoings</Card.Description>
	</Card.Header>
	<Card.Content>
		<Tabs.Root value="receivings">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="receivings" class="text-xs sm:text-sm">
					<PackageImportIcon
						class="mr-1.5 size-3.5 text-emerald-600 sm:mr-2 sm:size-4 dark:text-emerald-400"
					/>
					Receivings
				</Tabs.Trigger>
				<Tabs.Trigger value="outgoings" class="text-xs sm:text-sm">
					<PackageExportIcon
						class="mr-1.5 size-3.5 text-blue-600 sm:mr-2 sm:size-4 dark:text-blue-400"
					/>
					Outgoings
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="receivings" class="mt-4">
				{#if loading}
					<div class="space-y-3">
						{#each Array(3) as _, i (i)}
							<div class="flex items-center justify-between">
								<Skeleton class="h-5 w-32" />
								<Skeleton class="h-5 w-20" />
							</div>
						{/each}
					</div>
				{:else if receivings.length === 0}
					<p class="py-4 text-center text-sm text-muted-foreground">No recent receivings</p>
				{:else}
					<div class="space-y-3">
						{#each receivings as receiving (receiving.id)}
							<div class="flex items-center justify-between border-b py-2 last:border-0">
								<div class="flex flex-col gap-1">
									<span class="text-sm font-medium">{receiving.doc_number}</span>
									<span class="text-xs text-muted-foreground">
										{formatDate(receiving.received_at)}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<Badge variant={getStatusVariant(receiving.status)}>
										{receiving.status}
									</Badge>
									<span class="text-sm tabular-nums">{receiving.total_items} items</span>
								</div>
							</div>
						{/each}
					</div>
					<Button variant="ghost" size="sm" class="mt-4 w-full" href="/app/receivings">
						View all receivings
						<ArrowRightIcon class="ml-2 size-4" />
					</Button>
				{/if}
			</Tabs.Content>

			<Tabs.Content value="outgoings" class="mt-4">
				{#if loading}
					<div class="space-y-3">
						{#each Array(3) as _, i (i)}
							<div class="flex items-center justify-between">
								<Skeleton class="h-5 w-32" />
								<Skeleton class="h-5 w-20" />
							</div>
						{/each}
					</div>
				{:else if outgoings.length === 0}
					<p class="py-4 text-center text-sm text-muted-foreground">No recent outgoings</p>
				{:else}
					<div class="space-y-3">
						{#each outgoings as outgoing (outgoing.id)}
							<div class="flex items-center justify-between border-b py-2 last:border-0">
								<div class="flex flex-col gap-1">
									<span class="text-sm font-medium">{outgoing.doc_number}</span>
									<span class="text-xs text-muted-foreground">
										{formatDate(outgoing.issued_at)}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<Badge variant={getStatusVariant(outgoing.status)}>
										{outgoing.status}
									</Badge>
									<span class="text-sm tabular-nums">{outgoing.total_items} items</span>
								</div>
							</div>
						{/each}
					</div>
					<Button variant="ghost" size="sm" class="mt-4 w-full" href="/app/outgoings">
						View all outgoings
						<ArrowRightIcon class="ml-2 size-4" />
					</Button>
				{/if}
			</Tabs.Content>
		</Tabs.Root>
	</Card.Content>
</Card.Root>
