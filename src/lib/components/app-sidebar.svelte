<script lang="ts">
	import NavMain from './nav-main.svelte';
	import NavUser from './nav-user.svelte';
	import TeamSwitcher from './team-switcher.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { page } from '$app/state';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
	import BoxesIcon from '@lucide/svelte/icons/boxes';
	import UsersIcon from '@lucide/svelte/icons/users';
	import LayersIcon from '@lucide/svelte/icons/layers';

	let {
		ref = $bindable(null),
		collapsible = 'icon',
		...restProps
	}: ComponentProps<typeof Sidebar.Root> = $props();

	function hasAnyPermission(prefix: string): boolean {
		return auth.user?.permissions.some((p) => p.startsWith(`${prefix}.`)) ?? false;
	}

	const canSeeParts = $derived(hasAnyPermission('parts'));
	const canSeeUsers = $derived(hasAnyPermission('users'));
	const pathname = $derived(String(page.url.pathname));
	const isDelivery = $derived(
		pathname === '/app/delivery' || pathname.startsWith('/app/delivery/')
	);

	const teams = $derived([
		{
			name: 'Inventory',
			logo: LayersIcon,
			plan: 'ProjectRIMS',
			url: '/app/inventory'
		},
		{
			name: 'Delivery',
			logo: LayersIcon,
			plan: 'Coming Soon',
			url: '/app/delivery'
		}
	]);

	const user = $derived({
		name: auth.user?.name ?? 'User',
		email: auth.user?.email ?? '',
		avatar: ''
	});

	const inventoryNav = $derived([
		{
			title: 'Dashboard',
			url: '/app/inventory',
			icon: LayoutDashboardIcon
		},
		{
			title: 'Operations',
			url: '#',
			icon: ClipboardListIcon,
			items: [
				{ title: 'Receivings', url: '/app/inventory/receivings' },
				{ title: 'Outgoings', url: '/app/inventory/outgoings' },
				{ title: 'Requests', url: '/app/inventory/requests' },
				{ title: 'Supply', url: '/app/inventory/requests/supply' }
			]
		},
		{
			title: 'Warehouse',
			url: '#',
			icon: ArrowLeftRightIcon,
			items: [
				{ title: 'Movements', url: '/app/inventory/movements' },
				{ title: 'Check Location', url: '/app/inventory/check-location' }
			]
		}
	]);

	const deliveryNav = $derived([
		{
			title: 'Dashboard',
			url: '/app/delivery',
			icon: LayoutDashboardIcon
		}
	]);

	const navMain = $derived(isDelivery ? deliveryNav : inventoryNav);

	const adminNav = $derived(
		isDelivery
			? []
			: [
					...(canSeeParts
						? [
								{
									title: 'Parts',
									url: '/app/parts',
									icon: BoxesIcon
								}
							]
						: []),
					...(canSeeUsers
						? [
								{
									title: 'Users',
									url: '/app/users',
									icon: UsersIcon
								}
							]
						: [])
				]
	);
</script>

<Sidebar.Root {collapsible} {...restProps}>
	<Sidebar.Header>
		<TeamSwitcher {teams} />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} label="Menu" />
		{#if adminNav.length > 0}
			<NavMain items={adminNav} label="Admin" />
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
