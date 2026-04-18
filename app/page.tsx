"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Mail,
  ExternalLink,
  LogOut,
} from "lucide-react";
import {
  PRICE_INPUT_PER_M,
  PRICE_OUTPUT_PER_M,
  MONTHLY_LIMIT_USD,
  ESTIMATED_SYSTEM_TOKENS,
  ESTIMATED_OUTPUT_TOKENS,
} from "@/lib/constants";

type ContextSource = "google_doc" | "fallback";

interface UsageInfo {
  monthlySpend: number;
  remaining: number;
  limitReached: boolean;
}

interface PendingConfirm {
  estimatedCost: number;
  monthlySpend: number;
}

function estimateCost(emailText: string): number {
  const inputTokens = ESTIMATED_SYSTEM_TOKENS + Math.ceil(emailText.length / 4);
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (ESTIMATED_OUTPUT_TOKENS / 1_000_000) * PRICE_OUTPUT_PER_M
  );
}

function fmt(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

export default function Home() {
  const [emailText, setEmailText] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contextSource, setContextSource] = useState<ContextSource | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  // Paso 1: consultar uso; si se ha superado el límite pedir confirmación
  const handleGenerateClick = async () => {
    if (!emailText.trim()) return;
    setError(null);

    try {
      const res = await fetch("/api/usage");
      const data: UsageInfo = await res.json();
      setUsage(data);

      if (data.limitReached) {
        // Mostrar diálogo para que el usuario decida si desbloquear
        setPendingConfirm({
          estimatedCost: estimateCost(emailText),
          monthlySpend: data.monthlySpend,
        });
        return;
      }
    } catch {
      // Si no se puede consultar el uso, continuar igualmente
    }

    await doGenerate();
  };

  // Paso 2: llamada real a la API tras confirmar
  const doGenerate = async () => {
    setPendingConfirm(null);
    setLoading(true);
    setDraft("");
    setContextSource(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_text: emailText }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      setDraft(data.draft);
      setContextSource(data.context_source ?? null);

      // Actualizar el uso mostrado con los datos reales
      if (data.usage) {
        const spend = data.usage.monthly_spend;
        setUsage({
          monthlySpend: spend,
          remaining: Math.max(0, MONTHLY_LIMIT_USD - spend),
          limitReached: spend >= MONTHLY_LIMIT_USD,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canGenerate = emailText.trim().length > 0 && !loading;

  const docId = process.env.NEXT_PUBLIC_CONTEXT_GOOGLE_DOC_ID;
  const docUrl = docId
    ? `https://docs.google.com/document/d/${docId}/edit`
    : null;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10 sm:py-16">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Diálogo de confirmación de coste */}
      <AlertDialog open={!!pendingConfirm} onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Límite mensual superado</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <div>
                <p>
                  Has superado el límite mensual de{" "}
                  <span className="font-semibold text-foreground">${MONTHLY_LIMIT_USD}</span>.
                </p>
                <p className="pt-1">
                  Gasto acumulado este mes:{" "}
                  <span className="font-semibold text-foreground">
                    {pendingConfirm ? fmt(pendingConfirm.monthlySpend) : "—"}
                  </span>
                </p>
                <p>
                  Coste estimado de esta llamada:{" "}
                  <span className="font-semibold text-foreground">
                    {pendingConfirm ? fmt(pendingConfirm.estimatedCost) : "—"}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs pt-1">
                  ¿Quieres continuar de todas formas?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doGenerate}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative z-10 w-full max-w-2xl lg:max-w-3xl space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-primary" />
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Hermes
              </h1>
            </div>
            <div className="flex-1 flex justify-end items-center gap-2">
              {usage && (
                <span className="text-xs text-muted-foreground">
                  {fmt(usage.monthlySpend)} / ${MONTHLY_LIMIT_USD}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base text-center">
            Genera borradores de respuesta para emails de alumnos PIR
          </p>
        </header>

        {/* Fallback warning */}
        {contextSource === "fallback" && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-yellow-300 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No se pudo cargar el contexto desde Google Doc. Se ha usado el
              contexto local de respaldo.
            </span>
          </div>
        )}

        {/* Input card */}
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
              Email recibido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Pega aquí el email del alumno..."
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={8}
              className="resize-none text-sm sm:text-base focus-visible:ring-primary/60 bg-background/60 min-h-[180px] sm:min-h-[220px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateClick}
                disabled={!canGenerate}
                className="flex-1 h-11 sm:h-12 text-sm sm:text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-primary/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando borrador...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar respuesta
                  </>
                )}
              </Button>
              {docUrl && (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir Google Doc de contexto"
                  className={buttonVariants({
                    variant: "outline",
                    className:
                      "h-11 sm:h-12 shrink-0 border-border/60 hover:border-primary/60 transition-colors",
                  })}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result card */}
        {draft && (
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                  Borrador de respuesta
                </CardTitle>
                {contextSource === "google_doc" && (
                  <Badge variant="secondary" className="text-xs">
                    Contexto actualizado
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0 h-8 gap-1.5 text-xs border-border/60 hover:border-primary/60 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed font-sans text-foreground/90">
                {draft}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
