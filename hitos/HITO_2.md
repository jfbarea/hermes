# Hito 2 — Frontend Next.js + shadcn/ui

**Objetivo:** interfaz web moderna donde el tutor pega un email y obtiene el borrador de respuesta.

---

## Stack

- **Framework**: Next.js 15 App Router (TypeScript)
- **Estilos**: Tailwind CSS v4 + shadcn/ui
- **Iconos**: lucide-react

---

## Setup completado

1. Tailwind CSS v4 instalado con `@tailwindcss/postcss`
2. `postcss.config.mjs` con `{ "@tailwindcss/postcss": {} }`
3. shadcn/ui inicializado con `npx shadcn@latest init -d`
4. Componentes instalados: `button`, `textarea`, `card`, `badge`
5. `lucide-react` instalado para iconos

---

## Diseño de la UI (`app/page.tsx`)

Una sola página con diseño oscuro (clase `dark` en `<html>`):

### Layout general
- Fondo oscuro (`bg-background`) con glow sutil centrado
- Card central con glassmorphism (`bg-card/80 backdrop-blur-sm`)
- Header con icono Mail y nombre "Hermes"
- Tema oscuro por defecto

### Componentes principales
1. **Header**: "Hermes" con icono Mail, subtítulo descriptivo
2. **Banner de warning**: aparece si `context_source === "fallback"` (contexto de respaldo)
3. **Textarea de entrada**: grande, placeholder descriptivo, min-height responsive
4. **Botón "Generar respuesta"**: con icono Sparkles, loading state con spinner
5. **Loading state**: icono Loader2 animado mientras Claude procesa
6. **Área de resultado**: borrador en `<pre>` con fade-in animado
7. **Badge**: "Contexto actualizado" si `context_source === "google_doc"`
8. **Botón "Copiar"**: feedback visual con icono Check durante 2 segundos

### Responsive (3 breakpoints)
- **Móvil** `< 640px`: padding reducido, `min-h-[180px]`, botón `h-11`
- **Tablet** `640px–1024px`: `sm:min-h-[220px]`, botón `h-12`, texto `sm:text-base`
- **Desktop** `> 1024px`: card `max-w-3xl`, más espacio

---

## Estado de la UI

```typescript
const [emailText, setEmailText] = useState("");
const [draft, setDraft] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [copied, setCopied] = useState(false);
const [contextSource, setContextSource] = useState<ContextSource | null>(null);
```

---

## Flujo principal

```typescript
const handleGenerate = async () => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email_text: emailText }),
  });
  const data = await res.json();
  setDraft(data.draft);
  setContextSource(data.context_source ?? null);
};

const handleCopy = async () => {
  await navigator.clipboard.writeText(draft);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

---

## Checks de funcionamiento

- [x] **`npm run build` compila** sin errores.
- [x] **`npm test` pasa** los 33 tests (Vitest).
- [x] **`npm run dev` arranca** en `http://localhost:3000`.
- [x] **shadcn/ui funciona**: Button, Textarea, Card, Badge renderizan.
- [x] **Tema oscuro** por defecto (`dark` en `<html>`).
- [x] **Warning banner** visible cuando `context_source === "fallback"`.
- [x] **Loading state**: spinner Loader2 mientras Claude procesa.
- [x] **Copiar funciona**: feedback visual con Check icon.
- [x] **Errores manejados**: banner rojo con mensaje de error.
- [x] **Responsive**: breakpoints `sm:` y `lg:` en todos los componentes.
