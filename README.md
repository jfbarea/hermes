# Hermes

Automatización que genera borradores de respuesta a correos de tutorizados PIR usando Power Automate + Claude (Anthropic API). Cuando llega un email al buzón de Outlook, Power Automate lo detecta, llama a Claude y crea el borrador de respuesta directamente en la carpeta Drafts de Outlook.

---

## Arquitectura

```
Email nuevo en Outlook (M365)
         │
         ▼
  Power Automate Flow
   ├── Filtros: newsletters, auto-submitted, remitente propio
   ├── HTTP POST → Anthropic API (Claude)
   │      └── Prompt: contexto tutor PIR + email recibido
   └── Crear borrador en Outlook Drafts
              (From: tu cuenta M365, listo para enviar)
```

Sin servidores propios. Sin código Python. Sin Azure AD. Todo dentro de M365 con tu cuenta de usuario.

---

## Requisitos

- **Microsoft 365** con acceso a [Power Automate](https://make.powerautomate.com).
- **Power Automate Premium** (o licencia que incluya el conector HTTP). Ver Hito 1 para comprobar si tu plan lo incluye.
- **Anthropic API Key** — obtenerla en [console.anthropic.com](https://console.anthropic.com).

---

## Hitos

| Hito | Objetivo | Estado |
|---|---|---|
| [Hito 1](hitos/HITO_1.md) | Flow funcional con trigger y filtros | - |
| [Hito 2](hitos/HITO_2.md) | Integración con Claude y borradores en Outlook | - |
| [Hito 3](hitos/HITO_3.md) | Contexto del tutor PIR y calidad del prompt | - |
| [Hito 4](hitos/HITO_4.md) | Control de costes, logging y mantenimiento | - |
