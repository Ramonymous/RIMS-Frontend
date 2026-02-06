<script lang="ts">
	import DotsIcon from '@tabler/icons-svelte/icons/dots';
	import type { Icon } from '@tabler/icons-svelte';

	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	let { items }: { items: { name: string; url: string; icon: Icon }[] } = $props();

	const _sidebar = Sidebar.useSidebar(); // Prefix with underscore to indicate unused
</script>

<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
	<Sidebar.GroupLabel>Documents</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#each items as item (item.name)}
			{@const IconComponent = item.icon}

			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<a {...props} href={item.url}>
							<IconComponent />
							<span>{item.name}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>

				<!-- rest of dropdown unchanged -->
			</Sidebar.MenuItem>
		{/each}

		<Sidebar.MenuItem>
			<Sidebar.MenuButton class="text-sidebar-foreground/70">
				<DotsIcon class="text-sidebar-foreground/70" />
				<span>More</span>
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Group>
