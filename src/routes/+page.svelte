<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte.js';

	onMount(() => {
		auth.initialize();
		if (auth.isAuthenticated) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<title>ProjectRIMS</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center">
	<div class="text-muted-foreground">Redirecting...</div>
</div>
