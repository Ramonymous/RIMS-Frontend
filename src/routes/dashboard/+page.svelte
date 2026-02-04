<script lang="ts">
	import { onMount } from 'svelte';
	import SectionCards from '$lib/components/section-cards.svelte';
	import RecentActivity from '$lib/components/recent-activity.svelte';
	import LowStockAlert from '$lib/components/low-stock-alert.svelte';
	import MovementChart from '$lib/components/movement-chart.svelte';
	import { getDashboardStats, type DashboardData } from '$lib/api/dashboard.js';
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
	<title>Dashboard - ProjectRIMS</title>
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
		<LowStockAlert parts={dashboardData?.lowStockParts ?? []} {loading} />
	</div>
</div>
