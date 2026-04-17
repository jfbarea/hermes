import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import {
  buildPrompt,
  fetchGoogleDoc,
  loadExamples,
  SYSTEM_INSTRUCTIONS,
} from "../lib/prompt-builder";
import {
  FETCH_TIMEOUT_MS,
  GOOGLE_DOC_EXPORT_URL,
  MAX_BODY_CHARS,
} from "../lib/constants";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const FAKE_CONTEXT = "Soy el tutor PIR. Llevo 5 años de experiencia.";
const FAKE_DOC_CONTEXT = "Contexto cargado desde Google Doc.";
const FAKE_EXAMPLE_1 =
  "## EMAIL RECIBIDO\nHola\n\n## MI RESPUESTA\nHola, gracias por escribir.";
const FAKE_EXAMPLE_2 =
  "## EMAIL RECIBIDO\n¿Cuántas plazas hay?\n\n## MI RESPUESTA\nDepende de la convocatoria.";

/** Configura el mock de fs para devolver los ejemplos dados. */
function mockFs(examples: string[] = [FAKE_EXAMPLE_1, FAKE_EXAMPLE_2]) {
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue(
    examples.map((_, i) => `example_0${i + 1}.md`) as unknown as ReturnType<
      typeof fs.readdirSync
    >
  );
  vi.mocked(fs.readFileSync).mockImplementation(
    (p: fs.PathOrFileDescriptor) => {
      const name = String(p).split("/").pop()!;
      const idx = parseInt(name.replace("example_0", "").replace(".md", "")) - 1;
      if (name === "context.md") return FAKE_CONTEXT;
      return examples[idx] ?? "";
    }
  );
}

/** Configura fetch para que tenga éxito con FAKE_DOC_CONTEXT. */
function mockFetchSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () => FAKE_DOC_CONTEXT,
    })
  );
}

/** Configura fetch para que falle. */
function mockFetchFailure(error: Error = new Error("network error")) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// buildPrompt — estructura de retorno
// ---------------------------------------------------------------------------

describe("buildPrompt — return type", () => {
  it("returns an object with systemMessage, userMessage and contextSource", async () => {
    mockFetchSuccess();
    mockFs();
    const result = await buildPrompt("Email de prueba");
    expect(result).toHaveProperty("systemMessage");
    expect(result).toHaveProperty("userMessage");
    expect(result).toHaveProperty("contextSource");
  });

  it("systemMessage and userMessage are strings", async () => {
    mockFetchSuccess();
    mockFs();
    const { systemMessage, userMessage } = await buildPrompt("Hola");
    expect(typeof systemMessage).toBe("string");
    expect(typeof userMessage).toBe("string");
  });

  it("systemMessage is not empty", async () => {
    mockFetchSuccess();
    mockFs();
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage.trim()).not.toBe("");
  });

  it("userMessage is not empty", async () => {
    mockFetchSuccess();
    mockFs();
    const { userMessage } = await buildPrompt("Hola");
    expect(userMessage.trim()).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// contextSource
// ---------------------------------------------------------------------------

describe("buildPrompt — contextSource", () => {
  it("returns 'google_doc' when fetch succeeds", async () => {
    mockFetchSuccess();
    mockFs();
    const { contextSource } = await buildPrompt("Hola");
    expect(contextSource).toBe("google_doc");
  });

  it("returns 'fallback' when fetch fails", async () => {
    mockFetchFailure();
    mockFs();
    const { contextSource } = await buildPrompt("Hola");
    expect(contextSource).toBe("fallback");
  });

  it("uses Google Doc content when fetch succeeds", async () => {
    mockFetchSuccess();
    mockFs();
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage).toContain(FAKE_DOC_CONTEXT);
  });

  it("uses local context.md content when fetch fails", async () => {
    mockFetchFailure();
    mockFs();
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage).toContain(FAKE_CONTEXT);
  });

  it("returns 'fallback' on timeout (AbortError)", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    mockFetchFailure(abortError);
    mockFs();
    const { contextSource } = await buildPrompt("Hola");
    expect(contextSource).toBe("fallback");
  });

  it("returns 'fallback' on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 })
    );
    mockFs();
    const { contextSource } = await buildPrompt("Hola");
    expect(contextSource).toBe("fallback");
  });

  it("fallback context is empty string when context.md does not exist", async () => {
    mockFetchFailure();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { systemMessage, contextSource } = await buildPrompt("Hola");
    expect(contextSource).toBe("fallback");
    expect(typeof systemMessage).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// fetchGoogleDoc
// ---------------------------------------------------------------------------

describe("fetchGoogleDoc", () => {
  it("calls the correct export URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "contenido",
    });
    vi.stubGlobal("fetch", mockFetch);
    await fetchGoogleDoc();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe(GOOGLE_DOC_EXPORT_URL);
  });

  it("returns the response text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "mi contexto" })
    );
    const result = await fetchGoogleDoc();
    expect(result).toBe("mi contexto");
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 })
    );
    await expect(fetchGoogleDoc()).rejects.toThrow("HTTP 403");
  });

  it("throws when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
    await expect(fetchGoogleDoc()).rejects.toThrow("no network");
  });
});

// ---------------------------------------------------------------------------
// loadExamples
// ---------------------------------------------------------------------------

describe("loadExamples", () => {
  it("returns examples sorted by filename", () => {
    mockFs([FAKE_EXAMPLE_1, FAKE_EXAMPLE_2]);
    const examples = loadExamples();
    expect(examples).toHaveLength(2);
    expect(examples[0]).toBe(FAKE_EXAMPLE_1);
    expect(examples[1]).toBe(FAKE_EXAMPLE_2);
  });

  it("returns empty array when examples dir does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(loadExamples()).toEqual([]);
  });

  it("returns empty array when dir has no .md files", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(
      [] as unknown as ReturnType<typeof fs.readdirSync>
    );
    expect(loadExamples()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// systemMessage content
// ---------------------------------------------------------------------------

describe("buildPrompt — systemMessage content", () => {
  it("contains all examples", async () => {
    mockFetchSuccess();
    mockFs([FAKE_EXAMPLE_1, FAKE_EXAMPLE_2]);
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage).toContain(FAKE_EXAMPLE_1);
    expect(systemMessage).toContain(FAKE_EXAMPLE_2);
  });

  it("labels examples sequentially", async () => {
    mockFetchSuccess();
    mockFs([FAKE_EXAMPLE_1, FAKE_EXAMPLE_2]);
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage).toContain("Ejemplo 1");
    expect(systemMessage).toContain("Ejemplo 2");
  });

  it("contains SYSTEM_INSTRUCTIONS", async () => {
    mockFetchSuccess();
    mockFs();
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage).toContain(SYSTEM_INSTRUCTIONS);
  });

  it("still valid with no examples", async () => {
    mockFetchSuccess();
    mockFs([]);
    const { systemMessage } = await buildPrompt("Hola");
    expect(systemMessage).not.toContain("Ejemplo 1");
    expect(systemMessage).toContain(FAKE_DOC_CONTEXT);
  });
});

// ---------------------------------------------------------------------------
// userMessage content
// ---------------------------------------------------------------------------

describe("buildPrompt — userMessage content", () => {
  it("contains the original email when short", async () => {
    mockFetchSuccess();
    mockFs();
    const email = "Este es un email corto.";
    const { userMessage } = await buildPrompt(email);
    expect(userMessage).toContain(email);
  });

  it("contains a draft instruction verb", async () => {
    mockFetchSuccess();
    mockFs();
    const { userMessage } = await buildPrompt("Hola");
    expect(userMessage.toLowerCase()).toMatch(/redacta|respuesta/);
  });
});

// ---------------------------------------------------------------------------
// truncation
// ---------------------------------------------------------------------------

describe("buildPrompt — email truncation", () => {
  it("truncates emails longer than MAX_BODY_CHARS", async () => {
    mockFetchSuccess();
    mockFs();
    const long = "x".repeat(MAX_BODY_CHARS + 500);
    const { userMessage } = await buildPrompt(long);
    expect(userMessage).not.toContain("x".repeat(MAX_BODY_CHARS + 1));
  });

  it("truncates to exactly MAX_BODY_CHARS characters", async () => {
    mockFetchSuccess();
    mockFs();
    const long = "A".repeat(MAX_BODY_CHARS + 1000);
    const { userMessage } = await buildPrompt(long);
    expect(userMessage).toContain("A".repeat(MAX_BODY_CHARS));
    expect(userMessage).not.toContain("A".repeat(MAX_BODY_CHARS + 1));
  });

  it("does not truncate emails shorter than MAX_BODY_CHARS", async () => {
    mockFetchSuccess();
    mockFs();
    const short = "B".repeat(MAX_BODY_CHARS - 100);
    const { userMessage } = await buildPrompt(short);
    expect(userMessage).toContain(short);
  });

  it("does not truncate emails of exactly MAX_BODY_CHARS", async () => {
    mockFetchSuccess();
    mockFs();
    const exact = "C".repeat(MAX_BODY_CHARS);
    const { userMessage } = await buildPrompt(exact);
    expect(userMessage).toContain(exact);
  });
});

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("MAX_BODY_CHARS is 6000", () => {
    expect(MAX_BODY_CHARS).toBe(6_000);
  });

  it("FETCH_TIMEOUT_MS is positive", () => {
    expect(FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("GOOGLE_DOC_EXPORT_URL contains 'export'", () => {
    expect(GOOGLE_DOC_EXPORT_URL).toContain("export");
  });

  it("GOOGLE_DOC_EXPORT_URL requests txt format", () => {
    expect(GOOGLE_DOC_EXPORT_URL).toContain("format=txt");
  });

  it("GOOGLE_DOC_EXPORT_URL reads CONTEXT_GOOGLE_DOC_ID from env", () => {
    // El ID en el entorno de test puede ser '' pero la URL debe tener la forma correcta
    expect(GOOGLE_DOC_EXPORT_URL).toMatch(
      /^https:\/\/docs\.google\.com\/document\/d\/.*\/export\?format=txt$/
    );
  });
});
