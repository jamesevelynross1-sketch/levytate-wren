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
  const url = readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) return null;

  return {
    url: url.replace(/\/$/, ""),
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
  return (await response.json()) as T;
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
  if (!value || value === "\"\"" || value === "''") return "";
  return value.replace(/^["']|["']$/g, "").trim();
}
