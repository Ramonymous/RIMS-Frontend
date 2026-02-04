<script lang="ts">
	import type { PartResponse } from '$lib/api/types.js';

	// Components
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	// Icons
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import CheckIcon from '@tabler/icons-svelte/icons/check';

	interface Props {
		parts: PartResponse[];
		value?: string;
		onValueChange?: (value: string | undefined) => void;
		disabled?: boolean;
		disabledPartIds?: string[];
		showStock?: boolean;
		placeholder?: string;
		class?: string;
	}

	let {
		parts,
		value = $bindable(),
		onValueChange,
		disabled = false,
		disabledPartIds = [],
		showStock = true,
		placeholder = 'Select a part',
		class: className = ''
	}: Props = $props();

	let open = $state(false);
	let searchQuery = $state('');

	const selectedPart = $derived(parts.find((p) => p.id === value));

	const filteredParts = $derived(
		parts.filter(
			(p) =>
				p.is_active &&
				(searchQuery === '' ||
					p.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
					p.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					(p.customer_code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false))
		)
	);

	function selectPart(partId: string) {
		value = partId;
		onValueChange?.(partId);
		open = false;
		searchQuery = '';
	}

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			searchQuery = '';
		}
	}
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				variant="outline"
				class="w-full justify-between font-normal {className}"
				{...props}
				{disabled}
			>
				{#if selectedPart}
					<span class="font-mono text-xs">{selectedPart.part_number}</span>
				{:else}
					<span class="text-muted-foreground">{placeholder}</span>
				{/if}
				<ChevronDownIcon class="size-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-80 p-0" align="start">
		<div class="border-b p-2">
			<div class="relative">
				<SearchIcon
					class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input placeholder="Search parts..." bind:value={searchQuery} class="h-9 pl-8" />
			</div>
		</div>
		<div class="max-h-60 overflow-y-auto p-1">
			{#if filteredParts.length === 0}
				<div class="py-6 text-center text-sm text-muted-foreground">No parts found</div>
			{:else}
				{#each filteredParts as part (part.id)}
					{@const isSelected = value === part.id}
					{@const isDisabled = disabledPartIds.includes(part.id) && !isSelected}
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => selectPart(part.id)}
						disabled={isDisabled}
					>
						<div class="flex size-4 items-center justify-center">
							{#if isSelected}
								<CheckIcon class="size-4" />
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<span class="font-mono text-xs">{part.part_number}</span>
						</div>
						{#if showStock}
							<Badge variant="outline" class="shrink-0 text-xs">
								{part.stock}
							</Badge>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
