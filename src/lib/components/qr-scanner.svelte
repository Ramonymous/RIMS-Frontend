<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type {
		Html5Qrcode as Html5QrcodeType,
		Html5QrcodeScannerState as ScannerStateType
	} from 'html5-qrcode';
	import { Button } from '$lib/components/ui/button/index.js';
	import CameraIcon from '@tabler/icons-svelte/icons/camera';
	import CameraOffIcon from '@tabler/icons-svelte/icons/camera-off';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	interface Props {
		onScan: (result: string) => void;
		pauseDuration?: number; // milliseconds to pause after scan
		disabled?: boolean;
	}

	let { onScan, pauseDuration = 5000, disabled = false }: Props = $props();

	let scanner: Html5QrcodeType | null = null;
	let qrModule = $state<
		| (typeof import('html5-qrcode') & {
				Html5Qrcode: new (elementId: string) => Html5QrcodeType;
				Html5QrcodeScannerState: typeof ScannerStateType;
		  })
		| null
	>(null);
	let isScanning = $state(false);
	let isPaused = $state(false);
	let isInitializing = $state(false);
	let error = $state<string | null>(null);
	let pauseCountdown = $state(0);
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

	const scannerId = `qr-scanner-${Math.random().toString(36).substring(7)}`;

	async function getQrModule() {
		if (qrModule) return qrModule;
		qrModule = await import('html5-qrcode');
		return qrModule;
	}

	async function startScanner() {
		if (isScanning || isInitializing || disabled) return;

		isInitializing = true;
		error = null;

		try {
			const m = await getQrModule();
			scanner = new m.Html5Qrcode(scannerId);

			const config = {
				fps: 10, // Balanced for performance
				qrbox: { width: 250, height: 250 },
				aspectRatio: 1,
				disableFlip: false
			};

			await scanner.start(
				{ facingMode: 'environment' }, // Use back camera
				config,
				handleScanSuccess,
				handleScanError
			);

			isScanning = true;
		} catch (err) {
			console.error('Failed to start scanner:', err);
			error = 'Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.';
		} finally {
			isInitializing = false;
		}
	}

	async function stopScanner() {
		if (!scanner) return;

		try {
			const m = await getQrModule();
			const state = scanner.getState();
			if (
				state === m.Html5QrcodeScannerState.SCANNING ||
				state === m.Html5QrcodeScannerState.PAUSED
			) {
				await scanner.stop();
			}
			scanner.clear();
		} catch (err) {
			console.error('Error stopping scanner:', err);
		}

		scanner = null;
		isScanning = false;
		isPaused = false;
	}

	function handleScanSuccess(decodedText: string) {
		if (isPaused || disabled) return;

		// Pause scanning
		isPaused = true;
		pauseCountdown = Math.ceil(pauseDuration / 1000);

		// Call the callback
		onScan(decodedText);

		// Start countdown
		countdownInterval = setInterval(() => {
			pauseCountdown--;
			if (pauseCountdown <= 0) {
				isPaused = false;
				if (countdownInterval) {
					clearInterval(countdownInterval);
					countdownInterval = null;
				}
			}
		}, 1000);
	}

	function handleScanError(_errorMessage: string) {
		// Silently ignore scan errors (no QR detected)
	}

	function toggleScanner() {
		if (isScanning) {
			stopScanner();
		} else {
			startScanner();
		}
	}

	onMount(() => {
		// Don't auto-start - let user click to start
	});

	onDestroy(() => {
		if (countdownInterval) {
			clearInterval(countdownInterval);
		}
		stopScanner();
	});
</script>

<div class="flex flex-col gap-3">
	<!-- Scanner viewport -->
	<div
		id={scannerId}
		class="relative overflow-hidden rounded-lg bg-muted {isScanning
			? 'min-h-[280px]'
			: 'min-h-[100px]'}"
	>
		{#if !isScanning && !isInitializing}
			<div class="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 p-4">
				<CameraIcon class="size-8 text-muted-foreground" />
				<p class="text-sm text-muted-foreground">Klik tombol untuk memulai scan</p>
			</div>
		{/if}

		{#if isInitializing}
			<div class="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 p-4">
				<LoaderCircleIcon class="size-8 animate-spin text-muted-foreground" />
				<p class="text-sm text-muted-foreground">Memulai kamera...</p>
			</div>
		{/if}

		{#if isPaused && isScanning}
			<div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70">
				<div class="text-center text-white">
					<p class="text-lg font-semibold">Scan berhasil!</p>
					<p class="text-sm">Lanjut scan dalam {pauseCountdown} detik</p>
				</div>
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	<!-- Toggle button -->
	<Button
		variant={isScanning ? 'destructive' : 'outline'}
		onclick={toggleScanner}
		disabled={isInitializing || disabled}
		class="w-full"
	>
		{#if isInitializing}
			<LoaderCircleIcon class="size-4 animate-spin" />
			Memulai...
		{:else if isScanning}
			<CameraOffIcon class="size-4" />
			Hentikan Scan
		{:else}
			<CameraIcon class="size-4" />
			Mulai Scan QR
		{/if}
	</Button>
</div>
