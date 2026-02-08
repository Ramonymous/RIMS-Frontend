<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { toast } from 'svelte-sonner';
	import type { ApiError } from '$lib/api/index.js';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithElementRef<HTMLFormAttributes> = $props();

	const id = $props.id();

	let email = $state('');
	let password = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		try {
			await auth.login({ email, password });
			toast.success('Login successful', {
				description: `Welcome back, ${auth.user?.name}!`
			});
			goto(resolve('/app'), { replaceState: true });
		} catch (error) {
			const apiError = error as ApiError;
			toast.error('Login failed', {
				description: apiError.detail || 'Invalid email or password'
			});
		}
	}
</script>

<form
	class={cn('flex flex-col gap-6', className)}
	bind:this={ref}
	onsubmit={handleSubmit}
	{...restProps}
>
	<FieldGroup>
		<div class="flex flex-col items-center gap-1 text-center">
			<h1 class="text-2xl font-bold">Login to your account</h1>
			<p class="text-sm text-balance text-muted-foreground">
				Enter your email below to login to your account
			</p>
		</div>
		<Field>
			<FieldLabel for="email-{id}">Email</FieldLabel>
			<Input
				id="email-{id}"
				type="email"
				placeholder="m@example.com"
				required
				bind:value={email}
				disabled={auth.isLoading}
			/>
		</Field>
		<Field>
			<div class="flex items-center">
				<FieldLabel for="password-{id}">Password</FieldLabel>
				<a href="##" class="ms-auto text-sm underline-offset-4 hover:underline">
					Forgot your password?
				</a>
			</div>
			<Input
				id="password-{id}"
				type="password"
				required
				bind:value={password}
				disabled={auth.isLoading}
			/>
		</Field>
		<Field>
			<Button type="submit" disabled={auth.isLoading}>
				{#if auth.isLoading}
					<LoaderCircleIcon class="mr-2 size-4 animate-spin" />
					Logging in...
				{:else}
					Login
				{/if}
			</Button>
		</Field>
		<FieldDescription class="text-center">
			Don't have an account?
			<a href="##" class="underline underline-offset-4">Sign up</a>
		</FieldDescription>
	</FieldGroup>
</form>
