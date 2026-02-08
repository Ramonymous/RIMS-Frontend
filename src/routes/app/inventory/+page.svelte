<script lang="ts">
	import { onMount } from 'svelte';
	import SectionCards from '$lib/components/section-cards.svelte';
	import RecentActivity from '$lib/components/recent-activity.svelte';
	import LowStockAlert from '$lib/components/low-stock-alert.svelte';
	import MovementChart from '$lib/components/movement-chart.svelte';
	import { getDashboardStats, type DashboardData } from '$lib/api/dashboard.js';
	import { getParts } from '$lib/api/parts.js';
	import { toast } from 'svelte-sonner';
	import type { ApiError } from '$lib/api/index.js';

	let dashboardData = $state<DashboardData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadDashboard() {
		loading = true;
		error = null;
		try {
			dashboardData = await getDashboardStats();

			// If dashboard stats indicate alerts but the list is empty (or only contains one status),
			// fetch a small set of parts to populate the panel. Navigation still goes to Movements.
			if (dashboardData) {
				const lowStockCount = dashboardData.stats?.parts?.lowStock ?? 0;
				const outOfStockCount = dashboardData.stats?.parts?.outOfStock ?? 0;
				const existing = dashboardData.lowStockParts ?? [];

				if (lowStockCount + outOfStockCount > 0 && existing.length === 0) {
					const [outRes, lowRes] = await Promise.all([
						outOfStockCount > 0
							? getParts({ stock_status: 'out_of_stock', limit: 5 })
							: Promise.resolve({ items: [], total: 0, page: 1, limit: 5 }),
						lowStockCount > 0
							? getParts({ stock_status: 'low_stock', limit: 5 })
							: Promise.resolve({ items: [], total: 0, page: 1, limit: 5 })
					]);

					const merged = [...outRes.items, ...lowRes.items];
					const unique = Array.from(new Map(merged.map((p) => [p.id, p])).values()).slice(0, 5);
					dashboardData = { ...dashboardData, lowStockParts: unique };
				}
			}
		} catch (e) {
			const apiError = e as ApiError;
			error = apiError.detail || 'Failed to load dashboard data';
			toast.error('Failed to load dashboard', {
				description: error
			});
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadDashboard();
	});
</script>

<svelte:head>
	<title>Inventory Dashboard - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<SectionCards stats={dashboardData?.stats ?? null} {loading} />

	<!-- Movement Chart - Full Width -->
	<div class="px-4 lg:px-6">
		<MovementChart movements={dashboardData?.recentMovements ?? []} {loading} />
	</div>

	<div class="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
		<RecentActivity
			receivings={dashboardData?.recentReceivings ?? []}
			outgoings={dashboardData?.recentOutgoings ?? []}
			{loading}
		/>
		<LowStockAlert
			parts={dashboardData?.lowStockParts ?? []}
			lowStockCount={dashboardData?.stats?.parts?.lowStock ?? 0}
			outOfStockCount={dashboardData?.stats?.parts?.outOfStock ?? 0}
			{loading}
		/>
	</div>
</div>
