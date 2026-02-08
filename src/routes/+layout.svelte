<script lang="ts">
	import './layout.css';
	import { Toaster } from 'svelte-sonner';
	import { auth } from '$lib/stores/auth.svelte.js';
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
