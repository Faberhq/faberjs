export interface SessionDriver {
  read(id: string): Promise<Record<string, unknown>>;
  write(id: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void>;
  destroy(id: string): Promise<void>;
  gc(maxLifetimeSeconds: number): Promise<void>;
}

export interface SessionCookieOptions {
  readonly name?: string;
  readonly ttlMinutes?: number;
  readonly path?: string;
  readonly domain?: string;
  readonly secure?: boolean;
  readonly httpOnly?: boolean;
  readonly sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface SessionConfig {
  readonly driver?: 'memory' | 'file';
  readonly cookie?: SessionCookieOptions;
  readonly ttlMinutes?: number;
  readonly files?: {
    readonly path?: string;
  };
}

export interface CsrfOptions {
  readonly except?: string[];
  readonly originOnly?: boolean;
  readonly allowSameSite?: boolean;
}
