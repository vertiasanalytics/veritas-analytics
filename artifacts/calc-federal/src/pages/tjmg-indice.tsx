import React, { useEffect, useMemo, useState } from "react";

type SyncStatus = {
  success: boolean;
  fonteNome: string;
  fonteUrl: string;
  competenciaMaisRecente: string;
  ultimaImportacaoEm: string;
  totalRegistros: number;
  hashArquivo?: string;
  mensagem?: string;
};

type FatorRegistro = {
  id?: string;
  indiceNome: string;
  competenciaOrigem: string;
  competenciaReferencia: string;
  fator: number;
  fonteUrl?: string;
  importadoEm?: string;
};

type LookupResponse = {
  success: boolean;
  indiceNome: string;
  competenciaOrigem: string;
  competenciaReferencia: string;
  fator: number;
  valorHistorico: number;
  valorAtualizado: number;
  metodologia: string;
  observacao?: string;
};

type AbaAtiva = "painel" | "consulta" | "historico" | "integracao";

const API_BASE = "/api/tjmg";

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (valor: number, casas = 6) =>
  valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const formatarDataHora = (valor?: string) => {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR");
};

const formatarCompetencia = (valor?: string) => {
  if (!valor) return "—";
  if (/^\d{4}-\d{2}$/.test(valor)) {
    const [ano, mes] = valor.split("-");
    return `${mes}/${ano}`;
  }
  return valor;
};

async function requestJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("veritas_token") ?? "";
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let detalhe = "";
    try {
      detalhe = await response.text();
    } catch {
      detalhe = "";
    }
    throw new Error(detalhe || `Falha HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export default function VeritasTJMGIndiceModule() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("painel");
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroGlobal, setErroGlobal] = useState("");
  const [sucessoGlobal, setSucessoGlobal] = useState("");

  const [status, setStatus] = useState<SyncStatus>({
    success: false,
    fonteNome: "TJMG — Fator de Atualização Monetária",
    fonteUrl: "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm",
    competenciaMaisRecente: "",
    ultimaImportacaoEm: "",
    totalRegistros: 0,
    mensagem: "Aguardando sincronização inicial.",
  });

  const [consulta, setConsulta] = useState({
    valorHistorico: 1000,
    competenciaOrigem: "",
    competenciaReferencia: "",
    indiceNome: "ICGJ/TJMG",
  });

  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [consultando, setConsultando] = useState(false);

  const [historico, setHistorico] = useState<FatorRegistro[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const abas: { key: AbaAtiva; label: string }[] = [
    { key: "painel", label: "Painel" },
    { key: "consulta", label: "Consulta" },
    { key: "historico", label: "Histórico" },
    { key: "integracao", label: "Integração" },
  ];

  const resumoConsulta = useMemo(() => {
    if (!lookup) return null;
    return [
      { titulo: "Valor histórico", valor: moeda(lookup.valorHistorico) },
      { titulo: "Fator TJMG", valor: numero(lookup.fator) },
      { titulo: "Valor atualizado", valor: moeda(lookup.valorAtualizado) },
    ];
  }, [lookup]);

  async function carregarPainel() {
    setLoadingPainel(true);
    setErroGlobal("");
    try {
      const data = await requestJSON<SyncStatus>(`${API_BASE}/status`);
      setStatus(data);
    } catch (error) {
      setErroGlobal(error instanceof Error ? error.message : "Falha ao carregar status.");
    } finally {
      setLoadingPainel(false);
    }
  }

  async function carregarHistorico() {
    setLoadingHistorico(true);
    setErroGlobal("");
    try {
      const data = await requestJSON<FatorRegistro[]>(`${API_BASE}/factors?limit=200`);
      setHistorico(data);
    } catch (error) {
      setErroGlobal(error instanceof Error ? error.message : "Falha ao carregar histórico.");
    } finally {
      setLoadingHistorico(false);
    }
  }

  async function sincronizarAgora() {
    setSincronizando(true);
    setErroGlobal("");
    setSucessoGlobal("");
    try {
      const data = await requestJSON<SyncStatus>(`${API_BASE}/sync`, {
        method: "POST",
        body: JSON.stringify({
          fonte: "tjmg",
          modo: "latest",
        }),
      });
      setStatus(data);
      setSucessoGlobal("Tabela do TJMG sincronizada com sucesso.");
      await carregarHistorico();
    } catch (error) {
      setErroGlobal(
        error instanceof Error ? error.message : "Não foi possível sincronizar a tabela do TJMG."
      );
    } finally {
      setSincronizando(false);
    }
  }

  async function consultarFator() {
    setConsultando(true);
    setErroGlobal("");
    setSucessoGlobal("");
    try {
      const data = await requestJSON<LookupResponse>(`${API_BASE}/lookup`, {
        method: "POST",
        body: JSON.stringify({
          valorHistorico: Number(consulta.valorHistorico) || 0,
          competenciaOrigem: consulta.competenciaOrigem,
          competenciaReferencia: consulta.competenciaReferencia,
          indiceNome: consulta.indiceNome,
        }),
      });
      setLookup(data);
      setSucessoGlobal("Fator localizado e valor atualizado calculado.");
    } catch (error) {
      setErroGlobal(
        error instanceof Error ? error.message : "Não foi possível consultar o fator do TJMG."
      );
      setLookup(null);
    } finally {
      setConsultando(false);
    }
  }

  useEffect(() => {
    void carregarPainel();
    void carregarHistorico();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Veritas Analytics
              </p>
              <h1 className="mt-2 text-2xl font-bold lg:text-3xl">
                Integração do Índice de Atualização Monetária — TJMG
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-200">
                Módulo de sincronização, consulta e aplicação automática dos fatores monetários do
                Tribunal de Justiça de Minas Gerais, preparado para integração com liquidação de
                sentença, valor da causa, danos materiais e demais cálculos cíveis do Veritas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResumoCard
                titulo="Competência mais recente"
                valor={formatarCompetencia(status.competenciaMaisRecente)}
              />
              <ResumoCard
                titulo="Última importação"
                valor={formatarDataHora(status.ultimaImportacaoEm)}
              />
              <ResumoCard
                titulo="Total de registros"
                valor={String(status.totalRegistros || 0)}
                destaque
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            {abas.map((aba) => (
              <button
                key={aba.key}
                type="button"
                onClick={() => setAbaAtiva(aba.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  abaAtiva === aba.key
                    ? "bg-slate-900 text-white shadow"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          <div className="p-4 lg:p-6">
            {(erroGlobal || sucessoGlobal) && (
              <div className="mb-4 space-y-3">
                {erroGlobal && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {erroGlobal}
                  </div>
                )}
                {sucessoGlobal && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {sucessoGlobal}
                  </div>
                )}
              </div>
            )}

            {abaAtiva === "painel" && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <MetricCard
                    titulo="Fonte oficial"
                    valor={status.fonteNome || "TJMG"}
                    subtitulo={status.fonteUrl || "—"}
                  />
                  <MetricCard
                    titulo="Hash do último arquivo"
                    valor={status.hashArquivo || "—"}
                    subtitulo="Controle de rastreabilidade"
                  />
                  <MetricCard
                    titulo="Mensagem do serviço"
                    valor={status.mensagem || "—"}
                    subtitulo="Status mais recente da integração"
                  />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Sincronização automática</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Use este comando para forçar a leitura da página do TJMG, localizar o XLS
                        oficial mais recente, importar os fatores e salvar a base interna do Veritas.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void carregarPainel()}
                        disabled={loadingPainel}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {loadingPainel ? "Atualizando..." : "Atualizar painel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sincronizarAgora()}
                        disabled={sincronizando}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {sincronizando ? "Sincronizando..." : "Sincronizar TJMG agora"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <InfoPanel
                    titulo="Como este módulo deve funcionar no backend"
                    itens={[
                      "Acessar a página do TJMG e localizar o arquivo XLS oficial mais recente.",
                      "Baixar o arquivo do mês e extrair os fatores monetários.",
                      "Persistir os fatores em base própria do Veritas.",
                      "Registrar competência, URL de origem, hash e data de importação.",
                      "Expor endpoint de consulta para todos os módulos de cálculo do sistema.",
                    ]}
                  />

                  <InfoPanel
                    titulo="Endpoints esperados por este TSX"
                    itens={[
                      "GET /api/tjmg/status",
                      "POST /api/tjmg/sync",
                      "POST /api/tjmg/lookup",
                      "GET /api/tjmg/factors?limit=200",
                    ]}
                  />
                </div>
              </section>
            )}

            {abaAtiva === "consulta" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Consulta e aplicação do fator TJMG</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Informe a competência original do valor, a competência de referência do cálculo
                    e o valor histórico para obter a atualização monetária no padrão do TJMG.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <CampoTexto
                    label="Índice"
                    value={consulta.indiceNome}
                    onChange={(v) => setConsulta({ ...consulta, indiceNome: v })}
                  />
                  <CampoCompetencia
                    label="Competência de origem"
                    value={consulta.competenciaOrigem}
                    onChange={(v) => setConsulta({ ...consulta, competenciaOrigem: v })}
                  />
                  <CampoCompetencia
                    label="Competência de referência"
                    value={consulta.competenciaReferencia}
                    onChange={(v) => setConsulta({ ...consulta, competenciaReferencia: v })}
                  />
                  <CampoNumero
                    label="Valor histórico"
                    value={consulta.valorHistorico}
                    onChange={(v) => setConsulta({ ...consulta, valorHistorico: Number(v) })}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void consultarFator()}
                    disabled={consultando}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {consultando ? "Consultando..." : "Consultar fator TJMG"}
                  </button>
                </div>

                {resumoConsulta && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {resumoConsulta.map((item) => (
                      <MetricCard key={item.titulo} titulo={item.titulo} valor={item.valor} />
                    ))}
                  </div>
                )}

                {lookup && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <h3 className="text-base font-semibold">Resultado da consulta</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <MetricCard
                        titulo="Competência de origem"
                        valor={formatarCompetencia(lookup.competenciaOrigem)}
                      />
                      <MetricCard
                        titulo="Competência de referência"
                        valor={formatarCompetencia(lookup.competenciaReferencia)}
                      />
                      <MetricCard titulo="Índice utilizado" valor={lookup.indiceNome} />
                      <MetricCard titulo="Metodologia" valor={lookup.metodologia} />
                    </div>

                    {lookup.observacao && (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {lookup.observacao}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {abaAtiva === "historico" && (
              <section className="space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Histórico importado</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Registros já persistidos no banco interno do Veritas para uso nos cálculos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void carregarHistorico()}
                    disabled={loadingHistorico}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {loadingHistorico ? "Atualizando..." : "Atualizar histórico"}
                  </button>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-900 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Índice</th>
                          <th className="px-4 py-3 text-left font-semibold">Origem</th>
                          <th className="px-4 py-3 text-left font-semibold">Referência</th>
                          <th className="px-4 py-3 text-left font-semibold">Fator</th>
                          <th className="px-4 py-3 text-left font-semibold">Importado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historico.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                              Nenhum fator carregado.
                            </td>
                          </tr>
                        ) : (
                          historico.map((item, index) => (
                            <tr
                              key={`${item.indiceNome}-${item.competenciaOrigem}-${index}`}
                              className="border-t border-slate-200"
                            >
                              <td className="px-4 py-3">{item.indiceNome}</td>
                              <td className="px-4 py-3">{formatarCompetencia(item.competenciaOrigem)}</td>
                              <td className="px-4 py-3">{formatarCompetencia(item.competenciaReferencia)}</td>
                              <td className="px-4 py-3 font-semibold">{numero(item.fator)}</td>
                              <td className="px-4 py-3">{formatarDataHora(item.importadoEm)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {abaAtiva === "integracao" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold">Instruções de integração no Veritas</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Este componente é a interface. A sincronização mensal automática depende de um
                    job no backend e de persistência em banco de dados.
                  </p>
                </div>

                <CodeBlock
                  title="Exemplo de uso no frontend"
                  code={`const response = await fetch("/api/tjmg/lookup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    valorHistorico: 1000,
    competenciaOrigem: "2024-08",
    competenciaReferencia: "2026-03",
    indiceNome: "ICGJ/TJMG"
  })
});

const data = await response.json();
// data.valorAtualizado -> usar no módulo de liquidação, valor da causa, etc.`}
                />

                <CodeBlock
                  title="Exemplo de payload esperado no backend"
                  code={`{
  "success": true,
  "indiceNome": "ICGJ/TJMG",
  "competenciaOrigem": "2024-08",
  "competenciaReferencia": "2026-03",
  "fator": 1.153420,
  "valorHistorico": 1000,
  "valorAtualizado": 1153.42,
  "metodologia": "valorHistorico * fatorTJMG"
}`}
                />

                <InfoPanel
                  titulo="Onde plugar este índice no Veritas"
                  itens={[
                    "Liquidação de sentença cível estadual.",
                    "Atualização do valor da causa em ações estaduais.",
                    "Cálculos de danos materiais e indenizações.",
                    "Execução de título judicial com memória discriminada do crédito.",
                    "Módulo de relatórios padronizados com informação da fonte e competência aplicada.",
                  ]}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumoCard({
  titulo,
  valor,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        destaque
          ? "border-amber-300 bg-amber-50 text-slate-900"
          : "border-white/20 bg-white/10 text-white"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${destaque ? "text-amber-700" : "text-slate-200"}`}>
        {titulo}
      </p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  subtitulo,
  classe = "bg-white text-slate-800 border-slate-200",
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  classe?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${classe}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{titulo}</p>
      <p className="mt-2 break-words text-lg font-bold">{valor}</p>
      {subtitulo && <p className="mt-2 text-xs opacity-70">{subtitulo}</p>}
    </div>
  );
}

function CampoTexto({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
      />
    </label>
  );
}

function CampoNumero({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
      />
    </label>
  );
}

function CampoCompetencia({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
      />
    </label>
  );
}

function InfoPanel({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {itens.map((item) => (
          <li key={item} className="rounded-2xl bg-slate-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-800">{code}</pre>
    </div>
  );
}
