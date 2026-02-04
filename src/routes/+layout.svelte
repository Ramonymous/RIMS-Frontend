<script lang="ts">
	import './layout.css';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { auth } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';

	const { children } = $props();

	// Initialize auth store from localStorage on mount
	onMount(() => {
		auth.initialize();
	});
</script>

<svelte:head>
	<title>ProjectRIMS - Inventory Management System</title>
	<meta name="description" content="ProjectRIMS Inventory Management System" />
</svelte:head>

<Toaster richColors position="top-right" expand={true} visibleToasts={5} />
{@render children()}
