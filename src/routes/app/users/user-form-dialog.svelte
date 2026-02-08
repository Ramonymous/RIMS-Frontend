<script lang="ts">
	import { createUser, updateUser } from '$lib/api/users.js';
	import type { UserResponse, UserCreate, UserUpdate, UserRole } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Field, FieldLabel, FieldGroup } from '$lib/components/ui/field/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	// Icons
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@tabler/icons-svelte/icons/x';

	interface Props {
		open: boolean;
		user: UserResponse | null;
		onSuccess: () => void;
	}

	let { open = $bindable(), user, onSuccess }: Props = $props();

	// Form state
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let role = $state<UserRole>('inventory');
	let permissions = $state<string[]>([]);
	let saving = $state(false);

	const roleOptions: { value: UserRole; label: string }[] = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'inventory', label: 'Inventory' },
		{ value: 'delivery', label: 'Delivery' }
	];

	// Available permissions
	const availablePermissions = [
		{ value: 'users.view', label: 'View Users' },
		{ value: 'users.create', label: 'Create Users' },
		{ value: 'users.update', label: 'Update Users' },
		{ value: 'users.delete', label: 'Delete Users' },
		{ value: 'parts.view', label: 'View Parts' },
		{ value: 'parts.create', label: 'Create Parts' },
		{ value: 'parts.update', label: 'Update Parts' },
		{ value: 'parts.delete', label: 'Delete Parts' },
		{ value: 'receivings.view', label: 'View Receivings' },
		{ value: 'receivings.create', label: 'Create Receivings' },
		{ value: 'receivings.update', label: 'Update Receivings' },
		{ value: 'receivings.delete', label: 'Delete Receivings' },
		{ value: 'receivings.complete', label: 'Complete Receivings' },
		{ value: 'receivings.cancel', label: 'Cancel Receivings' },
		{ value: 'receivings.confirm_gr', label: 'Confirm GR' },
		{ value: 'outgoings.view', label: 'View Outgoings' },
		{ value: 'outgoings.create', label: 'Create Outgoings' },
		{ value: 'outgoings.update', label: 'Update Outgoings' },
		{ value: 'outgoings.delete', label: 'Delete Outgoings' },
		{ value: 'outgoings.complete', label: 'Complete Outgoings' },
		{ value: 'outgoings.cancel', label: 'Cancel Outgoings' },
		{ value: 'outgoings.confirm_gi', label: 'Confirm GI' },
		{ value: 'requests.view', label: 'View Requests' },
		{ value: 'requests.create', label: 'Create Requests' },
		{ value: 'requests.update', label: 'Update Requests' },
		{ value: 'requests.delete', label: 'Delete Requests' },
		{ value: 'requests.complete', label: 'Complete Requests' },
		{ value: 'requests.cancel', label: 'Cancel Requests' },
		{ value: 'requests.supply', label: 'Supply Requests' },
		{ value: 'requests.locations', label: 'Check Locations' }
	];

	const isEditing = $derived(!!user);
	const dialogTitle = $derived(isEditing ? 'Edit User' : 'Create User');
	const dialogDescription = $derived(
		isEditing ? "Update the user's information and permissions." : 'Add a new user to the system.'
	);

	// Reset form when dialog opens/user changes
	$effect(() => {
		if (open) {
			if (user) {
				name = user.name;
				email = user.email;
				password = '';
				role = user.role ?? 'inventory';
				permissions = [...user.permissions];
			} else {
				name = '';
				email = '';
				password = '';
				role = 'inventory';
				permissions = [];
			}
		}
	});

	function togglePermission(perm: string) {
		if (permissions.includes(perm)) {
			permissions = permissions.filter((p) => p !== perm);
		} else {
			permissions = [...permissions, perm];
		}
	}

	function selectAllPermissions() {
		permissions = availablePermissions.map((p) => p.value);
	}

	function clearAllPermissions() {
		permissions = [];
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;

		try {
			if (isEditing && user) {
				const updateData: UserUpdate = {
					name,
					email,
					role,
					permissions
				};
				await updateUser(user.id, updateData);
				toast.success('User updated', {
					description: `${name} has been updated successfully.`
				});
			} else {
				const createData: UserCreate = {
					name,
					email,
					password,
					role,
					permissions
				};
				await createUser(createData);
				toast.success('User created', {
					description: `${name} has been added to the system.`
				});
			}
			onSuccess();
		} catch (e) {
			const error = e as ApiError;
			toast.error(isEditing ? 'Failed to update user' : 'Failed to create user', {
				description: error.detail
			});
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] max-w-2xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{dialogTitle}</Dialog.Title>
			<Dialog.Description>{dialogDescription}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="space-y-6">
			<FieldGroup>
				<Field>
					<FieldLabel for="name">Name</FieldLabel>
					<Input
						id="name"
						bind:value={name}
						placeholder="Enter user's full name"
						required
						disabled={saving}
					/>
				</Field>

				<Field>
					<FieldLabel for="email">Email</FieldLabel>
					<Input
						id="email"
						type="email"
						bind:value={email}
						placeholder="user@example.com"
						required
						disabled={saving}
					/>
				</Field>

				<Field>
					<FieldLabel for="role">Role</FieldLabel>
					<Select.Root type="single" bind:value={role}>
						<Select.Trigger id="role" disabled={saving}>
							{roleOptions.find((r) => r.value === role)?.label ?? 'Select role'}
						</Select.Trigger>
						<Select.Content>
							{#each roleOptions as r (r.value)}
								<Select.Item value={r.value}>{r.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</Field>

				{#if !isEditing}
					<Field>
						<FieldLabel for="password">Password</FieldLabel>
						<Input
							id="password"
							type="password"
							bind:value={password}
							placeholder="Enter password"
							required
							disabled={saving}
							minlength={6}
						/>
					</Field>
				{/if}
			</FieldGroup>

			<!-- Permissions -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<FieldLabel>Permissions</FieldLabel>
					<div class="flex gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onclick={selectAllPermissions}
							disabled={saving}
						>
							Select All
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onclick={clearAllPermissions}
							disabled={saving}
						>
							Clear All
						</Button>
					</div>
				</div>

				<!-- Selected permissions -->
				{#if permissions.length > 0}
					<div class="flex flex-wrap gap-2 rounded-md bg-muted/50 p-3">
						{#each permissions as perm (perm)}
							<Badge variant="secondary" class="gap-1">
								{perm}
								<button
									type="button"
									class="hover:text-destructive"
									onclick={() => togglePermission(perm)}
								>
									<XIcon class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
				{/if}

				<!-- Permission checkboxes grouped by category -->
				<div class="grid gap-4 sm:grid-cols-2">
					<!-- Users -->
					<div class="space-y-2">
						<h4 class="text-sm font-medium text-muted-foreground">Users</h4>
						{#each availablePermissions.filter( (p) => p.value.startsWith('users.') ) as perm (perm.value)}
							<label class="flex cursor-pointer items-center gap-2">
								<Checkbox
									checked={permissions.includes(perm.value)}
									onCheckedChange={() => togglePermission(perm.value)}
									disabled={saving}
								/>
								<span class="text-sm">{perm.label}</span>
							</label>
						{/each}
					</div>

					<!-- Parts -->
					<div class="space-y-2">
						<h4 class="text-sm font-medium text-muted-foreground">Parts</h4>
						{#each availablePermissions.filter( (p) => p.value.startsWith('parts.') ) as perm (perm.value)}
							<label class="flex cursor-pointer items-center gap-2">
								<Checkbox
									checked={permissions.includes(perm.value)}
									onCheckedChange={() => togglePermission(perm.value)}
									disabled={saving}
								/>
								<span class="text-sm">{perm.label}</span>
							</label>
						{/each}
					</div>

					<!-- Receivings -->
					<div class="space-y-2">
						<h4 class="text-sm font-medium text-muted-foreground">Receivings</h4>
						{#each availablePermissions.filter( (p) => p.value.startsWith('receivings.') ) as perm (perm.value)}
							<label class="flex cursor-pointer items-center gap-2">
								<Checkbox
									checked={permissions.includes(perm.value)}
									onCheckedChange={() => togglePermission(perm.value)}
									disabled={saving}
								/>
								<span class="text-sm">{perm.label}</span>
							</label>
						{/each}
					</div>

					<!-- Outgoings -->
					<div class="space-y-2">
						<h4 class="text-sm font-medium text-muted-foreground">Outgoings</h4>
						{#each availablePermissions.filter( (p) => p.value.startsWith('outgoings.') ) as perm (perm.value)}
							<label class="flex cursor-pointer items-center gap-2">
								<Checkbox
									checked={permissions.includes(perm.value)}
									onCheckedChange={() => togglePermission(perm.value)}
									disabled={saving}
								/>
								<span class="text-sm">{perm.label}</span>
							</label>
						{/each}
					</div>

					<!-- Requests -->
					<div class="space-y-2 sm:col-span-2">
						<h4 class="text-sm font-medium text-muted-foreground">Requests</h4>
						<div class="grid gap-2 sm:grid-cols-3">
							{#each availablePermissions.filter( (p) => p.value.startsWith('requests.') ) as perm (perm.value)}
								<label class="flex cursor-pointer items-center gap-2">
									<Checkbox
										checked={permissions.includes(perm.value)}
										onCheckedChange={() => togglePermission(perm.value)}
										disabled={saving}
									/>
									<span class="text-sm">{perm.label}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)} disabled={saving}>
					Cancel
				</Button>
				<Button type="submit" disabled={saving}>
					{#if saving}
						<LoaderCircleIcon class="size-4 animate-spin" />
						{isEditing ? 'Updating...' : 'Creating...'}
					{:else}
						{isEditing ? 'Update User' : 'Create User'}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
