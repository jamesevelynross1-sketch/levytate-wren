type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

export class LevyTateSupabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevyTateSupabaseError";
  }
}

export function getLevyTateSupabaseConfig(): SupabaseServiceConfig | null {
  const url = normaliseSupabaseUrl(readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const serviceRoleKey = readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) return null;

  return {
    url,
    serviceRoleKey,
  };
}

export async function supabaseSelect<T>(
  config: SupabaseServiceConfig,
  table: string,
  query: URLSearchParams,
) {
  return supabaseFetchJson<T[]>(
    config,
    `${table}?${query.toString()}`,
    { cache: "no-store" },
  );
}

export async function collectPaginatedRows<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  options: { pageSize?: number; maxRows?: number } = {},
) {
  const pageSize = options.pageSize ?? 1000;
  const maxRows = options.maxRows ?? 100_000;
  const rows: T[] = [];

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await fetchPage(offset, pageSize);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }

  throw new LevyTateSupabaseError(`Supabase pagination exceeded the ${maxRows} row safety limit.`);
}

export async function supabaseSelectAll<T>(
  config: SupabaseServiceConfig,
  table: string,
  query: URLSearchParams,
  options: { pageSize?: number; maxRows?: number } = {},
) {
  const base = new URLSearchParams(query);
  base.delete("limit");
  base.delete("offset");
  return collectPaginatedRows<T>(async (offset, limit) => {
    const page = new URLSearchParams(base);
    page.set("limit", String(limit));
    page.set("offset", String(offset));
    return supabaseSelect<T>(config, table, page);
  }, options);
}

export async function supabaseInsert<T>(
  config: SupabaseServiceConfig,
  table: string,
  body: unknown,
  options: { prefer?: string; query?: string } = {},
) {
  return supabaseFetchJson<T[]>(
    config,
    `${table}${options.query ? `?${options.query}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        Prefer: options.prefer ?? "return=representation",
      },
    },
  );
}

export async function supabaseUpdate<T>(
  config: SupabaseServiceConfig,
  table: string,
  query: string,
  body: unknown,
  options: { prefer?: string } = {},
) {
  return supabaseFetchJson<T[]>(
    config,
    `${table}?${query}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: {
        Prefer: options.prefer ?? "return=representation",
      },
    },
  );
}

export async function supabaseDelete(
  config: SupabaseServiceConfig,
  table: string,
  query: string,
) {
  return supabaseFetchRaw(config, `${table}?${query}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function supabaseFetchJson<T>(
  config: SupabaseServiceConfig,
  path: string,
  init: RequestInit = {},
) {
  const response = await supabaseFetchRaw(config, path, init);
  if (!response.ok) {
    throw new LevyTateSupabaseError(await formatSupabaseError(response));
  }

  const text = await response.text();
  if (!text.trim()) {
    return [] as T;
  }

  return JSON.parse(text) as T;
}

export async function supabaseFetchRaw(
  config: SupabaseServiceConfig,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: init.cache ?? "no-store",
  });

  return response;
}

export async function formatSupabaseError(response: Response) {
  try {
    const payload = (await response.json()) as {
      code?: string;
      details?: string;
      hint?: string;
      message?: string;
    };

    return [payload.code, payload.message, payload.details, payload.hint]
      .filter(Boolean)
      .join(" / ") || `Supabase request failed with ${response.status}`;
  } catch {
    return `Supabase request failed with ${response.status}`;
  }
}

export function readRuntimeEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value === '""' || value === "''") return "";
  return value.replace(/^["']|["']$/g, "").trim();
}

export function normaliseSupabaseUrl(value: string) {
  return value
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/$/, "");
}

