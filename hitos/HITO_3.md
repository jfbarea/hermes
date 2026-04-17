# Hito 3 — Contexto real, despliegue y ajuste de calidad

**Objetivo:** deploy en Netlify con contexto real, iteración sobre calidad de borradores.

---

## Parte 1 — Rellenar el contexto

Editar `context/context.md` con información real:
- Identidad profesional del tutor
- Datos actualizados del examen PIR
- Metodología de tutoría
- Preguntas frecuentes con respuestas reales
- Tono y estilo (saludo, despedida, tratamiento, prohibiciones)

---

## Parte 2 — Crear ejemplos reales

Crear al menos 3-5 archivos en `context/examples/` con pares reales. Categorías:

- Duda sobre temario o materia
- Pregunta sobre convocatoria (fechas, requisitos)
- Gestión de ansiedad o motivación
- Solicitud de tutoría individual
- Pregunta sobre materiales o recursos

---

## Parte 3 — Desplegar en Netlify

1. Conectar el repo a Netlify (New site > Import from Git)
2. Build settings: publish directory `public`, no build command necesario
3. Configurar `ANTHROPIC_API_KEY` en Site settings > Environment variables
4. Deploy y verificar que la app funciona en la URL de Netlify

---

## Parte 4 — Iterar sobre calidad

1. Probar con 10-20 emails reales
2. Anotar qué falla: tono, información incorrecta, falta de contexto
3. Actualizar `context.md` y ejemplos, push al repo, Netlify redespliega automáticamente
4. Repetir hasta que el 70%+ de borradores sean directamente utilizables

---

## Parte 5 — Documentación

Actualizar `README.md` con:
- Cómo arrancar en local (`netlify dev`)
- Cómo desplegar en Netlify
- Cómo rellenar y actualizar el contexto y ejemplos

---

## Checks de funcionamiento

- [ ] **Deploy exitoso**: la app está live en una URL de Netlify.
- [ ] **`context.md` relleno**: todas las secciones tienen contenido real.
- [ ] **Al menos 3 ejemplos reales**.
- [ ] **Tono correcto**: borradores usan saludo y despedida del contexto.
- [ ] **Sin inventos**: Claude no incluye información fuera del contexto.
- [ ] **Calidad**: tras 20 pruebas, al menos 70% son directamente utilizables.
- [ ] **README actualizado** con instrucciones de uso y mantenimiento.
