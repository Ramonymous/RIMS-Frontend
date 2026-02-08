<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';

	// This should be `Component` after @lucide/svelte updates types
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { teams }: { teams: { name: string; logo: any; plan: string; url: string }[] } = $props();
	const sidebar = useSidebar();

	let activeTeamName = $state<string | null>(null);
	const activeTeam = $derived(teams.find((t) => t.name === activeTeamName) ?? teams[0]);

	$effect(() => {
		if (teams.length === 0) return;
		const matched = teams.find((t) => {
			if (page.url.pathname === t.url || page.url.pathname.startsWith(`${t.url}/`)) return true;
			if (
				t.url === '/app/inventory' &&
				(page.url.pathname === '/app' ||
					(page.url.pathname.startsWith('/app/') && !page.url.pathname.startsWith('/app/delivery')))
			) {
				return true;
			}
			return false;
		});
		if (matched) {
			activeTeamName = matched.name;
			return;
		}
		if (!activeTeamName) {
			activeTeamName = teams[0].name;
		}
	});

	function closeMobile() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	function selectTeam(team: { name: string; url: string }) {
		activeTeamName = team.name;
		closeMobile();
		goto(team.url);
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<div
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
						>
							<activeTeam.logo class="size-4" />
						</div>
						<div class="grid flex-1 text-start text-sm leading-tight">
							<span class="truncate font-medium">
								{activeTeam.name}
							</span>
							<span class="truncate text-xs">{activeTeam.plan}</span>
						</div>
						<ChevronsUpDownIcon class="ms-auto" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				align="start"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				sideOffset={4}
			>
				<DropdownMenu.Label class="text-xs text-muted-foreground">Teams</DropdownMenu.Label>
				{#each teams as team, index (team.name)}
					<DropdownMenu.Item onSelect={() => selectTeam(team)} class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border">
							<team.logo class="size-3.5 shrink-0" />
						</div>
						{team.name}
						<DropdownMenu.Shortcut>⌘{index + 1}</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="gap-2 p-2">
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<PlusIcon class="size-4" />
					</div>
					<div class="font-medium text-muted-foreground">Add team</div>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
