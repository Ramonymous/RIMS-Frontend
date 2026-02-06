<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { sseClient, type RequestItemEvent } from '$lib/services/sse.svelte.js';

	const { children } = $props();

	let unsubscribeCreated: (() => void) | null = null;
	let unsubscribeSupplied: (() => void) | null = null;

	// Handle new request item notification
	function handleNewRequestItem(event: RequestItemEvent) {
		const urgentLabel = event.is_urgent ? '🚨 URGENT: ' : '';
		toast.info(`${urgentLabel}Permintaan Baru`, {
			description: `${event.part.part_number} → ${event.request.destination || 'Unknown'}`,
			duration: 5000
		});
	}

	// Handle supplied item notification
	function handleItemSupplied(data: { item_id: string; part_number: string }) {
		toast.success('Item Disuplai', {
			description: `${data.part_number} telah disuplai`,
			duration: 3000
		});
	}

	// Initialize auth and SSE on mount
	$effect(() => {
		if (browser) {
			auth.initialize();

			// Redirect to login if not authenticated
			if (!auth.isAuthenticated) {
				goto(resolve('/login'));
			} else {
				// Connect to SSE for real-time notifications
				sseClient.connect();
				unsubscribeCreated = sseClient.onRequestItemCreated(handleNewRequestItem);
				unsubscribeSupplied = sseClient.onRequestItemSupplied(handleItemSupplied);
			}
		}
	});

	onDestroy(() => {
		if (unsubscribeCreated) unsubscribeCreated();
		if (unsubscribeSupplied) unsubscribeSupplied();
		sseClient.disconnect();
	});
</script>

{#if auth.isAuthenticated}
	<Sidebar.Provider
		style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
	>
		<AppSidebar variant="inset" />
		<Sidebar.Inset>
			<SiteHeader />
			<div class="flex flex-1 flex-col">
				<div class="@container/main flex flex-1 flex-col gap-2">
					{@render children()}
				</div>
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
{:else}
	<div class="flex min-h-svh items-center justify-center">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{/if}
