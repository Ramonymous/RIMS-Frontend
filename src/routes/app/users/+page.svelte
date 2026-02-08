<script lang="ts">
	import { onMount } from 'svelte';
	import { getUsers, deleteUser } from '$lib/api/users.js'; // Removed unused type import
	import type { UserResponse } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { formatDate } from '$lib/utils.js';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	// Icons
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import RefreshIcon from '@tabler/icons-svelte/icons/refresh';
	import UserIcon from '@tabler/icons-svelte/icons/user';

	// User form dialog
	import UserFormDialog from './user-form-dialog.svelte';

	let users = $state<UserResponse[]>([]);
	let loading = $state(true);
	let deleting = $state(false);
	let userToDelete = $state<UserResponse | null>(null);
	let showDeleteDialog = $state(false);
	let showFormDialog = $state(false);
	let editingUser = $state<UserResponse | null>(null);

	async function loadUsers() {
		loading = true;
		try {
			const response = await getUsers();
			users = response.items;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to load users', {
				description: error.detail
			});
		} finally {
			loading = false;
		}
	}

	function handleCreate() {
		editingUser = null;
		showFormDialog = true;
	}

	function handleEdit(user: UserResponse) {
		editingUser = user;
		showFormDialog = true;
	}

	function handleDeleteClick(user: UserResponse) {
		userToDelete = user;
		showDeleteDialog = true;
	}

	async function confirmDelete() {
		if (!userToDelete) return;

		deleting = true;
		try {
			await deleteUser(userToDelete.id);
			toast.success('User deleted', {
				description: `${userToDelete.name} has been deleted.`
			});
			users = users.filter((u) => u.id !== userToDelete!.id);
			showDeleteDialog = false;
			userToDelete = null;
		} catch (e) {
			const error = e as ApiError;
			toast.error('Failed to delete user', {
				description: error.detail
			});
		} finally {
			deleting = false;
		}
	}

	function handleFormSuccess() {
		showFormDialog = false;
		editingUser = null;
		loadUsers();
	}

	// formatDate is imported from $lib/utils.js

	onMount(() => {
		loadUsers();
	});
</script>

<svelte:head>
	<title>Users - ProjectRIMS</title>
</svelte:head>

<div class="flex flex-col gap-4 p-4 lg:p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Users</h2>
			<p class="text-muted-foreground">Manage system users and their permissions.</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={loadUsers} disabled={loading}>
				<RefreshIcon class="size-4" />
				Refresh
			</Button>
			{#if auth.hasPermission('users.create')}
				<Button size="sm" onclick={handleCreate}>
					<PlusIcon class="size-4" />
					Add User
				</Button>
			{/if}
		</div>
	</div>

	<!-- Users Table -->
	<div class="rounded-md border bg-card">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-12"></Table.Head>
					<Table.Head>Name</Table.Head>
					<Table.Head>Email</Table.Head>
					<Table.Head>Permissions</Table.Head>
					<Table.Head>Created</Table.Head>
					<Table.Head class="w-24 text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if loading}
					{#each Array(5) as _, i (i)}
						<Table.Row>
							<Table.Cell><Skeleton class="size-8 rounded-full" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
							<Table.Cell><Skeleton class="h-8 w-16" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if users.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="h-24 text-center">
							<div class="flex flex-col items-center gap-2">
								<UserIcon class="size-8 text-muted-foreground" />
								<p class="text-muted-foreground">No users found.</p>
								{#if auth.hasPermission('users.create')}
									<Button size="sm" onclick={handleCreate}>Add your first user</Button>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each users as user (user.id)}
						<Table.Row>
							<Table.Cell>
								<div
									class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"
								>
									{user.name.charAt(0).toUpperCase()}
								</div>
							</Table.Cell>
							<Table.Cell class="font-medium">
								{user.name}
								{#if user.id === auth.user?.id}
									<Badge variant="outline" class="ml-2">You</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{user.email}</Table.Cell>
							<Table.Cell>
								{#if user.permissions.length === 0}
									<span class="text-sm text-muted-foreground">No permissions</span>
								{:else}
									<div class="flex flex-wrap gap-1">
										{#each user.permissions.slice(0, 2) as perm (perm)}
											<Badge variant="secondary" class="text-xs">{perm}</Badge>
										{/each}
										{#if user.permissions.length > 2}
											<Badge variant="outline" class="text-xs">
												+{user.permissions.length - 2} more
											</Badge>
										{/if}
									</div>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground">
								{formatDate(user.created_at)}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1">
									{#if auth.hasPermission('users.update')}
										<Button
											variant="ghost"
											size="icon"
											class="size-8"
											onclick={() => handleEdit(user)}
										>
											<PencilIcon class="size-4" />
										</Button>
									{/if}
									{#if auth.hasPermission('users.delete')}
										<Button
											variant="ghost"
											size="icon"
											class="size-8 text-destructive hover:text-destructive"
											onclick={() => handleDeleteClick(user)}
											disabled={user.id === auth.user?.id}
										>
											<TrashIcon class="size-4" />
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete User</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be
				undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={confirmDelete}
				disabled={deleting}
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
			>
				{#if deleting}
					Deleting...
				{:else}
					Delete
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- User Form Dialog -->
<UserFormDialog bind:open={showFormDialog} user={editingUser} onSuccess={handleFormSuccess} />
