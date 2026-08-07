/**
 * Memory layer domain types.
 *
 * The schema mirrors CockroachDB tables. The atomic-write invariant here is
 * the product: each memory record is stored TOGETHER with its embedding in one
 * transaction, so agents and humans never observe partial memory.
 */

export type EntityType = 'notification' | 'incident' | 'runbook' | 'decision' | 'note';
export type Visibility = 'public' | 'private';
export type MemoryKind = 'pattern' | 'surprise' | 'digest' | 'insight';

export interface MemoryRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  content: string;
  /** 1024-dim embedding (CockroachDB VECTOR(1024)) */
  embedding: number[] | null;
  createdAt: Date;
}

export interface Consolidation {
  id: string;
  kind: MemoryKind;
  summary: string;
  sourceEntityIds: string[];
  surpriseScore: number | null;
  frequency: number;
  recency: Date | null;
}

/** A decision an agent wants a human to approve or deny before acting. */
export interface ApprovalRequest {
  id: string;
  body: string;
  correlationId: string;
  responseStatus: 'pending' | 'approved' | 'denied' | 'expired';
  callbackUrl?: string;
}