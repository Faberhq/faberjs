export interface RequestTrace {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
  readonly startedAt: string;
  readonly queryCount: number;
  readonly memoryDeltaKb: number;
}

export interface SqlTrace {
  readonly sql: string;
  readonly bindings: readonly unknown[];
  readonly durationMs: number;
  readonly requestId: string | null;
  readonly executedAt: string;
}

export interface EventTrace {
  readonly id: string;
  readonly eventType: string;
  readonly firedAt: string;
  readonly durationMs: number;
}

export interface AgentTrace {
  readonly id: string;
  readonly agentName: string;
  readonly input: string;
  readonly output: string;
  readonly durationMs: number;
  readonly tokenUsage: number;
  readonly firedAt: string;
}

export interface DevToolsConfig {
  readonly enabled: boolean;
  readonly path: string;
  readonly slowQueryThreshold: number;
  readonly maxRequests: number;
  readonly maxQueries: number;
  readonly maxEvents: number;
  readonly maxAgentTraces: number;
}

export const DEFAULT_CONFIG: DevToolsConfig = {
  enabled: process.env['APP_ENV'] !== 'production',
  path: '/_faber',
  slowQueryThreshold: 100,
  maxRequests: 200,
  maxQueries: 500,
  maxEvents: 500,
  maxAgentTraces: 100,
};
