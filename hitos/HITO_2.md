# Hito 2 — Frontend React + shadcn/ui

**Objetivo:** interfaz web moderna y flashy donde el tutor pega un email y obtiene el borrador de respuesta.

---

## Parte 1 — Scaffold del proyecto

Inicializar el proyecto frontend en la raíz del repo:

1. `npm create vite@latest . -- --template react-ts` (en la raíz del repo existente)
2. Instalar Tailwind CSS: `npm install -D tailwindcss @tailwindcss/vite`
3. Inicializar shadcn/ui: `npx shadcn@latest init`
4. Instalar componentes necesarios: `npx shadcn@latest add button textarea card`
5. Instalar lucide-react para iconos: `npm install lucide-react`

---

## Parte 2 — Diseño de la UI

Una sola página con diseño moderno y flashy:

### Layout general
- Fondo con gradiente sutil o patrón mesh
- Card central con glassmorphism o sombra prominente
- Header con logo/nombre "Hermes" y subtítulo
- Tema oscuro por defecto (opcionalmente toggle claro/oscuro)

### Componentes principales
1. **Header**: nombre de la app "Hermes" con tipografía bold, posible icono/emoji, subtítulo descriptivo
2. **Textarea de entrada**: grande, con placeholder descriptivo, borde con gradiente o glow al focus
3. **Botón "Generar respuesta"**: con gradiente, hover animado, icono (Sparkles o Wand de lucide)
4. **Loading state**: skeleton o spinner con animación mientras Claude procesa
5. **Área de resultado**: el borrador generado con tipografía legible, posible efecto de typing/fade-in
6. **Botón "Copiar al portapapeles"**: con feedback visual (check icon tras copiar)

### Responsive-first (3 breakpoints)

| Breakpoint | Ancho | Adaptaciones |
|---|---|---|
| **Móvil** | `< 640px` | Layout vertical full-width, textarea y resultado apilados, padding reducido, botón ocupa todo el ancho |
| **Tablet** | `640px – 1024px` | Card más ancha con más padding, textarea más alto, tipografía ligeramente mayor |
| **Desktop** | `> 1024px` | Card centrada con `max-w-3xl`, mayor espacio entre secciones, hover effects visibles |

- Usar clases responsive de Tailwind (`sm:`, `md:`, `lg:`) en todos los componentes
- Textarea y área de resultado deben escalar en altura según el viewport
- Botones touch-friendly en móvil (mínimo 44px de alto)
- Probar en Chrome DevTools con dispositivos reales (iPhone SE, iPad, laptop)

### Detalles flashy
- Transiciones y animaciones suaves en estados (idle → loading → resultado)
- Gradientes en botones y bordes
- Glow/ring effects en focus states

---

## Parte 3 — Lógica del frontend (`App.tsx`)

Estado:
- `emailText`: string del textarea
- `draft`: string del borrador generado
- `loading`: boolean
- `error`: string | null
- `copied`: boolean (feedback del botón copiar)

Flujo:
```typescript
const handleGenerate = async () => {
  setLoading(true)
  setError(null)
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_text: emailText }),
    })
    if (!res.ok) throw new Error("Error generando respuesta")
    const data = await res.json()
    setDraft(data.draft)
  } catch (e) {
    setError(e.message)
  } finally {
    setLoading(false)
  }
}

const handleCopy = async () => {
  await navigator.clipboard.writeText(draft)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

---

## Parte 4 — Configuración de build

`vite.config.ts` — configuración estándar de Vite con React plugin.

`netlify.toml` actualizado:
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

---

## Parte 5 — Prueba end-to-end local

1. `netlify dev` (arranca Vite dev server + functions)
2. Abrir `http://localhost:8888`
3. Pegar un email de prueba en el textarea
4. Pulsar "Generar respuesta"
5. Ver el borrador con la UI flashy
6. Pulsar "Copiar" y verificar

---

## Checks de funcionamiento

- [ ] **`npm run dev` arranca** sin errores.
- [ ] **shadcn/ui funciona**: los componentes (Button, Textarea, Card) renderizan correctamente.
- [ ] **Diseño flashy**: gradientes, animaciones, glow effects visibles.
- [ ] **Tema oscuro**: la app se ve bien en dark mode.
- [ ] **Generación funciona**: pegar email → botón → borrador aparece.
- [ ] **Loading state**: spinner/skeleton visible mientras Claude procesa.
- [ ] **Copiar funciona**: el botón copia al portapapeles con feedback visual.
- [ ] **Errores manejados**: si la función falla, se muestra mensaje de error.
- [ ] **Responsive móvil**: layout vertical, botón full-width, touch-friendly (probado en iPhone SE).
- [ ] **Responsive tablet**: card más ancha, buen uso del espacio (probado en iPad).
- [ ] **Responsive desktop**: card centrada con max-width, hover effects.
