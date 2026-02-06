<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { scaleUtc } from 'd3-scale';
	import { Area, AreaChart, ChartClipPath } from 'layerchart';
	import { curveNatural } from 'd3-shape';
	import { cubicInOut } from 'svelte/easing';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import type { PartMovementResponse } from '$lib/api/types.js';

	interface Props {
		movements: PartMovementResponse[];
		loading?: boolean;
	}

	let { movements, loading = false }: Props = $props();

	let timeRange = $state('30d');

	const selectedLabel = $derived.by(() => {
		switch (timeRange) {
			case '30d':
				return 'Last 30 days';
			case '7d':
				return 'Last 7 days';
			default:
				return 'Last 30 days';
		}
	});

	const chartData = $derived.by(() => {
		if (!movements.length) return [];

		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth();

		// First and last day of current month (immutable)
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);

		// Use plain object instead of Map
		const dailyData: Record<string, { date: Date; incoming: number; outgoing: number }> = {};

		// Generate all dates in current month without mutating Date objects
		const dates: Date[] = [];
		let currentTime = firstDay.getTime();
		const lastTime = lastDay.getTime();

		while (currentTime <= lastTime) {
			dates.push(new Date(currentTime));
			currentTime += 24 * 60 * 60 * 1000; // Add one day in milliseconds
		}

		// Initialize dailyData with all dates
		for (const date of dates) {
			const key = date.toISOString().split('T')[0];
			dailyData[key] = {
				date: new Date(date),
				incoming: 0,
				outgoing: 0
			};
		}

		// Aggregate movements
		for (const movement of movements) {
			const dateKey = new Date(movement.created_at).toISOString().split('T')[0];
			const dayData = dailyData[dateKey];
			if (dayData) {
				if (movement.type === 'in') {
					dayData.incoming += movement.qty;
				} else {
					dayData.outgoing += movement.qty;
				}
			}
		}

		// Convert to sorted array
		return Object.values(dailyData).sort((a, b) => a.date.getTime() - b.date.getTime());
	});

	const filteredData = $derived.by(() => {
		if (!chartData.length) return [];

		const now = new Date();
		if (timeRange === '7d') {
			// Calculate cutoff without mutating Date objects
			const cutoffTimestamp = now.getTime() - 7 * 24 * 60 * 60 * 1000;
			const cutoffDate = new Date(cutoffTimestamp);
			cutoffDate.setHours(0, 0, 0, 0);

			const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
			return chartData.filter((item) => item.date >= cutoffDate && item.date >= firstDay);
		} else {
			return chartData;
		}
	});

	const totalIncoming = $derived(filteredData.reduce((sum, d) => sum + d.incoming, 0));
	const totalOutgoing = $derived(filteredData.reduce((sum, d) => sum + d.outgoing, 0));

	const chartConfig = {
		incoming: { label: 'Incoming', color: 'hsl(152, 60%, 45%)' },
		outgoing: { label: 'Outgoing', color: 'hsl(220, 70%, 55%)' }
	} satisfies Chart.ChartConfig;
</script>

<Card.Root>
	<Card.Header
		class="flex flex-col gap-2 space-y-0 border-b py-4 sm:flex-row sm:items-center sm:py-5"
	>
		<div class="grid flex-1 gap-1 text-center sm:text-start">
			<Card.Title class="text-base sm:text-lg">Stock Movement</Card.Title>
			<Card.Description class="text-xs sm:text-sm">
				{#if loading}
					Loading...
				{:else}
					<span class="font-medium text-emerald-600 dark:text-emerald-400">+{totalIncoming}</span>
					in ·
					<span class="font-medium text-blue-600 dark:text-blue-400">-{totalOutgoing}</span> out
				{/if}
			</Card.Description>
		</div>
		<Select.Root type="single" bind:value={timeRange}>
			<Select.Trigger class="w-full rounded-lg sm:w-36" aria-label="Select time range">
				{selectedLabel}
			</Select.Trigger>
			<Select.Content class="rounded-xl">
				<Select.Item value="30d" class="rounded-lg">Last 30 days</Select.Item>
				<Select.Item value="7d" class="rounded-lg">Last 7 days</Select.Item>
			</Select.Content>
		</Select.Root>
	</Card.Header>
	<Card.Content class="p-2 sm:p-4">
		{#if loading}
			<div class="flex h-[180px] items-center justify-center sm:h-[260px]">
				<Skeleton class="h-full w-full rounded-md" />
			</div>
		{:else if filteredData.length === 0}
			<div
				class="flex h-[180px] items-center justify-center text-sm text-muted-foreground sm:h-[260px]"
			>
				No movement data available for this period
			</div>
		{:else}
			<Chart.ChartContainer
				config={chartConfig}
				class="-ml-2 aspect-auto h-[180px] w-full sm:-ml-3 sm:h-[260px]"
			>
				<AreaChart
					legend
					data={filteredData}
					x="date"
					xScale={scaleUtc()}
					series={[
						{
							key: 'outgoing',
							label: 'Outgoing',
							color: chartConfig.outgoing.color
						},
						{
							key: 'incoming',
							label: 'Incoming',
							color: chartConfig.incoming.color
						}
					]}
					seriesLayout="stack"
					props={{
						area: {
							curve: curveNatural,
							'fill-opacity': 0.4,
							line: { class: 'stroke-2' },
							motion: 'tween'
						},
						xAxis: {
							ticks: timeRange === '7d' ? 7 : undefined,
							format: (v: Date) => {
								return v.toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric'
								});
							}
						},
						yAxis: { format: () => '' }
					}}
				>
					{#snippet marks({ series, getAreaProps })}
						<defs>
							<linearGradient id="fillIncoming" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stop-color="var(--color-incoming)" stop-opacity={0.9} />
								<stop offset="95%" stop-color="var(--color-incoming)" stop-opacity={0.1} />
							</linearGradient>
							<linearGradient id="fillOutgoing" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stop-color="var(--color-outgoing)" stop-opacity={0.7} />
								<stop offset="95%" stop-color="var(--color-outgoing)" stop-opacity={0.1} />
							</linearGradient>
						</defs>
						<ChartClipPath
							initialWidth={0}
							motion={{
								width: { type: 'tween', duration: 1000, easing: cubicInOut }
							}}
						>
							{#each series as s, i (s.key)}
								<Area
									{...getAreaProps(s, i)}
									fill={s.key === 'incoming' ? 'url(#fillIncoming)' : 'url(#fillOutgoing)'}
								/>
							{/each}
						</ChartClipPath>
					{/snippet}
					{#snippet tooltip()}
						<Chart.Tooltip
							labelFormatter={(v: Date) => {
								return v.toLocaleDateString('en-US', {
									weekday: 'short',
									month: 'short',
									day: 'numeric'
								});
							}}
							indicator="line"
						/>
					{/snippet}
				</AreaChart>
			</Chart.ChartContainer>
		{/if}
	</Card.Content>
</Card.Root>
