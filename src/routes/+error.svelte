<script lang="ts">
	import { page } from '$app/state';

	const status = $derived(page.status);
	const error = $derived(page.error as (Error & { status?: number }) | null);
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
	<h1 class="text-5xl font-bold text-destructive">{status}</h1>
	<h2 class="text-2xl font-semibold">
		{status === 404 ? 'Page Not Found' : 'Something went wrong'}
	</h2>
	<p class="max-w-xl text-center text-muted-foreground">
		{error?.message || 'An unexpected error occurred.'}
	</p>
	<a href="/" class="mt-4 rounded bg-primary px-4 py-2 text-white transition hover:bg-primary/90"
		>Back to Home</a
	>
</div>
