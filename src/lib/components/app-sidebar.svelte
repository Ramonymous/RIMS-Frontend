<script lang="ts">
	import BoxIcon from '@tabler/icons-svelte/icons/box';
	import DashboardIcon from '@tabler/icons-svelte/icons/dashboard';
	import HelpIcon from '@tabler/icons-svelte/icons/help';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';
	import PackageExportIcon from '@tabler/icons-svelte/icons/package-export';
	import PackageImportIcon from '@tabler/icons-svelte/icons/package-import';
	import ClipboardListIcon from '@tabler/icons-svelte/icons/clipboard-list';
	import TruckDeliveryIcon from '@tabler/icons-svelte/icons/truck-delivery';
	import HistoryIcon from '@tabler/icons-svelte/icons/history';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings';
	import UsersIcon from '@tabler/icons-svelte/icons/users';
	import NavMain from './nav-main.svelte';
	import NavSecondary from './nav-secondary.svelte';
	import NavUser from './nav-user.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { resolve } from '$app/paths';

	const navMain = [
		{
			title: 'Dashboard',
			url: '/app',
			icon: DashboardIcon
		},
		{
			title: 'Parts',
			url: '/app/parts',
			icon: BoxIcon,
			requiredPermission: 'parts'
		},
		{
			title: 'Receivings',
			url: '/app/receivings',
			icon: PackageImportIcon
		},
		{
			title: 'Outgoings',
			url: '/app/outgoings',
			icon: PackageExportIcon
		},
		{
			title: 'Check Location',
			url: '/app/check-location',
			icon: InnerShadowTopIcon
		},
		{
			title: 'Movements',
			url: '/app/movements',
			icon: HistoryIcon
		},
		{
			title: 'Requests',
			url: '/app/requests',
			icon: ClipboardListIcon
		},
		{
			title: 'Supply',
			url: '/app/requests/supply',
			icon: TruckDeliveryIcon
		},
		{
			title: 'Users',
			url: '/app/users',
			icon: UsersIcon,
			requiredPermission: 'users'
		}
	];

	const navSecondary = [
		{
			title: 'Settings',
			url: '/app/settings',
			icon: SettingsIcon
		},
		{
			title: 'Help',
			url: '/app/help',
			icon: HelpIcon
		}
	];

	// Get user from auth store
	const user = $derived({
		name: auth.user?.name ?? 'User',
		email: auth.user?.email ?? '',
		avatar: ''
	});

	let { ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:!p-1.5">
					{#snippet child({ props })}
						<a href={resolve('/app')} {...props}>
							<InnerShadowTopIcon class="!size-5" />
							<span class="text-base font-semibold">ProjectRIMS</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} />
		<NavSecondary items={navSecondary} class="mt-auto" />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} />
	</Sidebar.Footer>
</Sidebar.Root>
