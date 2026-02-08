/**
 * TypeScript types matching FastAPI Pydantic schemas
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Paginated response wrapper - matches backend PaginatedResponse[T]
 */
export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
}

/**
 * Common pagination parameters
 */
export interface PaginationParams {
	page?: number;
	limit?: number;
}

// ============================================================================
// USER TYPES
// ============================================================================

export type UserRole = 'admin' | 'inventory' | 'delivery';

export interface UserResponse {
	id: string;
	name: string;
	email: string;
	role?: UserRole;
	permissions: string[];
	email_verified_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface UserCreate {
	name: string;
	email: string;
	password: string;
	role?: UserRole;
	permissions?: string[];
}

export interface UserUpdate {
	name?: string;
	email?: string;
	role?: UserRole;
	permissions?: string[];
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface LoginRequest {
	email: string;
	password: string;
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	user: UserResponse;
}

// ============================================================================
// PART TYPES
// ============================================================================

export interface PartResponse {
	id: string;
	part_number: string;
	part_name: string;
	customer_code: string | null;
	supplier_code: string | null;
	model: string | null;
	variant: string | null;
	standard_packing: number;
	stock: number;
	address: string | null;
	is_active: boolean;
	stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
	created_at: string;
	updated_at: string;
}

export interface PartCreate {
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
}

export interface PartUpdate {
	part_number?: string;
	part_name?: string;
	customer_code?: string;
	supplier_code?: string;
	model?: string;
	variant?: string;
	standard_packing?: number;
	address?: string;
	is_active?: boolean;
}

export interface PartMovementResponse {
	id: string;
	part_id: string;
	stock_before: number;
	type: 'in' | 'out';
	qty: number;
	stock_after: number;
	reference_type: 'Receivings' | 'Outgoings';
	reference_id: string;
	created_at: string;
}

// ============================================================================
// RECEIVING TYPES
// ============================================================================

export interface ReceivingItemCreate {
	part_id: string;
	qty: number;
}

export interface ReceivingItemResponse {
	id: string;
	receiving_id: string;
	part_id: string;
	qty: number;
	created_at: string;
	updated_at: string;
}

export interface ReceivingCreate {
	doc_number: string;
	received_by: string;
	received_at: string;
	notes?: string;
	items: ReceivingItemCreate[];
}

export interface ReceivingUpdate {
	doc_number?: string;
	notes?: string;
	items?: ReceivingItemCreate[];
}

export interface ReceivingResponse {
	id: string;
	doc_number: string;
	received_by: string;
	received_at: string;
	status: 'draft' | 'completed' | 'cancelled';
	notes: string | null;
	is_gr: boolean;
	total_items: number;
	items: ReceivingItemResponse[];
	created_at: string;
	updated_at: string;
}

// ============================================================================
// OUTGOING TYPES
// ============================================================================

export interface OutgoingItemCreate {
	part_id: string;
	qty: number;
}

export interface OutgoingItemResponse {
	id: string;
	outgoing_id: string;
	part_id: string;
	qty: number;
	created_at: string;
	updated_at: string;
}

export interface OutgoingCreate {
	doc_number: string;
	issued_by: string;
	issued_at: string;
	notes?: string;
	items: OutgoingItemCreate[];
}

export interface OutgoingUpdate {
	doc_number?: string;
	notes?: string;
	items?: OutgoingItemCreate[];
}

export interface OutgoingResponse {
	id: string;
	doc_number: string;
	issued_by: string;
	issued_at: string;
	status: 'draft' | 'completed' | 'cancelled';
	notes: string | null;
	is_gi: boolean;
	total_items: number;
	items: OutgoingItemResponse[];
	created_at: string;
	updated_at: string;
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface RequestListCreate {
	part_id: string;
	qty: number;
	is_urgent?: boolean;
}

export interface RequestListResponse {
	id: string;
	request_id: string;
	part_id: string;
	qty: number;
	is_urgent: boolean;
	is_supplied: boolean;
	created_at: string;
	updated_at: string;
}

export interface RequestCreate {
	request_number: string;
	requested_by: string;
	requested_at: string;
	destination?: string;
	notes?: string;
	items: RequestListCreate[];
}

export interface RequestUpdate {
	request_number?: string;
	destination?: string;
	notes?: string;
	items?: RequestListCreate[];
}

export interface RequestResponse {
	id: string;
	request_number: string;
	requested_by: string;
	requested_by_name: string | null;
	requested_at: string;
	destination: string | null;
	status: 'draft' | 'completed' | 'cancelled';
	notes: string | null;
	items: RequestListResponse[];
	created_at: string;
	updated_at: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface PartsStats {
	total: number;
	active: number;
	inStock: number;
	lowStock: number;
	outOfStock: number;
}

export interface ReceivingsStats {
	total: number;
	draft: number;
	completed: number;
	pendingGR: number;
}

export interface OutgoingsStats {
	total: number;
	draft: number;
	completed: number;
	pendingGI: number;
}

export interface RequestsStats {
	total: number;
	draft: number;
	completed: number;
}

export interface DashboardStats {
	parts: PartsStats;
	receivings: ReceivingsStats;
	outgoings: OutgoingsStats;
	requests: RequestsStats;
}

// Raw API response types (snake_case from backend)
export interface RawPartsStats {
	total: number;
	active: number;
	in_stock: number;
	low_stock: number;
	out_of_stock: number;
}

export interface RawReceivingsStats {
	total: number;
	draft: number;
	completed: number;
	pending_gr: number;
}

export interface RawOutgoingsStats {
	total: number;
	draft: number;
	completed: number;
	pending_gi: number;
}

export interface RawRequestsStats {
	total: number;
	draft: number;
	completed: number;
}

export interface RawDashboardStats {
	parts: RawPartsStats;
	receivings: RawReceivingsStats;
	outgoings: RawOutgoingsStats;
	requests: RawRequestsStats;
}

export interface RawDashboardResponse {
	stats: RawDashboardStats;
	recent_receivings: ReceivingResponse[];
	recent_outgoings: OutgoingResponse[];
	low_stock_parts: PartResponse[];
	pending_requests: RequestResponse[];
	recent_movements: PartMovementResponse[];
}

export interface DashboardResponse {
	stats: DashboardStats;
	recent_receivings: ReceivingResponse[];
	recent_outgoings: OutgoingResponse[];
	low_stock_parts: PartResponse[];
	pending_requests: RequestResponse[];
	recent_movements: PartMovementResponse[];
}
