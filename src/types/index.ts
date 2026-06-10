// Optional canonical evidence lane shapes. StateMirror stores these as ordinary
// state_payload JSON and does not require, validate, interpret, or enforce them.
export interface PlanEvidence {
  evidence_type: 'plan_evidence';
  plan?: string;
  status?: string;
  entitlements?: string[];
  source?: string;
  source_version?: string;
  read_at?: string;
  source_updated_at?: string;
  [field: string]: unknown;
}

export interface DenialEvidence {
  evidence_type: 'denial_evidence';
  signal?: 'denial_present' | 'denial_absent' | 'denial_unknown';
  reason_code?: string;
  scope?: string;
  source?: string;
  source_version?: string;
  read_at?: string;
  source_updated_at?: string;
  [field: string]: unknown;
}

export interface ExpiryEvidence {
  evidence_type: 'expiry_evidence';
  signal?: 'expired' | 'not_expired' | 'expiry_unknown';
  expires_at?: string;
  cause_code?: string;
  renewable?: boolean;
  source?: string;
  source_version?: string;
  read_at?: string;
  source_updated_at?: string;
  [field: string]: unknown;
}

export interface SnapshotInput {
  evidence_ref?: string;
  evidence_type?: string;
  /** @deprecated use evidence_ref */
  decision_ref?: string;
  /** @deprecated use evidence_type */
  decision_type?: string;
  captured_at: string;
  state_payload: Record<string, unknown>;
  source_system?: string;
  source_version?: string;
  correlation_id?: string;
}

export interface SnapshotRecord {
  snapshot_id: string;
  sequence_num: string;
  evidence_ref: string;
  evidence_type: string;
  captured_at: Date;
  received_at: Date;
  state_payload: Record<string, unknown>;
  payload_bytes: number;
  payload_hash: Buffer;
  prev_chain_hash: Buffer | null;
  chain_hash: Buffer;
  source_system: string | null;
  source_version: string | null;
  correlation_id: string | null;
}

export interface SnapshotResponse {
  component: 'StateMirror';
  version: string;
  warnings: string[];
  snapshot_id: string;
  sequence_num: number;
  received_at: string;
  payload_hash: string;
  chain_hash: string;
}

export interface SnapshotFullResponse {
  component: 'StateMirror';
  version: string;
  warnings: string[];
  snapshot_id: string;
  sequence_num: number;
  evidence_ref: string;
  evidence_type: string;
  captured_at: string;
  received_at: string;
  state_payload: Record<string, unknown>;
  payload_hash: string;
  chain_hash: string;
  source_system: string | null;
  source_version: string | null;
  correlation_id: string | null;
  integrity: {
    payload_valid: boolean;
    chain_valid: boolean;
  };
}

export interface IntegrityVerifyInput {
  from_sequence: number;
  to_sequence: number;
}

export interface IntegrityVerifyResponse {
  component: 'StateMirror';
  version: string;
  valid: boolean;
  checked_count: number;
  first_sequence: number;
  last_sequence: number;
  elapsed_ms: number;
  break_at_sequence?: number;
  expected_prev_hash?: string;
  actual_prev_hash?: string;
}

export interface HealthResponse {
  component: 'StateMirror';
  version: string;
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  latest_sequence: number | null;
  latest_received_at: string | null;
}

export interface IdempotencyRecord {
  key_hash: Buffer;
  snapshot_id: string;
  request_hash: Buffer;
  created_at: Date;
  expires_at: Date;
}
