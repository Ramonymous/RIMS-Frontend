<script lang="ts">
	import { createPart } from '$lib/api/parts.js';
	import type { PartCreate } from '$lib/api/types.js';
	import type { ApiError } from '$lib/api/index.js';
	import { toast } from 'svelte-sonner';
	import * as XLSX from 'xlsx';

	// Components
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	// Icons
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import FileSpreadsheetIcon from '@tabler/icons-svelte/icons/file-spreadsheet';
	import UploadIcon from '@tabler/icons-svelte/icons/upload';
	import DownloadIcon from '@tabler/icons-svelte/icons/download';
	import XIcon from '@tabler/icons-svelte/icons/x';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import AlertTriangleIcon from '@tabler/icons-svelte/icons/alert-triangle';

	interface Props {
		open: boolean;
		onSuccess: () => void;
	}

	let { open = $bindable(), onSuccess }: Props = $props();

	interface ImportRow {
		part_number: string;
		part_name: string;
		customer_code?: string;
		supplier_code?: string;
		model?: string;
		variant?: string;
		standard_packing?: number;
		stock?: number;
		address?: string;
		is_active?: boolean;
		// Import status
		status: 'pending' | 'success' | 'error';
		error?: string;
	}

	let fileInput = $state<HTMLInputElement | null>(null);
	let parsedData = $state<ImportRow[]>([]);
	let importing = $state(false);
	let importProgress = $state(0);

	const validRows = $derived(
		parsedData.filter((row) => row.status === 'pending' && row.part_number && row.part_name)
	);
	const successRows = $derived(parsedData.filter((row) => row.status === 'success'));
	const errorRows = $derived(parsedData.filter((row) => row.status === 'error'));

	function downloadTemplate() {
		const templateData = [
			{
				part_number: 'PN-001',
				part_name: 'Example Part',
				customer_code: 'CUST-001',
				supplier_code: 'SUP-001',
				model: 'Model A',
				variant: 'V1',
				standard_packing: 10,
				stock: 100,
				address: 'Rack A, Shelf 1',
				is_active: 'TRUE'
			}
		];

		const wb = XLSX.utils.book_new();
		const ws = XLSX.utils.json_to_sheet(templateData);

		// Set column widths
		ws['!cols'] = [
			{ wch: 15 }, // part_number
			{ wch: 20 }, // part_name
			{ wch: 15 }, // customer_code
			{ wch: 15 }, // supplier_code
			{ wch: 12 }, // model
			{ wch: 10 }, // variant
			{ wch: 18 }, // standard_packing
			{ wch: 10 }, // stock
			{ wch: 20 }, // address
			{ wch: 10 } // is_active
		];

		XLSX.utils.book_append_sheet(wb, ws, 'Parts');
		XLSX.writeFile(wb, 'parts_import_template.xlsx');
		toast.success('Template downloaded', {
			description: 'Fill in the template and upload it to import parts.'
		});
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'application/vnd.ms-excel'
		];
		if (!validTypes.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
			toast.error('Invalid file type', {
				description: 'Please upload an Excel file (.xlsx or .xls)'
			});
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const data = new Uint8Array(event.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: 'array' });
				const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
				const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

				if (jsonData.length === 0) {
					toast.error('Empty file', { description: 'The Excel file contains no data.' });
					return;
				}

				parsedData = jsonData.map((row) => ({
					part_number: String(row.part_number ?? '').trim(),
					part_name: String(row.part_name ?? '').trim(),
					customer_code: row.customer_code ? String(row.customer_code).trim() : undefined,
					supplier_code: row.supplier_code ? String(row.supplier_code).trim() : undefined,
					model: row.model ? String(row.model).trim() : undefined,
					variant: row.variant ? String(row.variant).trim() : undefined,
					standard_packing: row.standard_packing ? Number(row.standard_packing) : 1,
					stock: row.stock ? Number(row.stock) : 0,
					address: row.address ? String(row.address).trim() : undefined,
					is_active:
						row.is_active === undefined
							? true
							: String(row.is_active).toLowerCase() === 'true' || String(row.is_active) === '1',
					status: 'pending' as const
				}));

				toast.success('File parsed', {
					description: `Found ${parsedData.length} rows to import.`
				});
			} catch (_err) {
				// Changed from 'err' to '_err'
				toast.error('Failed to parse file', {
					description: 'Please ensure the file is a valid Excel file.'
				});
			}
		};
		reader.readAsArrayBuffer(file);
	}

	function clearData() {
		parsedData = [];
		if (fileInput) {
			fileInput.value = '';
		}
	}

	async function startImport() {
		if (validRows.length === 0) {
			toast.error('No valid rows', {
				description: 'Please ensure at least one row has part_number and part_name.'
			});
			return;
		}

		importing = true;
		importProgress = 0;

		for (let i = 0; i < parsedData.length; i++) {
			const row = parsedData[i];

			// Skip rows without required fields
			if (!row.part_number || !row.part_name) {
				parsedData[i] = { ...row, status: 'error', error: 'Missing part_number or part_name' };
				continue;
			}

			// Skip already processed rows
			if (row.status !== 'pending') continue;

			try {
				const createData: PartCreate = {
					part_number: row.part_number,
					part_name: row.part_name,
					customer_code: row.customer_code,
					supplier_code: row.supplier_code,
					model: row.model,
					variant: row.variant,
					standard_packing: row.standard_packing,
					stock: row.stock,
					address: row.address,
					is_active: row.is_active
				};
				await createPart(createData);
				parsedData[i] = { ...row, status: 'success' };
			} catch (e) {
				const error = e as ApiError;
				parsedData[i] = { ...row, status: 'error', error: error.detail };
			}

			importProgress = Math.round(((i + 1) / parsedData.length) * 100);
		}

		importing = false;

		const successCount = parsedData.filter((r) => r.status === 'success').length;
		const errorCount = parsedData.filter((r) => r.status === 'error').length;

		if (errorCount === 0) {
			toast.success('Import complete', {
				description: `Successfully imported ${successCount} parts.`
			});
			onSuccess();
		} else {
			toast.warning('Import completed with errors', {
				description: `Imported ${successCount} parts, ${errorCount} failed.`
			});
		}
	}

	function closeDialog() {
		if (!importing) {
			open = false;
			clearData();
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && closeDialog()}>
	<Dialog.Content class="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>Import Parts from Excel</Dialog.Title>
			<Dialog.Description>
				Upload an Excel file (.xlsx) to bulk import parts into the system.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 space-y-4 overflow-y-auto">
			{#if parsedData.length === 0}
				<!-- Upload area -->
				<div class="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8">
					<FileSpreadsheetIcon class="size-12 text-muted-foreground" />
					<div class="text-center">
						<p class="text-lg font-medium">Upload Excel File</p>
						<p class="text-sm text-muted-foreground">Supports .xlsx and .xls files</p>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" onclick={downloadTemplate}>
							<DownloadIcon class="size-4" />
							Download Template
						</Button>
						<Button onclick={() => fileInput?.click()}>
							<UploadIcon class="size-4" />
							Select File
						</Button>
					</div>
					<input
						bind:this={fileInput}
						type="file"
						accept=".xlsx,.xls"
						class="hidden"
						onchange={handleFileSelect}
					/>
				</div>

				<!-- Template instructions -->
				<div class="rounded-lg bg-muted/50 p-4">
					<h4 class="mb-2 font-medium">Required Columns:</h4>
					<ul class="space-y-1 text-sm text-muted-foreground">
						<li><strong>part_number</strong> - Unique part identifier (required)</li>
						<li><strong>part_name</strong> - Name of the part (required)</li>
						<li><strong>customer_code</strong> - Customer's part code (optional)</li>
						<li><strong>supplier_code</strong> - Supplier's part code (optional)</li>
						<li><strong>model</strong> - Model name (optional)</li>
						<li><strong>variant</strong> - Variant code (optional)</li>
						<li><strong>standard_packing</strong> - Standard packing quantity (default: 1)</li>
						<li><strong>stock</strong> - Initial stock quantity (default: 0)</li>
						<li><strong>address</strong> - Storage location (optional)</li>
						<li><strong>is_active</strong> - TRUE or FALSE (default: TRUE)</li>
					</ul>
				</div>
			{:else}
				<!-- Preview table -->
				<div class="flex items-center justify-between">
					<div class="flex gap-2">
						<Badge variant="outline">{parsedData.length} total</Badge>
						<Badge variant="secondary">{validRows.length} pending</Badge>
						{#if successRows.length > 0}
							<Badge variant="default">{successRows.length} success</Badge>
						{/if}
						{#if errorRows.length > 0}
							<Badge variant="destructive">{errorRows.length} failed</Badge>
						{/if}
					</div>
					<Button variant="outline" size="sm" onclick={clearData} disabled={importing}>
						<XIcon class="size-4" />
						Clear
					</Button>
				</div>

				{#if importing}
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span>Importing...</span>
							<span>{importProgress}%</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-muted">
							<div
								class="h-full bg-primary transition-all duration-300"
								style="width: {importProgress}%"
							></div>
						</div>
					</div>
				{/if}

				<div class="max-h-80 overflow-auto rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-12">Status</Table.Head>
								<Table.Head>Part Number</Table.Head>
								<Table.Head>Part Name</Table.Head>
								<Table.Head class="hidden md:table-cell">Stock</Table.Head>
								<Table.Head class="hidden lg:table-cell">Error</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each parsedData as row, i (i)}
								<Table.Row
									class="{row.status === 'success' ? 'bg-green-50' : ''} {row.status === 'error'
										? 'bg-red-50'
										: ''}"
								>
									<Table.Cell>
										{#if row.status === 'pending'}
											<div class="size-4 rounded-full border-2 border-muted-foreground"></div>
										{:else if row.status === 'success'}
											<CheckIcon class="size-4 text-green-600" />
										{:else}
											<AlertTriangleIcon class="size-4 text-destructive" />
										{/if}
									</Table.Cell>
									<Table.Cell class="font-medium">
										{row.part_number || '-'}
									</Table.Cell>
									<Table.Cell>{row.part_name || '-'}</Table.Cell>
									<Table.Cell class="hidden md:table-cell">{row.stock ?? 0}</Table.Cell>
									<Table.Cell class="hidden text-sm text-destructive lg:table-cell">
										{row.error ?? ''}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/if}
		</div>

		<Dialog.Footer class="mt-4">
			<Button type="button" variant="outline" onclick={closeDialog} disabled={importing}>
				{parsedData.length > 0 && successRows.length > 0 ? 'Close' : 'Cancel'}
			</Button>
			{#if parsedData.length > 0 && validRows.length > 0}
				<Button onclick={startImport} disabled={importing}>
					{#if importing}
						<LoaderCircleIcon class="size-4 animate-spin" />
						Importing...
					{:else}
						<UploadIcon class="size-4" />
						Import {validRows.length} Parts
					{/if}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
