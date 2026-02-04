/**
 * Part Movements API service
 */

import api from './client.js';
import type { PartMovementResponse, PaginatedResponse, PaginationParams } from './types.js';

export interface MovementsListParams extends PaginationParams {
	part_id?: string;
	type?: 'in' | 'out';
	reference_type?: 'Receivings' | 'Outgoings';
	start_date?: string;
	end_date?: string;
}

export async function getMovements(
	params?: MovementsListParams
): Promise<PaginatedResponse<PartMovementResponse>> {
	return api.get<PaginatedResponse<PartMovementResponse>>(
		'/movements',
		params as Record<string, string | number | boolean>
	);
}

export async function getMovementsByPart(
	partId: string,
	params?: PaginationParams
): Promise<PaginatedResponse<PartMovementResponse>> {
	return api.get<PaginatedResponse<PartMovementResponse>>(
		`/parts/${partId}/movements`,
		params as Record<string, string | number | boolean>
	);
}
