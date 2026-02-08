<script lang="ts">
	import NavMain from './nav-main.svelte';
	import NavUser from './nav-user.svelte';
	import TeamSwitcher from './team-switcher.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte.js';
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

	const teams = $derived([
		{
			name: 'ProjectRIMS',
			logo: LayersIcon,
			plan: 'Inventory'
		}
	]);

	const user = $derived({
		name: auth.user?.name ?? 'User',
		email: auth.user?.email ?? '',
		avatar: ''
	});

	const navMain = $derived([
		{
			title: 'Dashboard',
			url: '/app',
			icon: LayoutDashboardIcon
		},
		{
			title: 'Operations',
			url: '#',
			icon: ClipboardListIcon,
			items: [
				{ title: 'Receivings', url: '/app/receivings' },
				{ title: 'Outgoings', url: '/app/outgoings' },
				{ title: 'Requests', url: '/app/requests' },
				{ title: 'Supply', url: '/app/requests/supply' }
			]
		},
		{
			title: 'Warehouse',
			url: '#',
			icon: ArrowLeftRightIcon,
			items: [
				{ title: 'Movements', url: '/app/movements' },
				{ title: 'Check Location', url: '/app/check-location' }
			]
		}
	]);

	const adminNav = $derived([
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
	]);
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
