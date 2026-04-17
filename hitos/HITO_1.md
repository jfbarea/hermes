# Hito 1 — Netlify Function: prompt builder + Claude client

**Objetivo:** función serverless funcionando que, dado un texto de email, genera un borrador de respuesta usando el contexto.

---

## Parte 1 — Estructura de archivos de contexto

Crear `context/context.md` con la estructura completa para que el tutor la rellene y al menos 3 archivos de ejemplo en `context/examples/`.

---

## Parte 2 — Prompt builder (`netlify/functions/prompt_builder.py`)

Módulo que:
1. Carga `context/context.md` desde el sistema de archivos
2. Carga todos los archivos `context/examples/*.md` ordenados por nombre
3. Trunca el cuerpo del email si excede `MAX_BODY_CHARS = 6000`
4. Construye el prompt completo: system message (contexto + ejemplos + instrucciones) y user message (email)

```python
def build_prompt(email_text: str) -> tuple[str, str]:
    """Devuelve (system_message, user_message)."""
    ...
```

La ruta a `context/` se resuelve relativa a la raíz del proyecto. En Netlify Functions, los archivos incluidos via `included_files` están disponibles en el filesystem de la Lambda.

---

## Parte 3 — Netlify Function (`netlify/functions/generate.py`)

Handler de Netlify Functions v2 (Python):

1. Recibe POST con JSON `{"email_text": "..."}`
2. Llama a `prompt_builder.build_prompt(email_text)`
3. Llama a la API de Anthropic con el prompt construido
4. Devuelve JSON `{"draft": "..."}`

```python
import anthropic
from prompt_builder import build_prompt

def handler(event, context):
    ...
```

---

## Parte 4 — Configuración de Netlify

`netlify.toml`:
```toml
[build]
  publish = "public"

[functions]
  directory = "netlify/functions"
  included_files = ["context/**"]
```

`requirements.txt`:
```
anthropic>=0.25.0
```

---

## Parte 5 — Prueba local

> **Nota:** netlify-cli ejecuta funciones JS/TS de forma nativa en local, pero
> las funciones Python solo se ejecutan en producción (AWS Lambda). Para probar
> localmente se usa el script `scripts/invoke_local.py`, que invoca el handler
> directamente simulando el evento de Lambda.

```bash
# Opción A — script local (sin deploy, carga .env automáticamente)
set -a && source .env && set +a
python3 scripts/invoke_local.py "Hola, tengo dudas sobre el temario de Psicopatología."

# Opción B — preview deploy en Netlify (prueba end-to-end real)
netlify deploy --build   # genera una URL de preview
curl -X POST https://<preview-url>/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{"email_text": "Hola, tengo dudas sobre el temario de Psicopatología."}'
```

---

## Parte 6 — Tests unitarios y pre-commit hook

Batería de tests unitarios para `prompt_builder.py` con mocks de filesystem (sin I/O real):

```bash
# Ejecutar todos los tests
python3 -m pytest tests/ -v
```

Husky ejecuta los tests automáticamente antes de cada `git commit`. Configuración en `.husky/pre-commit`.

---

## Checks de funcionamiento

### 1. `context/context.md` existe con la estructura completa

```bash
test -f context/context.md && echo "OK" || echo "FALTA"
# Verificar secciones principales
grep -c "^##" context/context.md
# Debe mostrar ≥ 8 (una por sección)
```

### 2. Al menos 3 ejemplos en `context/examples/` con formato correcto

```bash
ls context/examples/*.md | wc -l
# Debe mostrar ≥ 3

# Verificar que cada ejemplo tiene las dos secciones obligatorias
for f in context/examples/*.md; do
  echo "--- $f ---"
  grep -c "## EMAIL RECIBIDO\|## MI RESPUESTA" "$f"
  # Debe mostrar 2 por archivo
done
```

### 3. `prompt_builder.py` carga el contexto y los ejemplos

```bash
# Smoke test rápido desde la raíz del repo
python3 - <<'EOF'
import sys
sys.path.insert(0, "netlify/functions")
from prompt_builder import build_prompt
system_msg, user_msg = build_prompt("Email de prueba")
assert len(system_msg) > 100, "system_message demasiado corto"
assert "EMAIL RECIBIDO" in system_msg or "Ejemplo" in system_msg, "ejemplos no cargados"
print("OK — system_message:", len(system_msg), "chars")
print("OK — user_message:  ", len(user_msg), "chars")
EOF
```

### 4. `prompt_builder.py` trunca emails largos a 6.000 caracteres

```bash
python3 - <<'EOF'
import sys
sys.path.insert(0, "netlify/functions")
from prompt_builder import build_prompt, MAX_BODY_CHARS
long_email = "x" * 10_000
_, user_msg = build_prompt(long_email)
truncated = "x" * MAX_BODY_CHARS
assert truncated in user_msg, "truncado incorrecto"
assert "x" * (MAX_BODY_CHARS + 1) not in user_msg, "no se truncó"
print(f"OK — email de 10.000 chars truncado a {MAX_BODY_CHARS}")
EOF
```

### 5. Suite completa de tests unitarios

```bash
python3 -m pytest tests/ -v
# Resultado esperado: 20 passed
```

### 6. `netlify.toml` configurado correctamente

```bash
# Verificar las tres claves obligatorias
grep "publish"        netlify.toml && echo "publish OK"
grep "directory"      netlify.toml && echo "directory OK"
grep "included_files" netlify.toml && echo "included_files OK"
grep 'context/\*\*'   netlify.toml && echo "context glob OK"
```

### 7. Función responde con JSON `{"draft": "..."}` (requiere `netlify dev` corriendo)

```bash
# Terminal 1: arrancar el servidor local
netlify dev

# Terminal 2: llamar a la función
curl -s -X POST http://localhost:8888/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{"email_text": "Hola, tengo dudas sobre el temario de Psicopatología. ¿Qué temas son más importantes para el PIR?"}' \
  | python3 -m json.tool
# Debe mostrar {"draft": "..."}
```

### 8. El borrador es coherente (saludo + cuerpo + despedida en español)

```bash
# Verificar manualmente que la respuesta del curl anterior contiene:
# - Saludo ("Hola", "Buenos días"…)
# - Cuerpo con contenido relevante en español
# - Despedida ("Un saludo", "Ánimo"…)
```
