<script lang="ts">
	import { onMount } from 'svelte';
	import { pickRequestItem } from '$lib/api/parts.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import QrScanner from '$lib/components/qr-scanner.svelte';
	import HashIcon from '@tabler/icons-svelte/icons/hash';
	import ScanIcon from '@tabler/icons-svelte/icons/scan';
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

<div class="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
	<!-- Header with icon -->
	<div class="animate-in space-y-2 text-center duration-700 fade-in slide-in-from-top-4">
		<div
			class="mx-auto w-fit rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 shadow-lg shadow-blue-500/30"
		>
			<MapPinIcon class="size-8 text-white" />
		</div>
		<h1
			class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent"
		>
			Part Location Finder
		</h1>
		<p class="max-w-md text-muted-foreground">
			Scan or enter a part number to instantly locate it in the warehouse
		</p>
	</div>

	<!-- Main card -->
	<div class="w-full max-w-md animate-in delay-150 duration-700 fade-in slide-in-from-bottom-4">
		<div class="rounded-2xl border bg-card p-8 shadow-xl">
			<div class="space-y-6">
				<!-- QR Scanner -->
				<div
					class="group relative overflow-hidden rounded-xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 transition-all hover:border-blue-400 hover:shadow-lg"
				>
					<div class="absolute top-0 right-0 opacity-10">
						<SparklesIcon class="size-20 text-blue-500" />
					</div>
					<QrScanner onScan={handleQrScan} pauseDuration={2000} />
					<div
						class="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-blue-600"
					>
						<ScanIcon class="size-5 animate-pulse" />
						<span>Point camera at QR code</span>
					</div>
				</div>

				<!-- Divider -->
				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground">Or enter manually</span>
					</div>
				</div>

				<!-- Manual input -->
				<div class="space-y-3">
					<div class="group relative">
						<div
							class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition group-hover:opacity-20"
						></div>
						<div class="relative flex items-center gap-2">
							<div class="relative flex-1">
								<HashIcon class="absolute top-3.5 left-3 size-4 text-muted-foreground" />
								<Input
									placeholder="Part number (e.g., P12345)"
									bind:value={partNumber}
									class="h-12 pl-10 font-mono text-base uppercase shadow-sm transition-all focus:shadow-md"
									onkeydown={(e) => e.key === 'Enter' && handleManualCheck()}
								/>
							</div>
							<Button
								onclick={handleManualCheck}
								size="lg"
								class="h-12 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
							>
								<MapPinIcon class="mr-2 size-4" />
								Locate
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer hint -->
	<div class="animate-in text-center text-sm text-muted-foreground delay-300 duration-700 fade-in">
		💡 The storage rack will light up when a part is found
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
					class="mt-2 inline-block rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 font-mono text-lg font-bold text-blue-600 shadow-sm"
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
