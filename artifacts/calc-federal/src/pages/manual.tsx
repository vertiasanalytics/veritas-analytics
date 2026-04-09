import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Scale, Calculator, Landmark, Briefcase, TrendingDown,
  CreditCard, Users, ShieldCheck, FileText, ChevronRight, ChevronDown,
  Info, User, Crown, Coins, HardDriveDownload, RefreshCw, BarChart3,
  GraduationCap, Building2, ArrowRight, Lock, AlertCircle, Printer,
  TrendingUp, AlertTriangle, Sigma, LineChart, FileSpreadsheet, Heart, MapPin,
} from "lucide-react";

// ─── Sidebar sections ──────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "intro",           label: "Introdução",                icon: Info },
  { id: "sobre",           label: "Sobre o Sistema",           icon: BookOpen },
  { id: "autoria",         label: "Autoria e Créditos",        icon: GraduationCap },
  { id: "acesso",          label: "Acesso e Autenticação",     icon: User },
  { id: "creditos",        label: "Sistema de Créditos",       icon: Coins },
  { id: "planos",          label: "Planos e Assinaturas",      icon: Crown },
  { id: "previdenciario",  label: "Módulo Previdenciário",     icon: Landmark },
  { id: "trabalhista",     label: "Módulo Trabalhista",        icon: Scale },
  { id: "pericial",        label: "Módulo Pericial",           icon: Briefcase },
  { id: "juros",           label: "↳ Juros e Amortização",     icon: TrendingUp },
  { id: "dcf",             label: "↳ Lucro Cessante (DCF)",    icon: Sigma },
  { id: "analise-balanco", label: "↳ Análise de Balanços",     icon: BarChart3 },
  { id: "civel",           label: "Módulo Cível",              icon: TrendingDown },
  { id: "familia",         label: "Módulo Família",            icon: Heart },
  { id: "estadual",        label: "Módulo Estadual",           icon: MapPin },
  { id: "controladoria",   label: "Controladoria Jurídica",    icon: ShieldCheck },
  { id: "ferramentas",     label: "Ferramentas",               icon: Calculator },
  { id: "indices-info",    label: "↳ Gestão de Índices",       icon: LineChart },
  { id: "equipe",          label: "Gestão de Equipe",          icon: Users },
  { id: "relatorios",      label: "Relatórios e Laudos",       icon: FileText },
  { id: "faq",             label: "Perguntas Frequentes",      icon: HardDriveDownload },
];

// ─── Shared sub-components ────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground">{label}</h2>
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-6 mb-3">{children}</h3>;
}

function SubSubTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-foreground mt-4 mb-2 flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />{children}</h4>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}

function InfoBox({ color = "blue", icon: Icon, title, children }: {
  color?: "blue" | "amber" | "emerald" | "red"; icon?: React.ElementType;
  title?: string; children: React.ReactNode;
}) {
  const colors = {
    blue:    "bg-blue-50 border-blue-200 text-blue-800",
    amber:   "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    red:     "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-4 mb-4 ${colors[color]}`}>
      {(Icon || title) && (
        <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
          {Icon && <Icon className="w-4 h-4" />}
          {title && <span>{title}</span>}
        </div>
      )}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function StepList({ steps }: { steps: { n: number | string; text: string }[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {steps.map((s) => (
        <li key={s.n} className="flex gap-3 text-sm text-muted-foreground">
          <span className="w-6 h-6 rounded-full bg-blue-600/10 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
            {s.n}
          </span>
          <span className="leading-relaxed">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 mb-4">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
          <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FormulaBox({ title, formula, explanation }: { title: string; formula: string; explanation?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</p>
      <code className="block text-sm font-mono text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-2 whitespace-pre-wrap">{formula}</code>
      {explanation && <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>}
    </div>
  );
}

function ModuleTable({ rows }: { rows: { feature: string; cost: string; plan: string }[] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Funcionalidade</th>
            <th className="text-center px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Créditos</th>
            <th className="text-center px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Plano mínimo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
              <td className="px-4 py-2.5 text-foreground">{r.feature}</td>
              <td className="px-4 py-2.5 text-center"><Badge variant="secondary">{r.cost}</Badge></td>
              <td className="px-4 py-2.5 text-center"><Badge variant="outline">{r.plan}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-border overflow-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-foreground leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section content components ───────────────────────────────────────────────

function SecIntro() {
  return (
    <div>
      <SectionTitle icon={Info} label="Introdução" />
      <Paragraph>
        Bem-vindo ao <strong>Veritas Analytics</strong> — a plataforma profissional de cálculos judiciais
        desenvolvida para peritos, advogados e operadores do direito que atuam nas Justiças Federal, Trabalhista,
        Estadual (TJMG) e nos ramos cível e de família.
      </Paragraph>
      <Paragraph>
        O sistema conta com <strong>sete módulos de cálculo</strong> e o <strong>Módulo Proposição</strong>
        (Valor da Causa), disponível em todos os planos. Cada módulo permite preencher e visualizar resultados
        ao vivo sem custo — os créditos são debitados apenas na emissão do relatório ou laudo.
      </Paragraph>
      <InfoBox color="blue" icon={BookOpen} title="Como usar este manual">
        Navegue pelas seções no menu lateral. Os módulos Cível, Família e Estadual (TJMG) possuem seções próprias.
        A seção "Gestão de Índices" (↳ em Ferramentas) detalha os índices IPCA-E, INPC, SELIC e TJMG disponíveis.
        A seção "Planos e Assinaturas" contém a tabela comparativa completa de acesso por módulo.
      </InfoBox>
      <SubTitle>Visão geral dos módulos</SubTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { icon: Landmark,    label: "Módulo Previdenciário",  desc: "Atualização financeira, liquidação de sentença e valor da causa conforme Manual CJF 2025.", color: "bg-blue-50 border-blue-200" },
          { icon: Scale,       label: "Módulo Trabalhista",     desc: "Cálculos rescisórios por competência conforme Manual TRT-3ª Região 2026/1: insalubridade, aviso-prévio Lei 12.506, FGTS, INSS e IRRF.", color: "bg-violet-50 border-violet-200" },
          { icon: Briefcase,   label: "Módulo Pericial",        desc: "Revisão de juros/amortização (Price/SAC/Hamburguês), Lucro Cessante DCF com sensibilidade e Análise de Balanços com parser SPED Contábil.", color: "bg-amber-50 border-amber-200" },
          { icon: TrendingDown,label: "Módulo Cível",           desc: "Cálculo de danos materiais (danos emergentes e/ou lucros cessantes) com correção por IPCA-E, INPC, SELIC, TJMG ou índice manual.", color: "bg-rose-50 border-rose-200" },
          { icon: Heart,       label: "Módulo Família",         desc: "Revisão de pensão alimentícia com análise de capacidade contributiva, necessidade do alimentado e simulação de cenários.", color: "bg-pink-50 border-pink-200" },
          { icon: MapPin,      label: "Módulo Estadual",        desc: "Liquidação de sentença para a Justiça Estadual (TJMG) com correção pelo ICGJ/TJMG — sem aplicação da EC 113/2021.", color: "bg-teal-50 border-teal-200" },
          { icon: ShieldCheck, label: "Controladoria Jurídica", desc: "Gestão financeira completa do escritório: receitas, despesas, clientes, processos e relatórios.", color: "bg-emerald-50 border-emerald-200" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" />
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecSobre() {
  return (
    <div>
      <SectionTitle icon={BookOpen} label="Sobre o Sistema" />
      <Paragraph>
        O <strong>Veritas Analytics</strong> é uma plataforma SaaS (Software as a Service) desenvolvida para
        profissionais do direito que necessitam de cálculos judiciais precisos e padronizados conforme as normas
        do Conselho da Justiça Federal (CJF), do Tribunal Superior do Trabalho (TST) e da legislação previdenciária
        e trabalhista brasileira vigente.
      </Paragraph>
      <SubTitle>Fundamentos técnicos</SubTitle>
      <Paragraph>
        O sistema adota a metodologia do Manual de Cálculos da Justiça Federal (edição 2025) como base para os módulos
        previdenciários. Para os módulos trabalhistas, a metodologia é inspirada no sistema PJe-Calc do TST, com
        apuração por competência, cálculo progressivo de INSS, IRRF por faixas e apuração de todos os reflexos rescisórios.
        Os módulos periciais (Juros e Amortização e Lucro Cessante DCF) utilizam modelos financeiros reconhecidos
        internacionalmente, com motor de conclusão pericial automatizado.
      </Paragraph>
      <div className="grid gap-3 md:grid-cols-4 mb-6">
        {[
          { label: "Manual CJF",       value: "2025",   sub: "Referência previdenciária" },
          { label: "Manual TRT-3",     value: "2026/1", sub: "Referência trabalhista" },
          { label: "Tabela INSS",      value: "2025",   sub: "Faixas progressivas atualizadas" },
          { label: "IRRF",             value: "2024+",  sub: "Tabela vigente simplificada" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>
      <InfoBox color="amber" icon={AlertCircle} title="Aviso legal importante">
        O Veritas Analytics é uma ferramenta de apoio técnico. Os resultados gerados devem ser revisados por profissional
        habilitado. Os laudos produzidos pelo sistema não substituem a assinatura de perito judicial nomeado pelo juízo.
        Para fins de instrução processual, os cálculos devem ser atualizados com índices oficiais publicados pelos
        tribunais competentes até a data do efetivo pagamento.
      </InfoBox>
      <SubTitle>Tecnologia</SubTitle>
      <Paragraph>
        O sistema foi desenvolvido com tecnologias modernas de desenvolvimento web: React 18, TypeScript, Node.js e
        PostgreSQL. Os laudos PDF dos módulos periciais são gerados diretamente no navegador, sem envio de dados
        para o servidor, garantindo sigilo processual. A interface responsiva funciona em computadores, tablets e
        dispositivos móveis.
      </Paragraph>
    </div>
  );
}

function SecAutoria() {
  return (
    <div>
      <SectionTitle icon={GraduationCap} label="Autoria e Créditos" />
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-2xl font-black">VW</div>
          <div>
            <h3 className="text-lg font-black text-blue-900">Dr. Vasconcelos R. Wakim</h3>
            <p className="text-blue-700 font-medium text-sm mt-0.5">Perito Contador · Professor Universitário</p>
            <div className="flex items-center gap-2 mt-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-600">Universidade Federal dos Vales do Jequitinhonha e Mucuri — UFVJM</span>
            </div>
          </div>
        </div>
      </div>
      <Paragraph>
        O <strong>Veritas Analytics</strong> foi criado e desenvolvido por <strong>Dr. Vasconcelos R. Wakim</strong>,
        Perito Contador com vasta experiência em cálculos judiciais federais, especialmente nas áreas previdenciária
        e trabalhista. O Dr. Wakim atua como professor universitário na <strong>Universidade Federal dos Vales do
        Jequitinhonha e Mucuri (UFVJM)</strong>.
      </Paragraph>
      <SubTitle>Experiência e especialização</SubTitle>
      <Paragraph>
        Com décadas de atuação como Perito Contador nomeado pela Justiça Federal, o Dr. Wakim identificou a necessidade
        de uma ferramenta digital que traduzisse fielmente os critérios do Manual de Cálculos da Justiça Federal e
        do TST para um ambiente acessível, ágil e confiável. O resultado é o Veritas Analytics.
      </Paragraph>
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {[
          { icon: Scale,         label: "Perito Contador",      desc: "Nomeado pela Justiça Federal e Estadual em processos trabalhistas e previdenciários." },
          { icon: GraduationCap, label: "Professor Universitário", desc: "Docente de Contabilidade e Perícia Contábil na UFVJM." },
          { icon: BookOpen,      label: "Pesquisador",           desc: "Pesquisa aplicada em metodologias de cálculo judicial e atualização monetária." },
          { icon: Building2,     label: "UFVJM",                desc: "Universidade Federal dos Vales do Jequitinhonha e Mucuri, MG." },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-blue-600" /><span className="font-semibold text-sm">{label}</span></div>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
      <InfoBox color="emerald" icon={Info} title="Missão do sistema">
        Democratizar o acesso a cálculos judiciais de alta qualidade técnica, reduzindo o tempo e o custo de elaboração
        de laudos periciais e promovendo a segurança jurídica nos processos da Justiça Federal brasileira.
      </InfoBox>
    </div>
  );
}

function SecAcesso() {
  return (
    <div>
      <SectionTitle icon={User} label="Acesso e Autenticação" />
      <Paragraph>
        O acesso ao Veritas Analytics é feito por meio de usuário e senha cadastrados. O sistema utiliza autenticação
        segura baseada em JWT (JSON Web Token).
      </Paragraph>
      <SubTitle>Como fazer login</SubTitle>
      <StepList steps={[
        { n: 1, text: "Acesse a página inicial do sistema." },
        { n: 2, text: "Digite seu e-mail cadastrado e a senha definida no momento do cadastro." },
        { n: 3, text: "Clique em \"Entrar\". O sistema verificará suas credenciais e redirecionará para o dashboard." },
        { n: 4, text: "Caso esqueça a senha, entre em contato com o administrador do sistema para redefinição." },
      ]} />
      <SubTitle>Perfis de usuário</SubTitle>
      <div className="grid gap-3 md:grid-cols-2 mb-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-blue-800"><User className="w-4 h-4" /> Usuário Padrão</div>
          <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
            <li>Acesso aos módulos de cálculo conforme plano ativo</li>
            <li>Gestão da própria carteira de créditos</li>
            <li>Geração de laudos e relatórios</li>
            <li>Gerenciamento de equipe (planos avançados)</li>
          </ul>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-violet-800"><ShieldCheck className="w-4 h-4" /> Administrador</div>
          <ul className="text-xs text-violet-700 space-y-1.5 list-disc list-inside">
            <li>Acesso irrestrito a todos os módulos</li>
            <li>Gerenciamento de todos os usuários</li>
            <li>Painel financeiro e controle de vendas</li>
            <li>Configuração de planos e créditos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SecCreditos() {
  return (
    <div>
      <SectionTitle icon={Coins} label="Sistema de Créditos" />
      <Paragraph>
        O Veritas Analytics utiliza créditos para controlar a geração de laudos e relatórios. O acesso
        aos módulos de cálculo é liberado conforme o plano ativo — os campos podem ser preenchidos e os
        resultados visualizados livremente. Os créditos são debitados apenas no momento da <strong>emissão do
        relatório</strong>.
      </Paragraph>

      <SubTitle>Tipos de crédito</SubTitle>
      <div className="grid gap-3 md:grid-cols-2 mb-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <p className="font-semibold text-sm text-blue-800 mb-1">Créditos de Assinatura</p>
          <p className="text-xs text-blue-600 leading-relaxed">Concedidos mensalmente com a assinatura ativa. Expiram ao final do ciclo mensal e não são acumulados.</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="font-semibold text-sm text-emerald-800 mb-1">Créditos Avulsos</p>
          <p className="text-xs text-emerald-600 leading-relaxed">Adquiridos separadamente. Não expiram e são consumidos apenas após o esgotamento dos créditos de assinatura.</p>
        </div>
      </div>

      <SubTitle>Consumo por módulo e relatório</SubTitle>
      <InfoBox color="blue" icon={Info} title="Módulo Proposição — disponível em todos os planos">
        O Módulo Proposição (Cálculo do Valor da Causa) é o único disponível para todos os assinantes,
        independentemente do plano. A geração do relatório consome <strong>2 créditos</strong>.
      </InfoBox>
      <ModuleTable rows={[
        { feature: "Módulo Proposição — Relatório do Valor da Causa",    cost: "2 créditos",  plan: "Todos os planos" },
        { feature: "Módulo Previdenciário — Atualização Financeira",      cost: "5 créditos",  plan: "Essencial" },
        { feature: "Módulo Previdenciário — Liquidação de Sentença",      cost: "5 créditos",  plan: "Essencial" },
        { feature: "Módulo Trabalhista — Relatório Rescisório",           cost: "5 créditos",  plan: "Profissional" },
        { feature: "Módulo Cível — Laudo de Danos Materiais",             cost: "5 créditos",  plan: "Profissional" },
        { feature: "Módulo Família — Relatório de Revisão de Pensão",     cost: "5 créditos",  plan: "Avançado" },
        { feature: "Módulo Estadual — Liquidação TJMG",                   cost: "5 créditos",  plan: "Avançado" },
        { feature: "Módulo Pericial — Juros e Amortização (PDF)",         cost: "5 créditos",  plan: "Premium" },
        { feature: "Módulo Pericial — Lucro Cessante DCF (PDF)",          cost: "5 créditos",  plan: "Premium" },
        { feature: "Módulo Pericial — Análise de Balanços (PDF)",         cost: "5 créditos",  plan: "Premium" },
        { feature: "Controladoria Jurídica",                              cost: "Sem consumo", plan: "Avançado / Premium" },
      ]} />

      <InfoBox color="amber" icon={AlertCircle} title="Quando os créditos são debitados">
        Preencher campos e visualizar resultados ao vivo <strong>nunca consome créditos</strong>.
        O débito ocorre apenas ao clicar em <strong>"Gerar Relatório"</strong>, <strong>"Gerar Laudo"</strong>
        ou <strong>"Gerar PDF"</strong>, dependendo do módulo. Nos módulos Pericial, o PDF é gerado
        inteiramente no navegador (client-side), sem envio de dados para servidores externos.
      </InfoBox>

      <SubTitle>Como adquirir créditos</SubTitle>
      <StepList steps={[
        { n: 1, text: "No menu superior, clique no seu nome de usuário → \"Meus Créditos\"." },
        { n: 2, text: "Selecione o pacote de créditos avulsos desejado." },
        { n: 3, text: "Realize o pagamento pelo MercadoPago (PIX ou cartão de crédito)." },
        { n: 4, text: "Os créditos são creditados automaticamente após a confirmação do pagamento." },
      ]} />
    </div>
  );
}

function SecPlanos() {
  const plans = [
    {
      plan: "Essencial", price: "R$ 149/mês", credits: "50 créditos/mês",
      color: "border-slate-200 bg-slate-50/50", badge: "bg-slate-100 text-slate-700",
      tagline: "Para quem atua exclusivamente em previdência",
      modules: [
        { label: "Módulo Proposição (Valor da Causa)", note: "2 créditos — todos os planos" },
        { label: "Módulo Previdenciário", note: "Atualização Financeira + Liquidação de Sentença" },
      ],
      extras: ["Tabela de Índices", "Ferramentas básicas"],
    },
    {
      plan: "Profissional", price: "R$ 297/mês", credits: "120 créditos/mês",
      color: "border-blue-200 bg-blue-50/50", badge: "bg-blue-100 text-blue-700",
      tagline: "Para advogados e peritos em múltiplas áreas",
      modules: [
        { label: "Tudo do Essencial", note: "" },
        { label: "Módulo Trabalhista", note: "Rescisório completo — TRT-3ª / 2026-1" },
        { label: "Módulo Cível", note: "Danos emergentes e lucros cessantes" },
      ],
      extras: ["Backup e recuperação de cálculos"],
    },
    {
      plan: "Avançado", price: "R$ 497/mês", credits: "250 créditos/mês",
      color: "border-violet-200 bg-violet-50/50", badge: "bg-violet-100 text-violet-700",
      tagline: "Para escritórios com atuação estadual e familiar",
      modules: [
        { label: "Tudo do Profissional", note: "" },
        { label: "Módulo Família", note: "Revisão de pensão alimentícia" },
        { label: "Módulo Estadual", note: "Liquidação TJMG — índice ICGJ" },
        { label: "Controladoria Jurídica", note: "Gestão do escritório" },
      ],
      extras: ["Gestão de equipe", "Gestão de Índices (sinc. TJMG)"],
    },
    {
      plan: "Premium", price: "R$ 897/mês", credits: "Créditos ilimitados",
      color: "border-amber-200 bg-amber-50/50", badge: "bg-amber-100 text-amber-700",
      tagline: "Para peritos contadores e escritórios completos",
      modules: [
        { label: "Tudo do Avançado", note: "" },
        { label: "Módulo Pericial — Juros e Amortização", note: "Price / SAC / Hamburguês" },
        { label: "Módulo Pericial — Lucro Cessante (DCF)", note: "Análise de sensibilidade" },
        { label: "Módulo Pericial — Análise de Balanços", note: "Parser SPED Contábil" },
        { label: "Controladoria Jurídica completa", note: "Inteligência + conciliação" },
      ],
      extras: ["Suporte prioritário", "Relatórios ilimitados"],
    },
  ];

  return (
    <div>
      <SectionTitle icon={Crown} label="Planos e Assinaturas" />
      <Paragraph>
        O Veritas Analytics oferece quatro planos de assinatura mensais. Todos os planos incluem acesso ao
        Módulo Proposição (Valor da Causa). Os demais módulos são desbloqueados progressivamente conforme o plano.
        Os créditos são consumidos apenas na <strong>geração de relatórios</strong> — o uso dos cálculos ao vivo é
        sempre gratuito.
      </Paragraph>

      <InfoBox color="emerald" icon={Info} title="Módulo Proposição — presente em todos os planos">
        O Cálculo do Valor da Causa está disponível para todos os assinantes, desde o plano Essencial.
        A emissão do relatório consome <strong>2 créditos</strong>.
      </InfoBox>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {plans.map(({ plan, price, credits, color, badge, tagline, modules, extras }) => (
          <div key={plan} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge}`}>{plan}</span>
              <span className="text-sm font-bold">{price}</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{credits}</p>
            <p className="text-xs italic text-muted-foreground mb-3">{tagline}</p>
            <div className="space-y-1.5 mb-3">
              {modules.map((m) => (
                <div key={m.label} className="flex items-start gap-1.5">
                  <ChevronRight className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-foreground">{m.label}</span>
                    {m.note && <span className="text-xs text-muted-foreground"> — {m.note}</span>}
                  </div>
                </div>
              ))}
            </div>
            {extras.length > 0 && (
              <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                {extras.map((e) => (
                  <div key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" /> {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <SubTitle>Visão comparativa por módulo</SubTitle>
      <CompareTable
        headers={["Módulo", "Essencial", "Profissional", "Avançado", "Premium"]}
        rows={[
          ["Módulo Proposição (Valor da Causa)", "✓ 2 cr.", "✓ 2 cr.", "✓ 2 cr.", "✓ 2 cr."],
          ["Módulo Previdenciário",              "✓ 5 cr.", "✓ 5 cr.", "✓ 5 cr.", "✓ 5 cr."],
          ["Módulo Trabalhista",                 "—",       "✓ 5 cr.", "✓ 5 cr.", "✓ 5 cr."],
          ["Módulo Cível (Danos Materiais)",     "—",       "✓ 5 cr.", "✓ 5 cr.", "✓ 5 cr."],
          ["Módulo Família (Pensão)",            "—",       "—",       "✓ 5 cr.", "✓ 5 cr."],
          ["Módulo Estadual (TJMG)",             "—",       "—",       "✓ 5 cr.", "✓ 5 cr."],
          ["Módulo Pericial (3 ferramentas)",    "—",       "—",       "—",       "✓ 5 cr."],
          ["Controladoria Jurídica",             "—",       "—",       "Parcial", "Completa"],
          ["Gestão de Equipe",                   "—",       "—",       "✓",       "✓"],
          ["Créditos mensais",                   "50",      "120",     "250",     "Ilimitado"],
        ]}
      />
    </div>
  );
}

function SecPrevidenciario() {
  return (
    <div>
      <SectionTitle icon={Landmark} label="Módulo Previdenciário" />
      <Paragraph>
        O módulo previdenciário é o núcleo central do Veritas Analytics. Ele oferece três ferramentas específicas para
        cálculos judiciais na área previdenciária, todas baseadas no <strong>Manual de Cálculos da Justiça Federal
        (CJF, edição 2025)</strong>.
      </Paragraph>
      <SubTitle>Atualização Financeira</SubTitle>
      <Paragraph>
        Realiza a correção monetária e o cálculo de juros de parcelas previdenciárias vencidas, com apuração competência
        a competência. O sistema aplica automaticamente os índices de correção (INPC, IPCA-E ou SELIC) e os juros de
        mora conforme o marco temporal processual.
      </Paragraph>
      <StepList steps={[
        { n: 1, text: "Acesse: Cálculos → Previdenciário → Atualização Financeira." },
        { n: 2, text: "Preencha os dados do benefício: tipo, DIB, DER, data de ajuizamento, RMI e histórico salarial." },
        { n: 3, text: "Selecione o índice de correção e a metodologia de juros aplicável ao caso." },
        { n: 4, text: "Clique em \"Calcular\". O sistema processará a atualização e exibirá a tabela de parcelas." },
        { n: 5, text: "Use \"Gerar Laudo\" para exportar o relatório técnico em PDF." },
      ]} />
      <SubTitle>Liquidação de Sentença</SubTitle>
      <Paragraph>
        Calcula o montante a ser pago em cumprimento de sentença previdenciária. O módulo é organizado como um
        assistente guiado de <strong>8 etapas</strong>, garantindo o preenchimento completo e ordenado de todas
        as informações necessárias.
      </Paragraph>
      <div className="grid gap-2 mb-4">
        {[
          { n: "1", label: "Dados do Processo", desc: "Número do processo, vara, juiz e partes envolvidas." },
          { n: "2", label: "Correção Monetária", desc: "Índice de correção (INPC, IPCA-E ou SELIC), data-base e data de atualização." },
          { n: "3", label: "Juros de Mora", desc: "Metodologia de juros aplicável ao marco temporal processual." },
          { n: "4", label: "Partes e Parcelas", desc: "Cadastro dos credores e lançamento das competências devidas. Aceita importação automática via Extrator Contracheque SIAPE." },
          { n: "5", label: "Honorários Advocatícios", desc: "Configuração do tipo e percentual dos honorários sucumbenciais." },
          { n: "6", label: "Sucumbências", desc: "Custas processuais e outras verbas acessórias." },
          { n: "7", label: "Prescrição Quinquenal", desc: "Identificação e exclusão das parcelas prescritas conforme a data de ajuizamento." },
          { n: "8", label: "Dados Finais", desc: "Revisão geral, cálculo final e geração do laudo HTML/PDF." },
        ].map(({ n, label, desc }) => (
          <div key={n} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
            <div>
              <span className="text-sm font-medium">{label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <InfoBox color="blue" icon={Info} title="Etapa 4 — Importação SIAPE">
        Na etapa <strong>Partes e Parcelas</strong>, o sistema detecta automaticamente dados extraídos pelo
        Extrator Contracheque SIAPE. Ao abrir um processo após enviar os dados do extrator, um banner azul
        aparece no topo da aba com o botão <strong>Importar</strong>. Ao confirmar, cada rubrica SIAPE se
        torna uma parte (credor) com todas as competências preenchidas automaticamente via API.
      </InfoBox>
      <InfoBox color="amber" icon={AlertCircle} title="Etapa 7 — Prescrição Quinquenal">
        O sistema identifica as parcelas anteriores a 5 anos da data de ajuizamento e as destaca em vermelho
        na tabela de competências. Você pode confirmar ou ajustar manualmente as parcelas a excluir antes
        de prosseguir ao cálculo final.
      </InfoBox>
      <InfoBox color="emerald" icon={Info} title="Exclusão de partes e parcelas com confirmação">
        Ao clicar na lixeira de uma <strong>parte</strong> ou de uma <strong>parcela</strong>, o sistema
        exibe um diálogo de confirmação com os dados do item a ser excluído (nome da parte ou período e
        valor da parcela) antes de realizar a exclusão permanente.
      </InfoBox>
      <SubTitle>Módulo Proposição — Cálculo do Valor da Causa</SubTitle>
      <Paragraph>
        O <strong>Módulo Proposição</strong> determina o valor da causa para fins de distribuição processual e
        custas, conforme as regras da Resolução do CJF. Considera parcelas vencidas e 12 meses de parcelas
        vincendas atualizadas. É o único módulo disponível para <strong>todos os planos de assinatura</strong>.
      </Paragraph>
      <InfoBox color="emerald" icon={Info} title="Disponível em todos os planos — 2 créditos">
        O Módulo Proposição (Valor da Causa) está liberado desde o plano Essencial. A geração do relatório
        consome <strong>2 créditos</strong> — o menor custo entre todos os módulos.
      </InfoBox>
      <ModuleTable rows={[
        { feature: "Módulo Previdenciário — Atualização Financeira", cost: "5 créditos", plan: "Essencial" },
        { feature: "Módulo Previdenciário — Liquidação de Sentença", cost: "5 créditos", plan: "Essencial" },
        { feature: "Módulo Proposição — Valor da Causa",             cost: "2 créditos", plan: "Todos os planos" },
      ]} />
    </div>
  );
}

function SecTrabalhista() {
  return (
    <div>
      <SectionTitle icon={Scale} label="Módulo Trabalhista" />
      <Paragraph>
        O módulo trabalhista implementa o fluxo completo de cálculo rescisório por competência, com metodologia
        alinhada ao <strong>Manual de Cálculos da 3ª Região (TRT-3ª Região, edição 2026/1)</strong> e ao sistema
        PJe-Calc do TST.
      </Paragraph>
      <InfoBox color="blue" icon={Info} title="Disponibilidade">
        Disponível a partir do plano Profissional. Consome <strong>5 créditos por cálculo</strong>. Os créditos
        são debitados ao clicar em "Calcular", não na geração do laudo.
      </InfoBox>

      <SubTitle>Funcionalidades do módulo</SubTitle>
      <div className="grid gap-3 md:grid-cols-2 mb-4">
        {[
          "Apuração por competência mensal",
          "Evolução salarial com múltiplos períodos",
          "Horas extras 50% e 100% + DSR (Lei 605/49)",
          "Adicional noturno configurável (CLT Art. 73)",
          "Insalubridade — base salário mínimo (CLT Art. 192)",
          "Periculosidade 30% sobre salário contratual (CLT Art. 193)",
          "Aviso-prévio Lei 12.506/2011 com calculadora integrada",
          "Média de variáveis habituais para reflexos rescisórios",
          "FGTS 8% + Multa 40% (Lei 8.036/90)",
          "INSS progressivo (tabela 2025)",
          "IRRF por faixas de tributação",
          "13º proporcional (ávos mensais, Dec. 57.155/65)",
          "Férias + 1/3 constitucional",
          "Multa arts. 467 e 477 da CLT",
          "Memória de cálculo consolidada",
          "Laudo técnico em PDF (7 seções)",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> {f}
          </div>
        ))}
      </div>

      <SubTitle>1. Insalubridade — base de cálculo (CLT Art. 192 + Súmula 17 TST)</SubTitle>
      <Paragraph>
        Conforme o Manual TRT-3ª Região 2026/1 e jurisprudência consolidada (Súmula 17 do TST), a base de cálculo
        do adicional de insalubridade é o <strong>salário mínimo vigente</strong>, e não o salário base do contrato
        de trabalho. O sistema adota o salário mínimo de <strong>R$ 1.518,00</strong> (exercício 2025) como valor
        padrão, editável pelo usuário.
      </Paragraph>
      <InfoBox color="amber" icon={AlertCircle} title="Exceção: CCT ou ACT">
        Quando convenção ou acordo coletivo de trabalho (CCT/ACT) estabelecer expressamente que a base de insalubridade
        é o salário contratual, selecione a opção "Salário Base" no seletor do módulo. Neste caso, documente a norma
        coletiva no campo de observações do laudo.
      </InfoBox>
      <CompareTable
        headers={["Grau", "Percentual", "Base padrão (Súmula 17 TST)", "Valor (2025)"]}
        rows={[
          ["Mínimo",  "10%", "Salário mínimo (R$ 1.518,00)", "R$ 151,80"],
          ["Médio",   "20%", "Salário mínimo (R$ 1.518,00)", "R$ 303,60"],
          ["Máximo",  "40%", "Salário mínimo (R$ 1.518,00)", "R$ 607,20"],
        ]}
      />

      <SubTitle>2. Periculosidade (CLT Art. 193 + NR-16)</SubTitle>
      <Paragraph>
        O adicional de periculosidade corresponde a <strong>30% sobre o salário contratual</strong> (salário base
        do contrato, excluídos acréscimos provenientes de gratificações, prêmios ou participação nos lucros).
        Diferente da insalubridade, a periculosidade incide sempre sobre o salário contratual, independentemente
        de CCT/ACT.
      </Paragraph>
      <FormulaBox
        title="Periculosidade"
        formula={"Adicional = salário_contratual × 30%"}
        explanation="Base legal: CLT Art. 193, §1º e NR-16. O adicional é incompatível com insalubridade — o trabalhador pode optar pelo mais favorável (CLT Art. 193, §2º)."
      />

      <SubTitle>3. Aviso-prévio — Lei 12.506/2011</SubTitle>
      <Paragraph>
        O módulo inclui uma <strong>calculadora integrada do aviso-prévio proporcional</strong> conforme a Lei
        12.506/2011. Basta preencher as datas de admissão e demissão e clicar no botão "Lei 12.506" para
        preenchimento automático do prazo.
      </Paragraph>
      <FormulaBox
        title="Aviso-prévio proporcional — Lei 12.506/2011"
        formula={"Aviso (dias) = 30 + 3 × (anos_completos − 1)\n\nLimite máximo: 90 dias\n\nPara contratos < 1 ano: 30 dias"}
        explanation="Exemplo: 5 anos de contrato → 30 + 3 × (5 − 1) = 30 + 12 = 42 dias. Exemplo: 22 anos → 30 + 3 × 21 = 93 → limitado a 90 dias."
      />
      <InfoBox color="emerald" icon={Info} title="Cálculo automático">
        Ao preencher as datas de admissão e demissão no módulo, o prazo correto pela Lei 12.506/2011 é calculado
        e exibido em tempo real. Clique em "Lei 12.506" para preencher automaticamente o campo de dias de aviso.
      </InfoBox>

      <SubTitle>4. Média de variáveis habituais (Manual TRT-3ª Região 2026/1)</SubTitle>
      <Paragraph>
        O Manual TRT-3ª Região 2026/1 estabelece que verbas de natureza salarial habitual integram a base de
        cálculo das parcelas rescisórias reflexas (13º proporcional, férias proporcionais e aviso-prévio
        indenizado). O módulo calcula a <strong>média de variáveis</strong> incluindo todas as verbas habituais:
      </Paragraph>
      <BulletList items={[
        "Horas extras (50% e 100%) — média das competências do período",
        "DSR sobre horas extras — proporcional aos dias de repouso",
        "Adicional noturno — média das competências",
        "Adicional de insalubridade — quando habitual",
        "Adicional de periculosidade — quando habitual",
      ]} />
      <InfoBox color="blue" icon={Info} title="Por que incluir insalubridade e periculosidade na média?">
        O Manual TRT-3ª Região 2026/1 e a jurisprudência do TST (OJ 103 SDI-1 e Súmula 60) são categóricos:
        adicionais habituais de insalubridade e periculosidade têm natureza salarial e integram a média para
        fins de 13º, férias e aviso-prévio. A exclusão dessas verbas da média configura erro de cálculo
        impugnável.
      </InfoBox>

      <SubTitle>5. Estrutura do laudo PDF (7 seções)</SubTitle>
      <CompareTable
        headers={["Seção", "Conteúdo"]}
        rows={[
          ["1 — Parâmetros Aplicados",        "Processo, partes, período, tipo de rescisão, salário mínimo utilizado, base de insalubridade, aviso-prévio aplicado"],
          ["2 — Verbas Mensais por Competência", "Tabela mês a mês: salário, HE, adicional noturno, insalubridade, periculosidade, DSR"],
          ["3 — Média de Variáveis Habituais", "Cálculo da média para reflexos em 13º, férias e aviso-prévio"],
          ["4 — Encargos por Competência",    "FGTS (8%), INSS progressivo e IRRF por mês"],
          ["5 — Verbas Rescisórias",          "Aviso-prévio, 13º proporcional, férias proporcionais + 1/3, multa FGTS 40%, multas CLT 467/477"],
          ["6 — Consolidação do Crédito",     "Principal, reflexos, FGTS total, deduções de INSS e IRRF, valor líquido a receber"],
          ["7 — Observações Técnicas",        "Fundamentos legais, ressalvas sobre atualização monetária e validade do laudo"],
        ]}
      />

      <SubTitle>6. Como usar o módulo</SubTitle>
      <StepList steps={[
        { n: 1, text: "Acesse: Cálculos → Trabalhista no menu superior." },
        { n: 2, text: "Preencha os dados processuais: processo, vara, reclamante, reclamada e cargo." },
        { n: 3, text: "Informe as datas de admissão e demissão. O sistema calculará automaticamente o tempo de serviço e o prazo de aviso-prévio pela Lei 12.506/2011." },
        { n: 4, text: "Configure os períodos salariais (evolução salarial com múltiplas faixas se necessário)." },
        { n: 5, text: "Ative as verbas aplicáveis ao caso: horas extras, adicional noturno, insalubridade (com grau e base), periculosidade, etc." },
        { n: 6, text: "Para insalubridade, confirme se a base é salário mínimo (padrão, Súmula 17 TST) ou salário contratual (CCT/ACT)." },
        { n: 7, text: "Selecione o tipo de rescisão (sem justa causa, justa causa, pedido de demissão, acordo, etc.)." },
        { n: 8, text: "Clique em \"Calcular (5 créditos)\". O sistema processará todos os eventos por competência e exibirá o resultado consolidado." },
        { n: 9, text: "Revise os resultados na tela e clique em \"Gerar Laudo PDF\" para baixar o laudo técnico estruturado." },
      ]} />

      <ModuleTable rows={[
        { feature: "Cálculo completo com laudo PDF", cost: "5 créditos", plan: "Profissional" },
      ]} />
    </div>
  );
}

// ─── Seção Pericial (visão geral) ─────────────────────────────────────────────
function SecPericial() {
  return (
    <div>
      <SectionTitle icon={Briefcase} label="Módulo Pericial" />
      <Paragraph>
        O módulo pericial reúne três ferramentas especializadas para elaboração de laudos contábeis em processos
        cíveis envolvendo questões financeiras e contábeis complexas: revisão de contratos de crédito, apuração
        de lucro cessante e análise de balanços patrimoniais. Todos os módulos produzem laudos PDF estruturados
        com cabeçalho padrão Veritas.
      </Paragraph>
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-700" />
            <span className="font-semibold text-sm text-amber-900">Juros e Amortização</span>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed mb-3">
            Compara sistemas Price, SAC e Hamburguês. Calcula revisional por taxa de mercado e taxa legal.
            Classifica risco pericial. Gera laudo PDF com 7 seções.
          </p>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">5 créditos por laudo</Badge>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sigma className="w-4 h-4 text-blue-700" />
            <span className="font-semibold text-sm text-blue-900">Lucro Cessante (DCF)</span>
          </div>
          <p className="text-xs text-blue-700 leading-relaxed mb-3">
            Fluxo de caixa descontado com análise de sensibilidade em 4 cenários, verificação do modelo de
            Gordon, método alternativo de validação e motor de conclusão pericial automatizado.
          </p>
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">5 créditos por laudo</Badge>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            <span className="font-semibold text-sm text-emerald-900">Análise de Balanços</span>
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed mb-3">
            Parser automático de arquivo SPED Contábil (ECD) ou entrada manual. Consolida DRE e Balanço
            Patrimonial com validação da equação contábil e indicadores financeiros.
          </p>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">5 créditos por laudo</Badge>
        </div>
      </div>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
          <span className="font-semibold text-sm text-indigo-900">Extrator Contracheque SIAPE</span>
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-xs">Sem consumo de créditos</Badge>
        </div>
        <p className="text-xs text-indigo-700 leading-relaxed mb-3">
          Ferramenta de extração automática de dados salariais de contracheques do SIAPE (Sistema Integrado de
          Administração de Pessoal). Processa múltiplos PDFs anuais e extrai até 5 rubricas simultaneamente,
          gerando tabelas de competências com valores mensais. Os dados podem ser exportados em CSV ou enviados
          diretamente para o módulo de Atualização Financeira (Liquidação de Sentença).
        </p>
        <StepList steps={[
          { n: 1, text: "Acesse: Módulo Pericial → Extrator Contracheque SIAPE." },
          { n: 2, text: "Informe as rubricas desejadas (ex.: Vencimento Básico, Adicional de Insalubridade)." },
          { n: 3, text: "Arraste ou selecione os PDFs dos contracheques anuais do SIAPE." },
          { n: 4, text: "Aguarde o processamento — os valores são extraídos mês a mês por rubrica." },
          { n: 5, text: "Clique em \"Exportar CSV\" para download por rubrica, ou em \"Enviar\" para importar no módulo de Atualização Financeira." },
          { n: 6, text: "Após confirmar o envio, o sistema salva os dados e abre a lista de processos. Abra ou crie um processo e navegue até a etapa 4 (Partes e Parcelas) — um banner azul aparecerá com a opção de importar." },
        ]} />
      </div>
      <InfoBox color="blue" icon={Info} title="Documentação técnica detalhada">
        Selecione <strong>"↳ Juros e Amortização"</strong>, <strong>"↳ Lucro Cessante (DCF)"</strong> ou{" "}
        <strong>"↳ Análise de Balanços"</strong> no menu lateral para acessar a documentação técnica completa de
        cada módulo, incluindo fórmulas, metodologia e orientações de preenchimento.
      </InfoBox>
      <ModuleTable rows={[
        { feature: "Juros e Amortização — geração de laudo PDF",  cost: "5 créditos", plan: "Essencial" },
        { feature: "Lucro Cessante (DCF) — geração de laudo PDF", cost: "5 créditos", plan: "Profissional" },
        { feature: "Análise de Balanços — geração de laudo PDF",  cost: "5 créditos", plan: "Profissional" },
        { feature: "Extrator Contracheque SIAPE",                 cost: "Sem consumo", plan: "Essencial" },
      ]} />
    </div>
  );
}

// ─── Seção Análise de Balanços (detalhada) ────────────────────────────────────
function SecAnaliseBalan() {
  return (
    <div>
      <SectionTitle icon={BarChart3} label="Análise de Balanços — SPED Contábil" />
      <InfoBox color="emerald" icon={Info} title="Finalidade pericial">
        Este módulo destina-se à análise contábil e financeira de balanços patrimoniais e demonstrações de
        resultado, com geração de laudo PDF estruturado. Aceita importação automática do arquivo SPED Contábil
        (ECD — Escrituração Contábil Digital) ou entrada manual de valores. Os créditos são debitados ao clicar
        em "Processar SPED" ou "Calcular (manual)".
      </InfoBox>

      <SubTitle>1. Modos de entrada de dados</SubTitle>
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="font-semibold text-sm text-emerald-900 mb-2">Modo SPED Contábil (ECD)</p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Importe o arquivo .txt gerado pela Receita Federal (Sped Contábil / ECD). O sistema extrai
            automaticamente o plano de contas e os saldos, consolida as contas por grupo patrimonial e
            calcula todos os indicadores. Elimina o retrabalho de digitação e reduz erros.
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <p className="font-semibold text-sm text-blue-900 mb-2">Modo Manual</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Insira os valores diretamente nos campos do formulário: Ativo Circulante, Ativo Não Circulante,
            Passivo Circulante, Passivo Não Circulante, Patrimônio Líquido, Receita Líquida, Lucro Líquido
            e EBITDA. Ideal para análise rápida ou quando o arquivo ECD não está disponível.
          </p>
        </div>
      </div>

      <SubTitle>2. Parser SPED Contábil — algoritmo de consolidação</SubTitle>
      <Paragraph>
        O parser lê o arquivo ECD linha a linha, identificando os registros de saldo de contas (registro I155)
        e o plano de contas (registro I050). A consolidação dos grupos patrimoniais utiliza uma cadeia de
        prioridade em três níveis para garantir exatidão:
      </Paragraph>
      <BulletList items={[
        "Prioridade 1 — Por código de conta: busca o saldo da conta cujo código corresponde exatamente ao grupo (ex.: código '1' para Ativo Total). Evita dupla contagem de totalizadores e sub-itens.",
        "Prioridade 2 — Por título headline: busca o saldo da conta cuja descrição corresponde ao nome oficial do grupo (ex.: 'ATIVO CIRCULANTE'). Usado quando o código não é encontrado.",
        "Prioridade 3 — Soma de folhas (leaf-sum): soma apenas as contas-folha do grupo (contas sem filhos), utilizada exclusivamente para sub-itens de nível 3 ou superior sem código próprio.",
      ]} />
      <InfoBox color="amber" icon={AlertTriangle} title="Por que a cadeia de prioridade é importante?">
        Planos de contas SPED incluem linhas de totalização (ex.: saldo da conta 1 = Ativo Total) e sub-contas.
        Somar indiscriminadamente resultaria em dupla contagem. A cadeia de prioridade garante que cada grupo
        seja apurado exatamente uma vez, pelo saldo do totalizador correto.
      </InfoBox>

      <SubTitle>3. Validação da equação contábil</SubTitle>
      <Paragraph>
        Após o processamento, o sistema verifica automaticamente a equação fundamental da contabilidade:
      </Paragraph>
      <FormulaBox
        title="Equação contábil fundamental"
        formula={"Ativo Total = Passivo Total + Patrimônio Líquido\n\nDiferença absoluta = |Ativo − (Passivo + PL)|\nDiferença relativa = Diferença / Ativo × 100%"}
        explanation="O resultado da validação é exibido em um painel colorido: verde quando a equação fecha (diferença < 0,01%), âmbar quando há diferença relevante que pode indicar erro no plano de contas ou no arquivo ECD."
      />

      <SubTitle>4. Indicadores financeiros calculados</SubTitle>
      <CompareTable
        headers={["Indicador", "Fórmula", "Interpretação"]}
        rows={[
          ["Liquidez Geral (LG)",     "AC + ARLP / PC + PNC",         "> 1: patrimônio líquido cobre dívidas de longo prazo"],
          ["Liquidez Corrente (LC)",  "AC / PC",                       "> 1: ativo circulante cobre passivo circulante"],
          ["Liquidez Seca (LS)",      "(AC − Estoques) / PC",          "Exclui estoques — mais conservador"],
          ["Endividamento Geral (%)", "(PC + PNC) / Ativo × 100",      "< 50%: maior independência financeira"],
          ["ROA (%)",                 "Lucro Líquido / Ativo × 100",   "Retorno sobre o total de ativos"],
          ["ROE (%)",                 "Lucro Líquido / PL × 100",      "Retorno sobre o capital próprio"],
          ["Margem Líquida (%)",      "Lucro Líquido / Receita × 100", "Percentual da receita convertido em lucro"],
          ["EBITDA Margin (%)",       "EBITDA / Receita × 100",        "Eficiência operacional antes de encargos financeiros"],
        ]}
      />

      <SubTitle>5. Como usar o módulo — Modo SPED</SubTitle>
      <StepList steps={[
        { n: 1, text: "Acesse: Cálculos → Pericial → Análise de Balanços." },
        { n: 2, text: "Selecione a aba \"SPED Contábil (ECD)\"." },
        { n: 3, text: "Preencha os dados gerais: empresa, CNPJ, período de apuração, processo e perito responsável." },
        { n: 4, text: "Arraste o arquivo .txt do SPED Contábil para a área de upload ou clique para selecioná-lo." },
        { n: 5, text: "Clique em \"Processar SPED (5 créditos)\". O sistema realizará o parse, consolidação e validação automaticamente." },
        { n: 6, text: "Verifique o painel de validação da equação contábil (verde = equilibrado, âmbar = divergência)." },
        { n: 7, text: "Revise os indicadores financeiros calculados e clique em \"Gerar Laudo PDF\" para baixar o relatório." },
      ]} />

      <SubTitle>6. Como usar o módulo — Modo Manual</SubTitle>
      <StepList steps={[
        { n: 1, text: "Selecione a aba \"Entrada Manual\"." },
        { n: 2, text: "Preencha os dados gerais da empresa e o período de apuração." },
        { n: 3, text: "Insira os valores do Balanço Patrimonial: AC, ANC, PC, PNC e PL." },
        { n: 4, text: "Insira os dados da DRE: Receita Líquida, Lucro Líquido e EBITDA." },
        { n: 5, text: "Clique em \"Calcular (5 créditos)\". Os indicadores serão calculados imediatamente." },
        { n: 6, text: "Verifique o painel de validação e os indicadores, depois clique em \"Gerar Laudo PDF\"." },
      ]} />

      <ModuleTable rows={[
        { feature: "Análise de Balanços via SPED (ECD) ou Manual — PDF", cost: "5 créditos", plan: "Profissional" },
      ]} />

      <InfoBox color="blue" icon={Info} title="Sobre o arquivo SPED Contábil (ECD)">
        O arquivo ECD é gerado pelo módulo de Escrituração Contábil Digital da Receita Federal. O formato
        utilizado pelo parser é o padrão .txt com registros delimitados por "|". O sistema aceita arquivos
        de qualquer tamanho, processando-os inteiramente no navegador sem upload para servidores externos,
        garantindo o sigilo das informações.
      </InfoBox>
    </div>
  );
}

// ─── Seção Juros e Amortização (detalhada) ───────────────────────────────────
function SecJuros() {
  return (
    <div>
      <SectionTitle icon={TrendingUp} label="Juros e Amortização com Motor Pericial" />
      <InfoBox color="amber" icon={AlertCircle} title="Finalidade pericial">
        Este módulo destina-se à elaboração de laudos periciais em ações revisionais de contratos de crédito e
        financiamento, servindo como prova técnica nos autos. O resultado é um laudo A4 de 7 seções gerado em
        PDF diretamente pelo navegador. Os créditos são debitados apenas no momento da geração do PDF.
      </InfoBox>

      <SubTitle>1. Fundamentos teóricos dos sistemas de amortização</SubTitle>
      <Paragraph>
        Um contrato de financiamento define como o saldo devedor é reduzido ao longo do tempo por meio de prestações
        periódicas que compreendem uma parcela de juros e uma parcela de amortização do principal. Os três sistemas
        comparados pelo módulo têm comportamentos distintos:
      </Paragraph>

      <SubSubTitle>Sistema Price (Francês)</SubSubTitle>
      <Paragraph>
        No sistema Price, a prestação é constante ao longo de todo o contrato. Os juros são calculados sobre o
        saldo devedor ao início de cada período; a amortização é a diferença entre a prestação constante e os
        juros do período. Como os juros iniciais são maiores (saldo ainda elevado), a amortização do principal é
        pequena no início e cresce progressivamente.
      </Paragraph>
      <FormulaBox
        title="Prestação constante — Sistema Price"
        formula={"PMT = PV × [ i × (1+i)ⁿ ] / [ (1+i)ⁿ − 1 ]\n\nOnde:\n  PMT = prestação mensal constante\n  PV  = valor principal (saldo devedor inicial)\n  i   = taxa de juros efetiva mensal (decimal)\n  n   = número de períodos (meses)"}
        explanation="A prestação é única e imutável. Juros do período k: J(k) = Saldo(k-1) × i. Amortização(k) = PMT − J(k). Saldo(k) = Saldo(k-1) − Amortização(k)."
      />

      <SubSubTitle>Sistema SAC (Saldo Amortizado Constante)</SubSubTitle>
      <Paragraph>
        No SAC, a amortização do principal é constante e igual a PV/n. Os juros são calculados sobre o saldo
        devedor remanescente, que diminui uniformemente. Como consequência, as prestações são decrescentes: a
        primeira é a mais elevada e a última é a mais baixa.
      </Paragraph>
      <FormulaBox
        title="Amortização e prestação — Sistema SAC"
        formula={"Amortização(k) = PV / n   [constante]\n\nSaldo(k)       = PV − k × (PV/n)\nJuros(k)       = Saldo(k-1) × i\nPrestação(k)   = Amortização + Juros(k)   [decrescente]"}
        explanation="A amortização é uniforme. A prestação diminui a cada período porque os juros incidem sobre um saldo menor. Paga-se menos juros totais do que no Price, para a mesma taxa e prazo."
      />

      <SubSubTitle>Sistema Hamburguês</SubSubTitle>
      <Paragraph>
        O sistema Hamburguês utiliza a mesma fórmula de prestação constante do Price, mas com uma variante de
        capitalização: os juros são calculados sobre o saldo médio (ou saldo do início do período), e não sobre
        o saldo no início de cada mês. Na implementação do sistema, o comportamento financeiro é equivalente ao
        Price para fins de comparação pericial. A distinção técnica reside na forma como os extratos bancários
        registram e capitalizam os encargos ao longo do tempo.
      </Paragraph>

      <SubTitle>2. Conversão de taxa contínua para efetiva</SubTitle>
      <Paragraph>
        Quando a taxa informada no contrato é contínua (exponencial), o módulo realiza automaticamente a conversão
        para a taxa efetiva mensal equivalente, que é a taxa correta para uso nas fórmulas de amortização:
      </Paragraph>
      <FormulaBox
        title="Conversão: taxa contínua → taxa efetiva"
        formula={"i_efetiva = e^(r) − 1\n\nOnde:\n  r = taxa contínua mensal informada (em decimal, ex.: 0,06 para 6%)\n  e = número de Euler ≈ 2,71828"}
        explanation="Exemplo: taxa contínua de 6% a.m. → i_efetiva = e^(0,06) − 1 ≈ 6,1837% a.m. efetiva."
      />

      <SubTitle>3. Análise revisional</SubTitle>
      <Paragraph>
        A análise revisional recalcula o contrato substituindo a taxa contratada por dois benchmarks: a taxa de
        mercado informada e a taxa legal. A diferença entre o total pago pelo contrato analisado e o total pago
        nos cenários revisional indica o sobrecusto potencial — base técnica para pedido de revisão, repetição
        de indébito ou redução de encargos.
      </Paragraph>
      <CompareTable
        headers={["Cenário", "Taxa aplicada", "Total pago", "Finalidade"]}
        rows={[
          ["Contrato analisado", "Taxa contratada (efetiva)", "Valor apurado", "Base da análise"],
          ["Revisional mercado", "Taxa de mercado (informada)", "Valor recalculado", "Referência de mercado"],
          ["Revisional legal",   "Taxa legal/selic (informada)", "Valor recalculado", "Referência normativa"],
        ]}
      />

      <SubTitle>4. Indicadores periciais automáticos</SubTitle>
      <Paragraph>
        O módulo calcula automaticamente os seguintes indicadores, que compõem a síntese pericial e alimentam
        o motor de conclusão:
      </Paragraph>
      <CompareTable
        headers={["Indicador", "Fórmula / critério", "Limiar de alerta"]}
        rows={[
          ["Peso dos juros (%)", "Total de juros / Total pago × 100", "≥ 40% → flag pericial"],
          ["Comprometimento da renda (%)", "Prestação inicial / Renda mensal × 100", "≥ 30% → flag pericial"],
          ["Sobrecusto vs mercado (R$)", "Total pago − Total revisional mercado", "Qualquer valor positivo"],
          ["Sobrecusto vs taxa legal (R$)", "Total pago − Total revisional legal", "Qualquer valor positivo"],
          ["Spread entre sistemas (R$)", "Maior total pago − Menor total pago", "≥ 10% do principal"],
        ]}
      />

      <SubTitle>5. Achados periciais (flags) e classificação de risco</SubTitle>
      <Paragraph>
        O sistema verifica automaticamente cinco condições que podem indicar onerosidade ou irregularidade contratual.
        Cada condição detectada gera um achado pericial visual (bandeira âmbar) e aumenta o escore de risco:
      </Paragraph>
      <BulletList items={[
        "Taxa contratada materialmente superior à taxa de mercado informada (fator ≥ 1,5×).",
        "Participação dos juros ≥ 40% do custo total do contrato.",
        "Prestação inicial compromete ≥ 30% da renda mensal informada.",
        "Diferença financeira relevante entre os sistemas de amortização (spread ≥ 10% do principal).",
        "Concentração financeira compatível com investigação de capitalização relevante (juros > 70% do principal, sistema não-SAC).",
      ]} />
      <Paragraph>
        A classificação final é: <strong>BAIXO</strong> (0–1 flag), <strong>MODERADO</strong> (2–3 flags) ou
        <strong>ALTO</strong> (4–5 flags).
      </Paragraph>

      <SubTitle>6. Motor de conclusão pericial automatizado</SubTitle>
      <Paragraph>
        Com base nos parâmetros inseridos e nos indicadores calculados, o sistema gera automaticamente:
      </Paragraph>
      <BulletList items={[
        "Resumo executivo: síntese dos principais resultados em linguagem técnico-jurídica.",
        "Achados técnicos: lista de constatações sobre o contrato analisado.",
        "Parâmetros jurídicos: fundamentos aplicáveis (equilíbrio contratual, boa-fé objetiva, capacidade de pagamento).",
        "Conclusão final: texto estruturado com o resultado da análise e orientação para apreciação judicial.",
      ]} />
      <InfoBox color="blue" icon={Info} title="Natureza da conclusão automatizada">
        O texto gerado pelo motor de conclusão é uma síntese técnica estruturada com base nos dados inseridos.
        Ele não substitui o julgamento profissional do perito responsável, que deve revisar, adaptar e assinar
        o laudo antes de juntá-lo aos autos.
      </InfoBox>

      <SubTitle>7. Estrutura do laudo PDF (7 seções)</SubTitle>
      <CompareTable
        headers={["Seção", "Conteúdo"]}
        rows={[
          ["I — Dados da Perícia",         "Processo, partes, contrato, data, juízo de referência"],
          ["II — Dados do Financiamento",  "Principal, taxa informada, taxa efetiva, períodos, sistema foco"],
          ["III — Comparação dos Sistemas","Tabela Price × SAC × Hamburguês com juros totais, total pago e prestações"],
          ["IV — Síntese Pericial e Revisional", "Indicadores calculados, sobrecusto vs mercado e vs taxa legal, risco"],
          ["V — Memória de Cálculo",       "Tabela período a período do sistema foco: prestação, juros, amortização, saldo"],
          ["VI — Motor de Conclusão Pericial", "Resumo executivo, achados técnicos, parâmetros jurídicos, conclusão final"],
          ["VII — Observações Técnicas",   "Finalidade pericial, base legal e observações adicionais"],
        ]}
      />

      <SubTitle>8. Como usar o módulo</SubTitle>
      <StepList steps={[
        { n: 1, text: "Acesse: Cálculos → Pericial → Juros e Amortização no menu superior." },
        { n: 2, text: "Preencha os dados processuais e jurídicos: número do processo, partes, contrato, juízo e base legal." },
        { n: 3, text: "Informe os parâmetros financeiros: principal, taxa mensal informada, número de períodos, sistema foco." },
        { n: 4, text: "Configure o tipo de taxa (contínua ou efetiva), a taxa de mercado e a taxa legal para análise revisional." },
        { n: 5, text: "Os resultados ao vivo (KPIs, achados, tabela comparativa, memória de cálculo) atualizam automaticamente enquanto você preenche." },
        { n: 6, text: "Revise os achados periciais e o motor de conclusão na tela." },
        { n: 7, text: "Clique em \"Gerar PDF (5 créditos)\" para baixar o laudo completo." },
      ]} />
    </div>
  );
}

// ─── Seção Lucro Cessante / DCF (detalhada) ──────────────────────────────────
function SecDCF() {
  return (
    <div>
      <SectionTitle icon={Sigma} label="Lucro Cessante com DCF — Blindagem Pericial" />
      <InfoBox color="blue" icon={Info} title="Finalidade pericial">
        Este módulo é destinado à apuração judicial de lucro cessante em ações indenizatórias pelo método do Fluxo
        de Caixa Descontado (DCF). Inclui análise de sensibilidade em 4 cenários, verificação automática do modelo
        de Gordon, método alternativo de validação e motor de conclusão pericial. Os créditos são debitados apenas
        no momento de gerar o PDF.
      </InfoBox>

      <SubTitle>1. O método DCF — Fundamentos teóricos</SubTitle>
      <Paragraph>
        O Fluxo de Caixa Descontado (Discounted Cash Flow — DCF) é o método financeiro padrão para estimar o
        valor presente de fluxos futuros esperados. No contexto pericial, o objeto de apuração é o lucro cessante:
        a perda de ganhos que a parte lesada auferiria se o evento danoso não tivesse ocorrido.
      </Paragraph>
      <Paragraph>
        O método parte de um <strong>Fluxo de Caixa Livre (FCF)</strong> inicial estimado (geralmente baseado
        nos rendimentos históricos da parte autora antes do dano), crescimento projetado e uma taxa de desconto
        que representa o custo de oportunidade do capital — isto é, o rendimento que esse fluxo proporcionaria
        se houvesse a normalidade do negócio ou da atividade.
      </Paragraph>

      <SubTitle>2. Projeção dos fluxos explícitos</SubTitle>
      <FormulaBox
        title="FCF do período t (fluxo crescente)"
        formula={"FCF(t) = FCF₁ × (1 + g)^(t−1)\n\nOnde:\n  FCF₁ = fluxo de caixa inicial (período 1)\n  g    = taxa anual de crescimento do FCF (%)\n  t    = índice do período (1, 2, …, n)"}
        explanation="O crescimento é exponencial: cada período tem um FCF maior do que o anterior pelo fator (1+g). Se g=0, o FCF é constante."
      />
      <FormulaBox
        title="Valor presente do período t"
        formula={"VP(t) = FCF(t) / (1 + r)^t\n\nOnde:\n  r = taxa de desconto anual (% a.a.)\n  t = período"}
        explanation="A divisão por (1+r)^t traz o valor futuro para o presente, refletindo o custo de oportunidade."
      />
      <FormulaBox
        title="Σ VP dos fluxos explícitos"
        formula={"NPV_fluxos = Σ(t=1 até n) VP(t)\n\n         = Σ FCF₁×(1+g)^(t−1) / (1+r)^t"}
        explanation="A soma de todos os valores presentes dos fluxos projetados no horizonte explícito (n períodos)."
      />

      <SubTitle>3. Valor terminal — Modelo de Gordon (perpetuidade com crescimento)</SubTitle>
      <Paragraph>
        O valor terminal captura os fluxos além do horizonte explícito projetado, assumindo crescimento perpétuo
        a uma taxa terminal <em>gₜ</em>. O modelo de Gordon (Gordon Growth Model) é o padrão para esse cálculo:
      </Paragraph>
      <FormulaBox
        title="Valor terminal bruto (Gordon Growth Model)"
        formula={"VT = FCF(n+1) / (r − gₜ)\n\n   = FCF(n) × (1 + gₜ) / (r − gₜ)\n\nOnde:\n  FCF(n) = último FCF do horizonte explícito\n  gₜ     = crescimento terminal (% a.a.)\n  r      = taxa de desconto (% a.a.)\n  (r − gₜ) = spread positivo obrigatório"}
        explanation="A fórmula é válida apenas quando r > gₜ. Se r ≤ gₜ, o denominador é nulo ou negativo, tornando o modelo economicamente inconsistente."
      />
      <FormulaBox
        title="Valor presente do terminal"
        formula={"VP_terminal = VT / (1 + r)^n"}
        explanation="O valor terminal bruto é trazido ao presente dividindo-o pelo fator de desconto do último período n."
      />

      <SubTitle>4. Detecção automática de inconsistência do Gordon</SubTitle>
      <InfoBox color="amber" icon={AlertTriangle} title="Condição crítica do modelo">
        <p>Se a taxa de desconto <strong>r ≤ crescimento terminal gₜ</strong>, o modelo de Gordon é matematicamente
        inválido: o denominador (r − gₜ) é zero ou negativo, gerando um valor terminal infinito ou negativo.
        O módulo detecta essa condição automaticamente e:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Exibe flag de alerta pericial na interface;</li>
          <li>Zera o valor terminal no cálculo principal;</li>
          <li>Registra a ocorrência na seção VI do laudo com justificativa técnica;</li>
          <li>Ajusta a conclusão final para não incorporar o valor terminal.</li>
        </ul>
      </InfoBox>
      <Paragraph>
        A exclusão do valor terminal por inconsistência do Gordon é tecnicamente justificável para evitar
        superavaliação artificial do quantum indenizatório — argumento que o sistema explicita no laudo para
        antecipar eventuais impugnações.
      </Paragraph>

      <SubTitle>5. Análise de sensibilidade — 4 cenários</SubTitle>
      <Paragraph>
        Para conferir robustez probatória ao laudo e antecipar questionamentos de contraditores, o módulo calcula
        automaticamente 4 cenários de sensibilidade variando as taxas de desconto, crescimento do FCF e crescimento
        terminal:
      </Paragraph>
      <CompareTable
        headers={["Cenário", "Taxa de desconto (r)", "Crescimento FCF (g)", "Crescimento terminal (gₜ)", "Finalidade"]}
        rows={[
          ["Conservador",   "r + 4%",      "g − 1%",   "gₜ − 1%",     "Premissas mais adversas ao credor"],
          ["Moderado",      "r + 2%",      "g",        "min(gₜ, r+1%)", "Premissas intermediárias"],
          ["Base do laudo", "r",           "g",        "gₜ",           "Premissas centrais adotadas"],
          ["Otimista",      "máx(r−1%, 0,5%)", "g + 1%", "gₜ + 0,5%", "Premissas mais favoráveis ao credor"],
        ]}
      />
      <Paragraph>
        Em cada cenário, o Gordon é re-verificado: se o spread r − gₜ for inválido, o valor terminal é excluído
        naquele cenário específico (exibido como "Inválido" na coluna Gordon da tabela de sensibilidade).
      </Paragraph>

      <SubTitle>6. Método alternativo de validação</SubTitle>
      <Paragraph>
        Para aumentar a consistência externa do laudo e fornecer um segundo ponto de referência independente,
        o módulo calcula o <strong>método alternativo de validação</strong> como média entre dois métodos auxiliares:
      </Paragraph>
      <FormulaBox
        title="Método alternativo"
        formula={"Valor_alt = (FCF_histórico × n + FCF_linear × n) / 2\n\nOnde:\n  FCF_histórico = média histórica do FCF informada\n  FCF_linear    = referência de projeção linear informada\n  n             = número de períodos projetados"}
        explanation="O resultado serve como âncora de plausibilidade para o valor apurado pelo DCF. Um valor alternativo muito distante do DCF indica sensibilidade elevada das premissas."
      />

      <SubTitle>7. Classificação de risco pericial</SubTitle>
      <Paragraph>
        O sistema calcula um escore de risco com base nas flags detectadas e nas relações entre as taxas:
      </Paragraph>
      <BulletList items={[
        "+1 ponto por cada flag ativa (Gordon inválido, desconto < crescimento, desconto nulo/negativo, FCF inicial não-positivo).",
        "+1 ponto se o spread r − gₜ ≤ 1 pp (modelo próximo da inconsistência).",
        "+1 ponto se r ≤ 2% (taxa de desconto muito baixa, atípica em contexto judicial).",
        "Escore 0–1: BAIXO | Escore 2–3: MODERADO | Escore 4+: ALTO.",
      ]} />

      <SubTitle>8. Motor de conclusão pericial automatizado</SubTitle>
      <Paragraph>
        A conclusão pericial é gerada automaticamente com base em todos os parâmetros e resultados. O laudo inclui:
      </Paragraph>
      <BulletList items={[
        "Resumo executivo: valor total, risco, taxa de desconto e crescimento.",
        "Achados técnicos: análise do NPV dos fluxos, do valor terminal, da amplitude da sensibilidade e do método alternativo.",
        "Parâmetros jurídicos: razoabilidade econômica, aderência documental, contraditório técnico, validade da perpetuidade.",
        "Conclusão final: texto estruturado com o valor apurado, ressalvas sobre o valor terminal e orientações sobre interpretação judicial.",
      ]} />

      <SubTitle>9. Estrutura do laudo PDF (7 seções)</SubTitle>
      <CompareTable
        headers={["Seção", "Conteúdo"]}
        rows={[
          ["I — Dados Gerais",                   "Processo, requerente, ano-base, finalidade, responsável técnico, base legal"],
          ["II — Parâmetros do Modelo",           "FCF₁, g, r, gₜ, horizonte, habilitação do valor terminal, auxiliares"],
          ["III — Demonstrativo da Projeção",     "Tabela período a período: FCF, fator de desconto, VP"],
          ["IV — Valor Terminal e Apuração",      "NPV dos fluxos, VT bruto, VP do terminal, total, Gordon, risco, método alternativo"],
          ["V — Sensibilidade e Método Alternativo", "Tabela dos 4 cenários + valor do método auxiliar"],
          ["VI — Análise Crítica e Motor Pericial", "Resumo, achados, alertas de premissa, parâmetros jurídicos"],
          ["VII — Conclusão Pericial",            "Parâmetros jurídicos detalhados, conclusão final, observações técnicas"],
        ]}
      />

      <SubTitle>10. Como usar o módulo</SubTitle>
      <StepList steps={[
        { n: 1,  text: "Acesse: Cálculos → Pericial → Lucro Cessante (DCF)." },
        { n: 2,  text: "Preencha os dados gerais: parte requerente, número do processo, ano-base, responsável técnico, finalidade pericial e base legal." },
        { n: 3,  text: "Informe os parâmetros econômicos: FCF inicial (receita ou caixa livre mensal/anual do período anterior ao dano), taxa de crescimento anual, taxa de desconto (WACC ou custo de oportunidade), crescimento terminal e horizonte projetado." },
        { n: 4,  text: "Informe os auxiliares: FCF histórico médio e referência linear, utilizados no método alternativo de validação." },
        { n: 5,  text: "Selecione se o valor terminal (Gordon) deve ser incluído ou não, com base nas premissas do caso concreto." },
        { n: 6,  text: "Os KPIs ao vivo (NPV, VP do terminal, total, risco) atualizam automaticamente enquanto você preenche os campos." },
        { n: 7,  text: "Verifique os alertas críticos (flags) e a tabela de sensibilidade para checar a robustez do resultado." },
        { n: 8,  text: "Leia a conclusão pericial automatizada e ajuste os textos de finalidade e observações conforme o caso." },
        { n: 9,  text: "Clique em \"Gerar PDF (5 créditos)\" para baixar o laudo completo em A4." },
      ]} />

      <SubTitle>11. Orientações para o perito</SubTitle>
      <InfoBox color="emerald" icon={Info} title="Boas práticas periciais">
        <ul className="space-y-2 list-disc list-inside">
          <li><strong>FCF inicial:</strong> deve ser fundamentado em documentação (balanços, DRE, declarações de IR, contratos, extratos). Valores sem lastro documental são impugnáveis.</li>
          <li><strong>Taxa de desconto:</strong> deve refletir o risco setorial da atividade e o custo de oportunidade razoável. Taxas muito baixas inflam artificialmente o resultado e fragilizam o laudo.</li>
          <li><strong>Crescimento do FCF:</strong> idealmente baseado em médias históricas do setor e no histórico da empresa/atividade. Crescimento acima da inflação histórica exige justificativa expressa.</li>
          <li><strong>Valor terminal:</strong> adequado apenas quando há perspectiva razoável de continuidade da atividade além do horizonte explícito. Em caso de encerramento definitivo, desative-o.</li>
          <li><strong>Sensibilidade:</strong> analise se os 4 cenários resultam em valores dentro de faixa razoável. Grande amplitude indica alta sensibilidade das premissas e recomenda maior cautela na apresentação do resultado base.</li>
        </ul>
      </InfoBox>

      <InfoBox color="amber" icon={AlertCircle} title="Interpretação judicial">
        O resultado do DCF é uma estimativa técnica condicionada às premissas adotadas. Sob ótica judicial, deve ser
        interpretado como piso ou teto de referência, não como valor absoluto. O contraditório sobre as premissas
        (especialmente FCF inicial, taxa de desconto e crescimento) é inerente à prova pericial por DCF e deve ser
        antecipado no laudo.
      </InfoBox>
    </div>
  );
}

function SecControladoria() {
  return (
    <div>
      <SectionTitle icon={ShieldCheck} label="Controladoria Jurídica" />
      <Paragraph>
        A Controladoria Jurídica é um sistema de gestão financeira completo para escritórios de advocacia e peritos
        judiciais. Disponível a partir do plano Profissional.
      </Paragraph>
      <SubTitle>Módulos disponíveis</SubTitle>
      <div className="grid gap-2 mb-4">
        {[
          { label: "Dashboard",            plan: "Profissional", desc: "Visão geral financeira do escritório com gráficos e indicadores." },
          { label: "Receitas",             plan: "Profissional", desc: "Registro e categorização de entradas financeiras." },
          { label: "Despesas",             plan: "Profissional", desc: "Controle de gastos e despesas operacionais." },
          { label: "Contas a Receber",     plan: "Profissional", desc: "Gestão de honorários e valores a receber dos clientes." },
          { label: "Contas a Pagar",       plan: "Profissional", desc: "Controle de obrigações financeiras e vencimentos." },
          { label: "Fluxo de Caixa",       plan: "Profissional", desc: "Projeção e acompanhamento do caixa." },
          { label: "Clientes",             plan: "Profissional", desc: "Cadastro e gestão de clientes e processos associados." },
          { label: "Processos",            plan: "Profissional", desc: "Controle processual e financeiro integrado." },
          { label: "Custas Processuais",   plan: "Avançado",     desc: "Registro e gestão de custas e despesas processuais." },
          { label: "Repasses",             plan: "Avançado",     desc: "Controle de repasses a clientes e parceiros." },
          { label: "Gestão de Tributos",   plan: "Avançado",     desc: "Apuração e controle de obrigações tributárias." },
          { label: "Conciliação Bancária", plan: "Avançado",     desc: "Conciliação de extratos bancários com lançamentos." },
          { label: "Relatórios",           plan: "Avançado",     desc: "Relatórios gerenciais e demonstrações financeiras." },
          { label: "Inteligência Jurídica",plan: "Premium",      desc: "Análises avançadas e previsões financeiras." },
        ].map(({ label, plan, desc }) => (
          <div key={label} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <div className="flex-1">
              <span className="text-sm font-medium">{label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <Badge variant="outline" className="flex-shrink-0 text-xs mt-0.5">{plan}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecCivel() {
  return (
    <div>
      <SectionTitle icon={TrendingDown} label="Módulo Cível — Danos Materiais" />
      <Paragraph>
        O módulo Cível abrange o cálculo de danos materiais em ações cíveis e indenizatórias, cobrindo
        <strong> danos emergentes</strong> (prejuízos efetivamente sofridos), <strong>lucros cessantes</strong>
        (ganhos que deixaram de ser auferidos) ou ambos na mesma ação.
      </Paragraph>
      <InfoBox color="blue" icon={Info} title="Acesso">
        Disponível a partir do plano Profissional. Acesse pelo menu <strong>Cálculos → Cível → Danos Materiais</strong>.
        O laudo consome <strong>5 créditos</strong> ao ser gerado.
      </InfoBox>

      <SubTitle>Tipo de cálculo suportado</SubTitle>
      <div className="grid gap-2 mb-4">
        {[
          { label: "Danos Emergentes", desc: "Montante de prejuízo imediato com atualização desde a data do evento, correção monetária e juros moratórios." },
          { label: "Lucros Cessantes", desc: "Estimativa dos ganhos esperados não realizados em decorrência do dano, com critério de evidência probatória (robusta/parcial/ausente)." },
          { label: "Ambos combinados", desc: "Cálculo unificado com subtotais separados para danos emergentes e lucros cessantes, consolidando o pedido total da demanda." },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-1" />
            <div><span className="text-sm font-medium">{label}</span><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
          </div>
        ))}
      </div>

      <SubTitle>Índices de correção disponíveis</SubTitle>
      <CompareTable
        headers={["Índice", "Estimativa anual", "Uso típico"]}
        rows={[
          ["IPCA-E",    "8% a.a.", "Padrão em ações cíveis federais — art. 1º-F da Lei 9.494/97"],
          ["INPC",      "7% a.a.", "Ações com débitos de natureza previdenciária ou alimentar"],
          ["IGP-M",     "6% a.a.", "Quando previsto em contrato ou determinado expressamente"],
          ["TJMG (ICGJ)","8% a.a.","Ações perante a Justiça Estadual de MG — sem EC 113/2021"],
          ["SELIC",     "12% a.a.","Fase 2: correção + juros nas ações federais pós-dez/2021 (EC 113/2021)"],
          ["Manual",    "Livre",   "Percentual definido diretamente pelo perito"],
        ]}
      />

      <SubTitle>Parâmetros financeiros configuráveis</SubTitle>
      <BulletList items={[
        "Natureza da responsabilidade: contratual ou extracontratual (define o termo inicial dos juros de mora)",
        "Modelo de juros: 1% ao mês, SELIC ou sem juros",
        "Data do evento (fact), data-base da correção e data do cálculo",
        "Comprovação dos lucros cessantes: robusta (100%), parcial (60%) ou ausente (30%)",
        "Itens de danos emergentes com data do gasto e valor histórico",
        "Itens de lucros cessantes mensais com data de início e término",
      ]} />

      <SubTitle>Fundamentação do laudo PDF</SubTitle>
      <Paragraph>
        O laudo gerado cita as bases legais aplicáveis: art. 186 e 927 do Código Civil (responsabilidade civil),
        art. 402 CC (lucros cessantes), art. 403 CC (nexo causal), além do índice de correção selecionado e
        sua respectiva base normativa. O relatório discrimina danos emergentes e lucros cessantes com subtotais
        e apresenta o total geral atualizado com correção e juros.
      </Paragraph>
    </div>
  );
}

function SecFamilia() {
  return (
    <div>
      <SectionTitle icon={Heart} label="Módulo Família — Revisão de Pensão Alimentícia" />
      <Paragraph>
        O módulo Família apoia a fundamentação técnico-jurídica em ações de revisão de pensão alimentícia
        (majoração, redução ou exoneração), fornecendo análise quantitativa da capacidade contributiva do
        alimentante, das necessidades do alimentado e simulação de cenários de fixação.
      </Paragraph>
      <InfoBox color="blue" icon={Info} title="Acesso">
        Disponível a partir do plano Profissional. Acesse pelo menu <strong>Cálculos → Família → Revisão de Pensão</strong>.
        O laudo consome <strong>5 créditos</strong> ao ser gerado.
      </InfoBox>

      <SubTitle>Estrutura do módulo</SubTitle>
      <div className="grid gap-2 mb-4">
        {[
          { n: "1", label: "Dados do Caso",      desc: "Processo, tribunal, vara, fase processual e fundamento do título." },
          { n: "2", label: "Partes",              desc: "Cadastro completo do alimentado, alimentante, outro genitor e representante legal." },
          { n: "3", label: "Título Atual",        desc: "Forma da obrigação (valor fixo, percentual do salário ou rendimentos líquidos), valor atual, incidência sobre 13º, férias e rescisórias." },
          { n: "4", label: "Necessidades",        desc: "Levantamento detalhado das despesas do alimentado por categoria: moradia, saúde, educação, alimentação, lazer etc." },
          { n: "5", label: "Possibilidades",      desc: "Rendimentos do alimentante e do outro genitor com grau de confiabilidade, permitindo análise da capacidade contributiva." },
          { n: "6", label: "Fatos Relevantes",    desc: "Registro de eventos que impactam a fixação: emprego, doença, novo filho, mudança de salário." },
          { n: "7", label: "Simulador de Cenários", desc: "Gera automaticamente três cenários (conservador, intermediário, expansivo) e calcula retroativos estimados para os últimos 12 meses." },
        ].map(({ n, label, desc }) => (
          <div key={n} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
            <div><span className="text-sm font-medium">{label}</span><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
          </div>
        ))}
      </div>

      <SubTitle>Índice de correção dos retroativos</SubTitle>
      <Paragraph>
        Na tabela de diferenças retroativas simuladas, o perito pode escolher o índice de correção aplicável ao caso:
      </Paragraph>
      <CompareTable
        headers={["Índice", "Taxa mensal estimada", "Quando usar"]}
        rows={[
          ["IPCA-E", "0,64%/mês", "Padrão — ações de família na Justiça Federal"],
          ["INPC",   "0,57%/mês", "Obrigações alimentares de caráter previdenciário"],
          ["SELIC",  "0,95%/mês", "Quando determinado expressamente pelo juízo"],
          ["Manual", "Livre",     "Taxa definida pelo perito conforme o caso concreto"],
        ]}
      />
      <InfoBox color="amber" icon={AlertCircle} title="Caráter estimativo dos retroativos">
        Os retroativos simulados têm caráter ilustrativo para fins de fundamentação pericial e negociação. O cálculo
        definitivo dos alimentos em atraso deve observar os valores efetivamente pagos mês a mês e as regras
        processuais aplicáveis ao cumprimento de sentença.
      </InfoBox>

      <SubTitle>Análise de robustez</SubTitle>
      <Paragraph>
        O módulo calcula automaticamente um índice de robustez da prova (0–100%) baseado na qualidade da documentação
        apresentada para necessidades e possibilidades. Quanto maior a robustez, mais fundamentado é o pedido revisional.
      </Paragraph>
    </div>
  );
}

function SecEstadual() {
  return (
    <div>
      <SectionTitle icon={MapPin} label="Módulo Estadual — Justiça Estadual (TJMG)" />
      <Paragraph>
        O módulo Estadual é dedicado à liquidação de sentença em ações perante a <strong>Justiça Estadual de Minas
        Gerais (TJMG)</strong>, aplicando o <strong>ICGJ/TJMG</strong> como índice de correção monetária — conforme
        as tabelas de fatores de atualização publicadas pelo próprio tribunal.
      </Paragraph>
      <InfoBox color="blue" icon={Info} title="Acesso">
        Disponível a partir do plano Profissional. Acesse pelo menu <strong>Cálculos → Estadual → Liquidação Estadual</strong>.
        O laudo consome <strong>5 créditos</strong> ao ser gerado.
      </InfoBox>

      <SubTitle>Por que um módulo separado para o TJMG?</SubTitle>
      <InfoBox color="amber" icon={AlertTriangle} title="EC 113/2021 não se aplica à Justiça Estadual">
        A Emenda Constitucional 113/2021 (que substituiu IPCA-E por SELIC nas ações federais a partir de dezembro
        de 2021) aplica-se <strong>exclusivamente</strong> à Justiça Federal e ao STF/STJ. O TJMG
        <strong> continua adotando o IPCA-E</strong> como base do seu índice próprio (ICGJ/TJMG) após novembro
        de 2021. Utilizar SELIC em processos do TJMG é metodologicamente incorreto.
      </InfoBox>

      <SubTitle>O índice ICGJ/TJMG — série histórica embarcada</SubTitle>
      <Paragraph>
        O TJMG publica uma tabela de <em>fatores acumulados</em> em formato Excel, sem API pública para consulta
        automatizada. Para garantir disponibilidade permanente dos dados, o Veritas Analytics possui a série completa
        do ICGJ/TJMG <strong>embarcada internamente</strong>:
      </Paragraph>
      <CompareTable
        headers={["Período", "Registros", "Fonte", "Status"]}
        rows={[
          ["jul/1994 → nov/2021", "329 meses", "IBGE IPCA-E (base do ICGJ)", "Embarcado — disponível offline"],
          ["dez/2021 → mar/2026", "51 meses",  "IBGE IPCA-E via API",        "Embarcado + sincronização online"],
          ["Meses futuros",       "—",         "IBGE IPCA-E via API",        "Sincronizado automaticamente"],
        ]}
      />
      <InfoBox color="emerald" icon={Info} title="Sincronização de meses recentes">
        O administrador do sistema pode atualizar o ICGJ/TJMG para meses recentes acessando
        <strong> Ferramentas → Gestão de Índices → Sincronizar</strong>. O sistema consulta a API do IBGE para
        obter as taxas IPCA-E mais recentes (que o TJMG adota como base do seu índice).
      </InfoBox>

      <SubTitle>Índices de correção disponíveis no módulo</SubTitle>
      <CompareTable
        headers={["Índice", "Estimativa anual", "Aplicação"]}
        rows={[
          ["TJMG (ICGJ)", "7,5% a.a.", "Padrão — ações na Justiça Estadual de MG"],
          ["IPCA-E",      "8,0% a.a.", "Quando determinado por decisão específica do juízo"],
          ["INPC",        "7,0% a.a.", "Obrigações alimentares e previdenciárias estaduais"],
          ["IGP-M",       "6,0% a.a.", "Contratos com cláusula expressa de IGP-M"],
          ["SELIC",       "12% a.a.",  "Quando expressamente determinado pelo juízo estadual"],
          ["Manual",      "Livre",     "Taxa definida pelo perito"],
        ]}
      />

      <SubTitle>Consulta ao índice TJMG</SubTitle>
      <Paragraph>
        Acesse <strong>Cálculos → Estadual → Índice TJMG</strong> para consultar os fatores de atualização
        do ICGJ/TJMG por período, calcular o fator acumulado entre duas datas e gerar o cálculo de atualização
        de um valor histórico. A ferramenta é gratuita e não consome créditos.
      </Paragraph>
    </div>
  );
}

function SecIndicesInfo() {
  return (
    <div>
      <SectionTitle icon={LineChart} label="Gestão de Índices" />
      <Paragraph>
        O Veritas Analytics mantém uma base de dados interna de índices de correção monetária, com três camadas
        de dados: <strong>histórica embarcada</strong> (sempre disponível), <strong>sincronizada online</strong>
        (via APIs do IBGE e Banco Central) e <strong>histórica documental</strong> (ORTN/OTN/BTN importados de PDFs).
      </Paragraph>

      <SubTitle>Índices disponíveis</SubTitle>
      <CompareTable
        headers={["Índice", "Período embarcado", "API online", "Uso principal"]}
        rows={[
          ["IPCA-E",    "jul/1994–nov/2021", "IBGE SIDRA série 3065", "Correção — ações federais Fase 1 (até nov/2021)"],
          ["INPC",      "jul/1994–nov/2021", "IBGE SIDRA série 1736", "Correção — benefícios previdenciários e trabalhistas"],
          ["SELIC",     "jan/2003–jun/2026", "BCB SGS série 4390",    "Correção+juros — ações federais Fase 2 (a partir dez/2021)"],
          ["Poupança",  "nov/2008–dez/2021", "BCB SGS série 195",     "Juros de mora — ações contra Fazenda Pública (jul/2009–)"],
          ["IGP-DI",    "—",                 "BCB SGS série 190",     "Contratos privados e ações com determinação judicial"],
          ["TJMG (ICGJ)","jul/1994–mar/2026","IBGE IPCA-E (base)",    "Correção — ações na Justiça Estadual de MG"],
          ["ORTN/OTN/BTN","1964–1991",       "Não há (documental)",   "Correção monetária histórica pré-Real"],
          ["UFIR",      "1992–2001",         "Não há (documental)",   "Correção de débitos fiscais federais"],
        ]}
      />

      <SubTitle>Como sincronizar índices recentes</SubTitle>
      <StepList steps={[
        { n: 1, text: "Acesse Ferramentas → Gestão de Índices." },
        { n: 2, text: "Na aba \"Fontes Online\", clique em \"Sincronizar\" ao lado do índice desejado ou use \"Sincronizar Todos\" para atualizar todos de uma vez." },
        { n: 3, text: "O sistema consultará a API do IBGE (IPCA-E, INPC) ou do Banco Central (SELIC, Poupança, IGP-DI) e gravará os dados mais recentes no banco." },
        { n: 4, text: "Para o TJMG (ICGJ), a sincronização usa a API do IBGE IPCA-E, que é a série adotada pelo tribunal." },
      ]} />

      <SubTitle>Série histórica embarcada (sem internet)</SubTitle>
      <Paragraph>
        Para garantir que os cálculos funcionem mesmo sem acesso à internet ou quando as APIs do IBGE/BCB estiverem
        indisponíveis, o sistema possui dados históricos completos embarcados para IPCA-E (jul/1994–nov/2021),
        INPC (jul/1994–nov/2021), SELIC (jan/2003–jun/2026) e TJMG (jul/1994–mar/2026).
      </Paragraph>
      <InfoBox color="emerald" icon={Info} title="Diferença IPCA-E × TJMG na série embarcada">
        A série embarcada do IPCA-E termina em <strong>novembro/2021</strong> porque a partir de dezembro/2021 a
        Justiça Federal passou a usar SELIC (EC 113/2021). Já a série do <strong>TJMG continua até março/2026</strong>
        porque a EC 113/2021 não se aplica à Justiça Estadual — o TJMG segue usando IPCA-E depois dessa data.
      </InfoBox>

      <SubTitle>Índices históricos documentais (ORTN/OTN/BTN)</SubTitle>
      <Paragraph>
        As séries ORTN (1964–1986), OTN (1986–1989), BTN (1989–1991) e UFIR (1992–2001) não possuem API pública
        oficial. Os dados são extraídos de publicações do Banco Central, IBGE e Receita Federal e importados via
        arquivo PDF pelo administrador do sistema, ficando disponíveis na aba "Histórico Documental" da página de
        Gestão de Índices.
      </Paragraph>

      <SubTitle>Tabela de Índices (consulta pública)</SubTitle>
      <Paragraph>
        Acesse <strong>Ferramentas → Índices</strong> para visualizar as taxas mensais de cada índice,
        consultar o fator acumulado entre datas e verificar a fundamentação legal de cada série.
        Esta página é informativa e não consome créditos.
      </Paragraph>
    </div>
  );
}

function SecFerramentas() {
  return (
    <div>
      <SectionTitle icon={Calculator} label="Ferramentas" />
      <SubTitle>Tabela de Índices</SubTitle>
      <Paragraph>
        Exibe as tabelas de índices de correção monetária utilizados nos cálculos: IPCA-E, INPC, SELIC, Poupança,
        IGP-DI, <strong>TJMG (ICGJ)</strong>, ORTN/OTN/BTN e UFIR. Permite consulta por período para verificação
        e fundamentação técnica. Inclui cartões informativos com legislação aplicável e link para a fonte oficial.
      </Paragraph>
      <SubTitle>Gestão de Índices (Admin)</SubTitle>
      <Paragraph>
        Painel administrativo para sincronização das séries históricas via APIs oficiais do IBGE e Banco Central.
        Permite atualizar IPCA-E, INPC, SELIC, Poupança, IGP-DI e TJMG para meses recentes, além de importar
        séries históricas documentais (ORTN/OTN/BTN/UFIR) via PDF.
      </Paragraph>
      <SubTitle>Backup de Cálculos</SubTitle>
      <Paragraph>
        Permite exportar todos os cálculos realizados na plataforma em formato JSON para backup local.
      </Paragraph>
      <SubTitle>Recuperar Cálculo</SubTitle>
      <Paragraph>
        Restaura um cálculo previdenciário previamente salvo por meio de sua chave pública única.
      </Paragraph>
      <StepList steps={[
        { n: 1, text: "No menu Ferramentas, clique em \"Recuperar Cálculo\"." },
        { n: 2, text: "Cole a chave pública do cálculo (formato: PALAVRA-PALAVRA-XXXX-XXXX, ex: CLARO-CONTA-B68A-9CED)." },
        { n: 3, text: "Pressione Enter ou clique na seta para carregar o cálculo." },
      ]} />
    </div>
  );
}

function SecEquipe() {
  return (
    <div>
      <SectionTitle icon={Users} label="Gestão de Equipe" />
      <Paragraph>
        Usuários dos planos Avançado e Premium podem convidar e gerenciar membros de equipe, compartilhando créditos
        e colaborando na elaboração de laudos.
      </Paragraph>
      <SubTitle>Como adicionar um membro</SubTitle>
      <StepList steps={[
        { n: 1, text: "Acesse o menu de usuário → \"Equipe\"." },
        { n: 2, text: "Clique em \"Convidar membro\" e informe o e-mail do profissional." },
        { n: 3, text: "O convidado receberá instruções para criar sua conta." },
        { n: 4, text: "Após o aceite, o membro terá acesso ao sistema com os módulos definidos pelo gestor." },
      ]} />
    </div>
  );
}

function SecRelatorios() {
  return (
    <div>
      <SectionTitle icon={FileText} label="Relatórios e Laudos" />
      <Paragraph>
        Todos os módulos de cálculo do Veritas Analytics permitem a geração de laudos técnicos em formato PDF, prontos
        para juntada processual.
      </Paragraph>
      <SubTitle>Padrão dos laudos</SubTitle>
      <Paragraph>
        Os laudos seguem o padrão profissional Veritas: cabeçalho em azul-marinho com nome da plataforma e e-mail
        do usuário, seções numeradas, tabelas com linhas alternadas e rodapé com data e hora de emissão.
      </Paragraph>
      <SubTitle>Resumo dos laudos por módulo</SubTitle>
      <CompareTable
        headers={["Módulo", "Formato", "Conteúdo", "Geração"]}
        rows={[
          ["Juros e Amortização",        "PDF A4 (jsPDF)",       "7 seções estruturadas",              "Client-side — 5 créditos ao gerar PDF"],
          ["Lucro Cessante (DCF)",       "PDF A4 (jsPDF)",       "7 seções estruturadas",              "Client-side — 5 créditos ao gerar PDF"],
          ["Análise de Balanços",        "PDF A4 (jsPDF)",       "Balanço + DRE + indicadores",        "Client-side — 5 créditos ao processar"],
          ["Danos Materiais (Cível)",    "HTML Veritas",         "Danos emergentes + lucros cessantes","5 créditos ao gerar laudo"],
          ["Revisão de Pensão (Família)","HTML Veritas",         "Análise + 3 cenários + retroativos", "5 créditos ao gerar laudo"],
          ["Liquidação Estadual (TJMG)", "HTML Veritas",         "Parcelas + correção ICGJ/TJMG",      "5 créditos ao gerar laudo"],
          ["Trabalhista",                "HTML → Print/PDF",     "7 seções + memória de cálculo",      "5 créditos ao calcular; PDF via Ctrl+P"],
          ["Atualização Financeira",     "HTML → Print/PDF",     "Tabela de parcelas + correção",      "5 créditos ao calcular; PDF via Ctrl+P"],
          ["Liquidação de Sentença",     "HTML → Print/PDF",     "Parcelas, honorários, prescrição",   "5 créditos ao calcular; PDF via Ctrl+P"],
          ["Extrator SIAPE",             "CSV por rubrica",      "Data; Valor por competência",        "Sem créditos — download direto"],
        ]}
      />
      <SubTitle>Como gerar um laudo pericial (PDF direto)</SubTitle>
      <StepList steps={[
        { n: 1, text: "Preencha todos os campos do módulo. Os resultados ao vivo não consomem créditos." },
        { n: 2, text: "Clique no botão \"Gerar PDF (5 créditos)\" — disponível nos módulos Juros e Amortização, Lucro Cessante e Análise de Balanços." },
        { n: 3, text: "O sistema debitará 5 créditos e gerará o PDF diretamente no seu navegador." },
        { n: 4, text: "O download do arquivo PDF iniciará automaticamente e será salvo na pasta padrão do navegador." },
      ]} />
      <InfoBox color="blue" icon={Info} title="Geração local de PDF">
        Os laudos dos módulos Juros e Amortização, Lucro Cessante (DCF) e Análise de Balanços são gerados
        inteiramente no navegador (client-side), sem envio de dados a servidores externos. Isso garante o
        sigilo processual das informações inseridas.
      </InfoBox>
      <SubTitle>Como gerar um laudo previdenciário ou trabalhista</SubTitle>
      <StepList steps={[
        { n: 1, text: "Execute o cálculo no módulo correspondente (os créditos são debitados neste momento)." },
        { n: 2, text: "Clique em \"Gerar Laudo PDF\" no módulo para abrir a versão formatada em nova aba." },
        { n: 3, text: "Use Ctrl+P (ou Cmd+P no Mac) e selecione \"Salvar como PDF\" na janela de impressão." },
      ]} />
      <InfoBox color="amber" icon={AlertCircle} title="Validade do laudo">
        Os laudos gerados pelo Veritas Analytics são documentos de apoio técnico. Para ter validade processual plena,
        o documento deve ser revisado e assinado pelo perito judicial nomeado pelo juízo.
      </InfoBox>
    </div>
  );
}

function SecFAQ() {
  const faqs = [
    { q: "Os créditos expiram?",
      a: "Créditos de assinatura expiram ao final de cada ciclo mensal e não são acumulados. Créditos avulsos (comprados separadamente) não expiram e são consumidos apenas após o esgotamento dos créditos de assinatura." },
    { q: "Quando os créditos são debitados em cada módulo?",
      a: "Os créditos são debitados somente no momento da geração do relatório/laudo — nunca ao preencher campos ou visualizar resultados ao vivo. Especificamente: Módulo Proposição: ao gerar o relatório (2 créditos). Módulo Previdenciário: ao clicar em \"Calcular\" (5 créditos). Módulos Cível, Família e Estadual: ao clicar em \"Gerar Laudo\" (5 créditos). Módulos Periciais (PDF): ao clicar em \"Gerar PDF\" (5 créditos). Análise de Balanços: ao clicar em \"Processar SPED\" ou \"Calcular\" (5 créditos)." },
    { q: "O Módulo Proposição (Valor da Causa) é gratuito?",
      a: "Não. O Módulo Proposição está disponível para todos os planos de assinatura, mas a emissão do relatório consome 2 créditos. O preenchimento dos dados e a visualização do cálculo ao vivo continuam sem custo. É o módulo com menor custo de relatório da plataforma." },
    { q: "Quais módulos estão disponíveis em cada plano?",
      a: "Essencial (R$ 149/mês): Módulo Proposição + Módulo Previdenciário. Profissional (R$ 297/mês): + Módulo Trabalhista + Módulo Cível. Avançado (R$ 497/mês): + Módulo Família + Módulo Estadual (TJMG) + Controladoria Jurídica. Premium (R$ 897/mês): + Módulo Pericial completo (Juros e Amortização + DCF + Análise de Balanços) + Controladoria completa + Créditos ilimitados. O Módulo Proposição está disponível em todos os planos." },
    { q: "Como funciona o Extrator Contracheque SIAPE?",
      a: "O Extrator SIAPE processa PDFs de contracheques do Sistema Integrado de Administração de Pessoal, extraindo os valores mensais de até 5 rubricas (ex.: Vencimento Básico, Adicional de Insalubridade). Após a extração, você pode exportar os dados em CSV (um arquivo por rubrica, no formato Data;Valor) ou clicar em \"Enviar\" para importar automaticamente na etapa Partes e Parcelas da Liquidação de Sentença. A ferramenta não consome créditos." },
    { q: "Como importar dados do SIAPE para um processo de Liquidação de Sentença?",
      a: "1. No Extrator Contracheque SIAPE, após extrair os dados, clique em \"Enviar\" e confirme. O sistema salva os dados e abre a lista de processos. 2. Abra ou crie um processo de Atualização Financeira (Liquidação de Sentença). 3. Na etapa 4 (Partes e Parcelas), um banner azul aparecerá listando as rubricas disponíveis. 4. Clique em \"Importar\" — cada rubrica se torna automaticamente uma parte (credor) com todas as competências preenchidas. Os dados do SIAPE ficam disponíveis até serem importados ou descartados (botão X no banner)." },
    { q: "Por que aparece um diálogo de confirmação ao excluir partes ou parcelas?",
      a: "Por segurança, toda exclusão permanente no módulo de Liquidação de Sentença exige confirmação explícita. Ao clicar na lixeira de uma parte, o sistema exibe o nome da parte e a quantidade de parcelas que serão removidas. Ao clicar na lixeira de uma parcela, o sistema exibe o período e o valor antes de excluir. Isso evita exclusões acidentais irreversíveis." },
    { q: "Como funciona a Prescrição Quinquenal na Liquidação de Sentença?",
      a: "Na etapa 7 do assistente de Liquidação de Sentença, o sistema aplica a regra da prescrição quinquenal: todas as competências anteriores a 5 anos da data de ajuizamento do processo são marcadas como prescritas e excluídas do cálculo final. O usuário pode revisar e ajustar manualmente quais parcelas serão excluídas antes de avançar para a etapa 8 (cálculo final e laudo)." },
    { q: "O PDF do laudo pericial é seguro?",
      a: "Sim. Os laudos dos módulos Juros e Amortização, Lucro Cessante (DCF) e Análise de Balanços são gerados inteiramente no navegador (client-side), sem envio dos dados para servidores externos. Isso garante o sigilo das informações processuais." },
    { q: "O módulo trabalhista segue qual referência normativa?",
      a: "O módulo trabalhista está alinhado ao Manual de Cálculos da 3ª Região (TRT-3ª Região, edição 2026/1) e ao sistema PJe-Calc do TST. Especificamente: insalubridade com base no salário mínimo (CLT Art. 192 + Súmula 17 TST), periculosidade sobre o salário contratual (CLT Art. 193), aviso-prévio pela Lei 12.506/2011, e média de variáveis incluindo insalubridade e periculosidade para os reflexos rescisórios." },
    { q: "Por que a base da insalubridade é o salário mínimo e não o salário do trabalhador?",
      a: "Porque a CLT (Art. 192) e a Súmula 17 do TST estabelecem expressamente que a base de cálculo do adicional de insalubridade é o salário mínimo vigente, salvo quando CCT ou ACT preveja base diferente. O sistema permite alterar a base para salário contratual quando houver norma coletiva nesse sentido." },
    { q: "Como funciona o cálculo do aviso-prévio pela Lei 12.506/2011?",
      a: "A Lei 12.506/2011 estabelece: 30 dias base + 3 dias por ano completo acima de 1 ano, com limite máximo de 90 dias. Exemplo: 8 anos de contrato → 30 + 3×(8−1) = 30+21 = 51 dias. O módulo calcula automaticamente ao preencher as datas de admissão e demissão — basta clicar em \"Lei 12.506\" para preencher o campo." },
    { q: "O que é o arquivo SPED Contábil (ECD) e como usá-lo na Análise de Balanços?",
      a: "O SPED Contábil (ECD — Escrituração Contábil Digital) é o arquivo .txt gerado pelo módulo de escrituração da Receita Federal. No módulo Análise de Balanços, basta arrastar ou selecionar o arquivo na aba \"SPED Contábil\". O sistema extrai o plano de contas e os saldos automaticamente, consolida os grupos patrimoniais e calcula os indicadores. Nenhum dado é enviado para servidores externos." },
    { q: "O que acontece quando a equação contábil não fecha no balanço?",
      a: "O sistema exibe um painel âmbar com a diferença absoluta e percentual entre Ativo Total e (Passivo + PL). Isso pode indicar: (a) conta de totalização ausente ou duplicada no plano de contas SPED, (b) lançamentos de ajuste não registrados, ou (c) entrada manual incompleta. O laudo PDF registra a divergência e recomenda revisão do plano de contas." },
    { q: "O que é o modelo de Gordon e por que ele pode ser rejeitado?",
      a: "O modelo de Gordon (Gordon Growth Model) calcula o valor terminal de uma empresa como a perpetuidade de um fluxo crescente. Ele exige que a taxa de desconto seja maior que o crescimento terminal. Se essa condição não for atendida, o modelo gera valores infinitos ou negativos, sendo automaticamente desconsiderado pelo sistema, com justificativa técnica inserida no laudo." },
    { q: "Qual a diferença entre os sistemas Price, SAC e Hamburguês?",
      a: "No Price, a prestação é constante e os juros ocupam parcela maior no início (amortização crescente). No SAC, a amortização é constante e as prestações são decrescentes (juros totais menores). O Hamburguês tem comportamento similar ao Price na implementação do módulo. O sistema pericial compara os três para identificar qual foi contratado e quantificar eventuais diferenças." },
    { q: "O que é a análise de sensibilidade do DCF?",
      a: "A análise de sensibilidade recalcula o lucro cessante com 4 combinações diferentes de taxas (Conservador, Moderado, Base do laudo e Otimista), mostrando a variação do resultado conforme as premissas. Isso confere robustez ao laudo e antecipa questionamentos de contraditores." },
    { q: "Posso usar o sistema em dispositivos móveis?",
      a: "Sim. O sistema é responsivo e funciona em smartphones e tablets. Para conforto na elaboração de laudos, recomendamos o uso em computador." },
    { q: "Os cálculos ficam salvos?",
      a: "Os cálculos previdenciários podem ser salvos com uma chave pública. Os módulos periciais não possuem salvamento automático — exporte o laudo em PDF antes de fechar a página." },
    { q: "O sistema é adequado para uso na Justiça Federal e Trabalhista?",
      a: "Sim. O módulo previdenciário adota o Manual CJF 2025. O módulo trabalhista segue o Manual TRT-3ª Região 2026/1 e PJe-Calc. Os módulos periciais utilizam metodologias reconhecidas (DCF, Price/SAC, análise de balanços) com fundamentos jurídicos adequados à prova pericial." },
    { q: "O módulo Cível pode ser usado em ações de responsabilidade civil?",
      a: "Sim. O módulo Danos Materiais (Cível) calcula danos emergentes e lucros cessantes com base nos arts. 186, 402, 403 e 927 do Código Civil. O perito define a natureza da responsabilidade (contratual ou extracontratual), o índice de correção e o modelo de juros. O sistema gera laudo com fundamentação legal completa." },
    { q: "Posso usar SELIC como índice de correção em ações cíveis?",
      a: "Sim. A SELIC está disponível como índice de correção nos módulos Cível (Danos Materiais), Estadual (Liquidação TJMG) e Família (Revisão de Pensão). A SELIC é aplicável quando determinada pelo juízo — especialmente nas ações federais a partir de dezembro/2021 (EC 113/2021, art. 3º da Lei 14.905/2024). Para ações na Justiça Estadual de MG, o índice padrão é o ICGJ/TJMG, não a SELIC." },
    { q: "Por que o módulo Estadual existe separado do Previdenciário?",
      a: "Porque as regras de correção monetária são distintas. A Justiça Federal aplicou a SELIC a partir de dezembro/2021 (EC 113/2021). O TJMG e demais tribunais estaduais continuam usando seus índices próprios (ICGJ/TJMG = IPCA-E) após essa data. Usar SELIC em processos estaduais é metodologicamente incorreto. O módulo Estadual aplica o ICGJ/TJMG para todo o período, garantindo a correção adequada." },
    { q: "O que é o ICGJ/TJMG e de onde vêm os dados?",
      a: "O ICGJ (Índice de Correção da Justiça Estadual) é o índice oficial do TJMG, calculado a partir das taxas mensais do IPCA-E (IBGE). O TJMG publica tabelas de fatores acumulados em Excel sem API pública. O Veritas Analytics possui a série histórica completa embarcada internamente (jul/1994 a mar/2026), garantindo funcionamento mesmo offline. Para meses recentes, o sistema sincroniza via API do IBGE." },
    { q: "O módulo Família gera laudo para instrução processual?",
      a: "Sim. O módulo gera um relatório técnico-jurídico completo com análise de capacidade contributiva do alimentante, necessidades do alimentado, simulação de três cenários de fixação (conservador, intermediário e expansivo) e tabela de retroativos estimados. O documento é adequado como apoio técnico em petições e audiências de conciliação, devendo ser revisado pelo profissional responsável pelo caso." },
    { q: "Como sincronizar o índice TJMG para meses recentes?",
      a: "Acesse Ferramentas → Gestão de Índices → aba Fontes Online. Localize o índice TJMG (ICGJ) e clique em Sincronizar. O sistema consultará a API do IBGE para obter as taxas IPCA-E mais recentes (que o TJMG adota) e atualizará o banco de dados. A operação requer perfil de administrador." },
    { q: "Como solicitar suporte?",
      a: "Para dúvidas técnicas ou problemas com o sistema, entre em contato com a equipe Veritas pelo e-mail de suporte disponível na página de perfil do usuário." },
  ];
  return (
    <div>
      <SectionTitle icon={HardDriveDownload} label="Perguntas Frequentes" />
      <div className="space-y-3">
        {faqs.map(({ q, a }) => (
          <details key={q} className="group rounded-xl border border-border bg-muted/20 overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer font-medium text-sm list-none">
              {q}
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180 flex-shrink-0 ml-2" />
            </summary>
            <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed border-t border-border bg-background/50 pt-3">
              {a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

// ─── Section map ──────────────────────────────────────────────────────────────
const SECTION_CONTENT: Record<string, () => JSX.Element> = {
  intro:             SecIntro,
  sobre:             SecSobre,
  autoria:           SecAutoria,
  acesso:            SecAcesso,
  creditos:          SecCreditos,
  planos:            SecPlanos,
  previdenciario:    SecPrevidenciario,
  trabalhista:       SecTrabalhista,
  pericial:          SecPericial,
  juros:             SecJuros,
  dcf:               SecDCF,
  "analise-balanco": SecAnaliseBalan,
  civel:             SecCivel,
  familia:           SecFamilia,
  estadual:          SecEstadual,
  controladoria:     SecControladoria,
  ferramentas:       SecFerramentas,
  "indices-info":    SecIndicesInfo,
  equipe:            SecEquipe,
  relatorios:        SecRelatorios,
  faq:               SecFAQ,
};

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Manual() {
  const [active, setActive] = useState("intro");
  const Content = SECTION_CONTENT[active] ?? SecIntro;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Manual de Utilização</h1>
            <p className="text-sm text-muted-foreground">Veritas Analytics — Guia completo do sistema</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isChild = label.startsWith("↳");
            return (
              <button key={id} onClick={() => setActive(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                  isChild ? "pl-6" : ""
                } ${
                  active === id
                    ? "bg-blue-600/10 text-blue-700 border border-blue-200"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {isChild ? label.replace("↳ ", "") : label}
              </button>
            );
          })}
        </aside>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <Content />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
