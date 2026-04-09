/**
 * VeritasWarningBox — Caixas de alerta dos relatórios Veritas
 *
 * Renderiza uma lista de mensagens em formato de alerta,
 * com variante warning (padrão), info ou danger.
 */

export type WarningBoxVariant = "warning" | "info" | "danger";

export function renderWarningBox(
  messages: string[],
  variant: WarningBoxVariant = "warning"
): string {
  if (messages.length === 0) return "";
  const cls = variant === "info" ? "vr-info-box" : variant === "danger" ? "vr-danger-box" : "vr-warning-box";
  const icon = variant === "info" ? "ℹ" : variant === "danger" ? "✕" : "⚠";
  if (messages.length === 1) {
    return `<div class="${cls}">${icon} ${messages[0]}</div>`;
  }
  const items = messages.map(m => `<li style="margin-bottom:4px;">${m}</li>`).join("");
  return `<div class="${cls}"><strong>${icon} Alertas automáticos</strong><ul style="margin-top:6px;padding-left:16px;">${items}</ul></div>`;
}

export function renderWarningList(messages: string[]): string {
  if (messages.length === 0) {
    return `<div class="vr-info-box">ℹ Nenhuma inconsistência crítica detectada.</div>`;
  }
  const items = messages.map(m => `<div class="vr-warning-box" style="margin-bottom:6px;">⚠ ${m}</div>`).join("");
  return items;
}
