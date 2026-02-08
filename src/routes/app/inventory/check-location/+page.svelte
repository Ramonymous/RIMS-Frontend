<script lang="ts">
	import { pickRequestItem } from '$lib/api/parts.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import QrScanner from '$lib/components/qr-scanner.svelte';
	import HashIcon from '@tabler/icons-svelte/icons/hash';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	let partNumber = $state('');
	let dialogOpen = $state(false);
	let confirmLoading = $state(false);
	let scannedPart = $state('');

	function handleQrScan(scanned: string) {
		partNumber = scanned.trim();
		openDialog();
	}

	function handleManualCheck() {
		if (partNumber.trim()) {
			openDialog();
		} else {
			toast.error('Please enter a part number');
		}
	}

	function openDialog() {
		scannedPart = partNumber.trim();
		dialogOpen = true;
	}

	async function confirmCheck() {
		confirmLoading = true;
		try {
			await pickRequestItem(scannedPart);
			toast.success('Check location triggered', {
				description: `Checking location for part ${scannedPart}. Please observe the rack lights.`
			});
			dialogOpen = false;
			partNumber = '';
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to check location', {
				description: error?.detail || 'IoT system error.'
			});
		} finally {
			confirmLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Check Part Location - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-6 p-4 md:p-6">
	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-3">
			<div class="rounded-2xl p-3">
				<MapPinIcon class="size-6 text-white" />
			</div>
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">Check Location</h1>
				<p class="text-sm text-muted-foreground">
					Scan or enter a part number to locate it in the warehouse.
				</p>
			</div>
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-2xl border bg-card p-4 md:p-6">
			<div class="mb-4 flex items-center justify-between">
				<div>
					<div class="text-sm font-medium">QR</div>
					<div class="text-xs text-muted-foreground">Point camera at QR code</div>
				</div>
				<Badge variant="secondary">Scanner</Badge>
			</div>
			<div class="relative overflow-hidden rounded-xl border bg-muted/30 p-4">
				<div class="absolute top-0 right-0 opacity-10">
					<SparklesIcon class="size-20 text-blue-500" />
				</div>
				<QrScanner onScan={handleQrScan} pauseDuration={2000} />
			</div>
		</div>

		<div class="rounded-2xl border bg-card p-4 md:p-6">
			<div class="mb-4 flex items-center justify-between">
				<div>
					<div class="text-sm font-medium">Manual</div>
					<div class="text-xs text-muted-foreground">Enter part number</div>
				</div>
				<Badge variant="secondary">Input</Badge>
			</div>
			<div class="space-y-3">
				<div class="space-y-1">
					<div class="text-xs font-medium text-muted-foreground">Part Number</div>
					<div class="relative">
						<HashIcon class="absolute top-3.5 left-3 size-4 text-muted-foreground" />
						<Input
							placeholder="e.g., P12345"
							bind:value={partNumber}
							class="h-12 pl-10 font-mono text-base uppercase"
							onkeydown={(e) => e.key === 'Enter' && handleManualCheck()}
						/>
					</div>
				</div>
				<Button onclick={handleManualCheck} size="lg" class="h-12 w-full">
					<MapPinIcon class="size-4" />
					Locate
				</Button>
				<div class="rounded-xl border bg-muted/30 p-4">
					<div class="flex items-start gap-3">
						<SparklesIcon class="mt-0.5 size-4 text-muted-foreground" />
						<div class="text-sm text-muted-foreground">
							The storage rack will light up when a part is found.
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Confirmation Dialog -->
<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="rounded-2xl sm:max-w-[420px]">
		<Dialog.Header>
			<div class="mx-auto mb-4 w-fit rounded-full bg-blue-100 p-3">
				<MapPinIcon class="size-6 text-blue-600" />
			</div>
			<Dialog.Title class="text-center text-xl">Locate This Part?</Dialog.Title>
			<Dialog.Description class="text-center">
				We'll activate the rack lights for part
				<div
					class="mt-2 inline-block rounded-lg px-4 py-2 font-mono text-lg font-bold text-blue-600 shadow-sm"
				>
					{scannedPart}
				</div>
			</Dialog.Description>
		</Dialog.Header>
		<div class="mt-6 flex justify-end gap-3">
			<Button
				variant="ghost"
				onclick={() => (dialogOpen = false)}
				disabled={confirmLoading}
				class="hover:bg-gray-100"
			>
				Cancel
			</Button>
			<Button
				onclick={confirmCheck}
				disabled={confirmLoading || !scannedPart}
				class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg disabled:opacity-50"
			>
				{#if confirmLoading}
					<LoaderCircleIcon class="mr-2 size-4 animate-spin" />
					Locating...
				{:else}
					<SparklesIcon class="mr-2 size-4" />
					Activate Lights
				{/if}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
