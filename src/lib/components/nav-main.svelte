<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { page } from '$app/state';

	let {
		items,
		label = 'Platform'
	}: {
		items: {
			title: string;
			url: string;
			// this should be `Component` after @lucide/svelte updates types
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			icon?: any;
			isActive?: boolean;
			items?: {
				title: string;
				url: string;
			}[];
		}[];
		label?: string;
	} = $props();

	const sidebar = Sidebar.useSidebar();
	let openByTitle = $state<Record<string, boolean>>({});

	function isActiveUrl(url: string): boolean {
		if (!url || url === '#') return false;
		return page.url.pathname === url || page.url.pathname.startsWith(`${url}/`);
	}

	function closeOnMobile() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	$effect(() => {
		for (const item of items) {
			const hasChildren = (item.items?.length ?? 0) > 0;
			if (!hasChildren) continue;

			const isChildActive = item.items?.some((s) => isActiveUrl(s.url)) ?? false;
			if (isChildActive && openByTitle[item.title] === false) {
				openByTitle[item.title] = true;
			}
		}
	});
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>{label}</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#each items as item (item.title)}
			{#if (item.items?.length ?? 0) > 0}
				<Collapsible.Root
					open={openByTitle[item.title] ?? true}
					onOpenChange={(v) => (openByTitle[item.title] = v)}
					class="group/collapsible"
				>
					{#snippet child({ props })}
						<Sidebar.MenuItem {...props}>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Sidebar.MenuButton {...props} tooltipContent={item.title}>
										{#if item.icon}
											<item.icon />
										{/if}
										<span>{item.title}</span>
										<ChevronRightIcon
											class="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
										/>
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>
							<Collapsible.Content>
								<Sidebar.MenuSub>
									{#each item.items ?? [] as subItem (subItem.title)}
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubButton isActive={isActiveUrl(subItem.url)}>
												{#snippet child({ props })}
													<a href={subItem.url} onclick={closeOnMobile} {...props}>
														<span>{subItem.title}</span>
													</a>
												{/snippet}
											</Sidebar.MenuSubButton>
										</Sidebar.MenuSubItem>
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					{/snippet}
				</Collapsible.Root>
			{:else}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent={item.title} isActive={isActiveUrl(item.url)}>
						{#snippet child({ props })}
							<a href={item.url} onclick={closeOnMobile} {...props}>
								{#if item.icon}
									<item.icon />
								{/if}
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/if}
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
