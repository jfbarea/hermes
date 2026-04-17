# PLAN: Hermes — Web App de respuesta a emails de tutorizados PIR

## Objetivo

Web app sencilla donde el tutor pega el correo de un tutorizado y obtiene un borrador de respuesta generado por Claude. Sin integración con servicios de correo — copiar y pegar.

**Contexto de dominio:** el usuario es tutor de oposiciones para la plaza de Psicólogo Interno Residente (PIR). Gestiona aproximadamente 100 tutorizados que le envían correos frecuentes con dudas sobre el proceso de oposición, el estudio, temarios y orientación. El volumen es alto y el objetivo es que los borradores generados sean directamente utilizables con mínima edición.

**Despliegue:** Netlify (static site + serverless functions).

**Frontend:** React + Vite + Tailwind CSS + shadcn/ui. Diseño moderno y flashy. Responsive-first: optimizado para móvil, tablet y desktop.

---

## Arquitectura general

```
Browser (React SPA en Netlify CDN)
   │
   │  POST /api/generate
   ▼
Netlify Function (Python, serverless)
   ├── context/context.md          # Quién eres, tu rol, info para responder
   ├── context/examples/*.md       # Pares correo/respuesta de referencia
   └── prompt_builder.py           # Construir prompt con contexto + tono + correo
```

- El **frontend** es una SPA React con shadcn/ui, buildeada por Vite a static files, servida por Netlify CDN.
- El **backend** es una Netlify Function en Python que recibe el email, construye el prompt con el contexto y llama a la API de Anthropic.
- La `ANTHROPIC_API_KEY` se configura como variable de entorno en Netlify (Site settings > Environment variables).

---

## Estructura del repositorio

```
hermes/
├── context/
│   ├── context.md                 # Info del tutor y dominio PIR
│   └── examples/
│       ├── example_01.md
│       ├── example_02.md
│       └── ...
├── netlify/
│   └── functions/
│       ├── generate.py            # Netlify Function: recibe email, devuelve borrador
│       └── prompt_builder.py      # Carga contexto + ejemplos, construye prompt
├── src/                           # Frontend React
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css                  # Tailwind directives + tema
│   ├── components/
│   │   └── ui/                    # shadcn/ui components
│   └── lib/
│       └── utils.ts               # cn() helper de shadcn
├── public/
│   └── (static assets)
├── index.html                     # Entry point Vite
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                # shadcn/ui config
├── requirements.txt               # Dependencias Python (función serverless)
├── netlify.toml                   # Config Netlify (build, functions, redirects)
├── hitos/
│   ├── HITO_1.md
│   ├── HITO_2.md
│   └── HITO_3.md
├── PLAN.md
└── README.md
```

---

## Formato de los archivos de contexto

### `context/context.md`

Información real del tutor PIR organizada en secciones: identidad profesional, el examen PIR, convocatoria, metodología, preguntas frecuentes, tono y estilo.

### `context/examples/example_NN.md`

Cada archivo contiene un par correo-respuesta:

```markdown
## EMAIL RECIBIDO

[cuerpo del correo tal cual lo recibiste]

## MI RESPUESTA

[respuesta que enviaste, referencia de tono]
```

---

## Flujo de la app

```
1. El tutor abre la web app en el navegador (URL de Netlify)
2. Pega el contenido del email del tutorizado en el textarea
3. Pulsa "Generar respuesta"
4. El frontend hace POST a /api/generate con el texto del email
5. La Netlify Function:
   a. Carga context.md y todos los examples/*.md
   b. Construye el prompt (system + contexto + ejemplos + instrucciones + email)
   c. Llama a Claude API
   d. Devuelve el borrador de respuesta como JSON
6. El frontend muestra el borrador con animación y ofrece botón de copiar
```

---

## Estructura del prompt a Claude

```
SYSTEM:
Eres un asistente que redacta respuestas de email en nombre de un tutor de oposiciones PIR
(Psicólogo Interno Residente). El tutor gestiona ~100 tutorizados y recibe muchos correos
diarios con dudas sobre el proceso de oposición, el estudio y orientación general.

A continuación tienes información de contexto sobre el tutor y el dominio PIR:
---
{contenido de context.md}
---

Para calibrar el tono, estos son ejemplos reales de correos recibidos y sus respuestas:
---
{contenido de examples/example_01.md}
---
{contenido de examples/example_02.md}
...
---

Instrucciones:
- Redacta SOLO el cuerpo del email de respuesta, sin asunto ni metadatos
- Usa el mismo idioma que el correo recibido (normalmente español)
- Ajusta el tono al de los ejemplos: cercano, de tú, conciso y alentador
- Si el correo menciona el nombre del tutorizado, úsalo en el saludo
- No inventes información sobre el proceso PIR que no esté en el contexto
- Si la pregunta es muy específica y no tienes datos suficientes, redacta una respuesta
  breve indicando que se tratará en la próxima tutoría individual
- Nunca garantices resultados ni prometas plazas

USER:
Redacta una respuesta al siguiente correo:

{email pegado por el tutor}
```

---

## Configuración de Netlify

### `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  included_files = ["context/**"]

[[redirects]]
  from = "/api/generate"
  to = "/.netlify/functions/generate"
  status = 200

# SPA fallback — todas las rutas al index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Variables de entorno (en Netlify UI)

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic |

---

## Dependencias

### Python (`requirements.txt`)
```
anthropic>=0.25.0
```

### Node (`package.json` — principales)
```
react, react-dom
vite, @vitejs/plugin-react
tailwindcss, postcss, autoprefixer
shadcn/ui (via CLI: componentes instalados a demanda)
lucide-react (iconos)
```

---

## Hitos de implementación

### Hito 1 — Netlify Function: prompt builder + Claude client
**Objetivo:** función serverless funcionando que, dado un texto de email, genera un borrador usando el contexto.

Tareas:
1. Crear `context/context.md` con la estructura
2. Crear al menos 3 ejemplos en `context/examples/`
3. `netlify/functions/prompt_builder.py` — carga contexto + ejemplos, construye prompt
4. `netlify/functions/generate.py` — Netlify Function handler
5. `netlify.toml`, `requirements.txt`
6. Probar con `netlify dev` + `curl`

Criterio de éxito: curl POST a la función devuelve un borrador coherente.

---

### Hito 2 — Frontend React + shadcn/ui
**Objetivo:** interfaz web moderna y flashy donde el tutor pega un email y obtiene el borrador.

Tareas:
1. Scaffold React + Vite + TypeScript + Tailwind + shadcn/ui
2. Componentes: textarea (email), botón generar, área de resultado, botón copiar
3. Tema oscuro/claro, animaciones, gradientes, diseño moderno
4. Loading state, error handling
5. Integración con `/api/generate`
6. **Banner de aviso de contexto fallback**: la respuesta de `/api/generate` incluye
   el campo `context_source` (`"google_doc"` | `"fallback"`). Cuando el valor sea
   `"fallback"`, mostrar un banner/badge visible (p.ej. amarillo/naranja) que indique
   que el contexto se ha cargado desde el fichero local y no desde el Google Doc.
   Esto alerta al tutor de que el borrador puede estar basado en una versión
   desactualizada del contexto.

Criterio de éxito: `netlify dev`, pegar email, ver borrador con UI flashy.

---

### Hito 3 — Contexto real, despliegue y ajuste de calidad
**Objetivo:** deploy en Netlify con contexto real, iteración sobre calidad.

Tareas:
1. Rellenar contexto y ejemplos reales
2. Deploy en Netlify (conectar repo, env vars)
3. Iterar calidad con emails reales
4. README con instrucciones

Criterio de éxito: app live en Netlify, borradores de calidad para uso diario.
