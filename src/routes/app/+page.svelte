<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	onMount(() => {
		auth.initialize();
		if (!auth.isAuthenticated) {
			goto(resolve('/login'), { replaceState: true });
			return;
		}

		const role = auth.user?.role;
		if (role === 'delivery') {
			goto('/app/delivery', { replaceState: true });
			return;
		}
		if (role === 'inventory') {
			goto('/app/inventory', { replaceState: true });
			return;
		}
		// admin stays on /app
	});
</script>

<svelte:head>
	<title>Dashboard - ProjectRIMS</title>
</svelte:head>

{#if auth.isAuthenticated && auth.user?.role === 'admin'}
	<div class="flex flex-col gap-6 p-4 md:p-6">
		<div class="flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
				<p class="text-muted-foreground">Manage users and configuration.</p>
			</div>
			<Badge variant="secondary">Admin</Badge>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded-xl border bg-card p-4 md:p-6">
				<div class="text-sm font-medium">Users</div>
				<div class="mt-1 text-sm text-muted-foreground">Create and manage system users.</div>
				<div class="mt-4">
					<Button href="/app/users">Open Users</Button>
				</div>
			</div>
			<div class="rounded-xl border bg-card p-4 md:p-6">
				<div class="text-sm font-medium">Parts</div>
				<div class="mt-1 text-sm text-muted-foreground">Manage parts master data.</div>
				<div class="mt-4">
					<Button href="/app/parts">Open Parts</Button>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<div class="text-sm text-muted-foreground">Redirecting...</div>
	</div>
{/if}
