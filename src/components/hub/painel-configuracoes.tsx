"use client";

import * as React from "react";
import { Check, Copy, Plus, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import { definirAcesso } from "@/lib/actions/configuracoes";
import { FormularioDecisaoModulos } from "@/components/hub/formulario-decisao-modulos";
import type { CatalogoItem, DocumentoNumera } from "@/lib/catalogos-solicitacao";
import { MODULOS, moduloInfo } from "@/lib/modulos-info";
import type { UsuarioComAcessos } from "@/lib/dados/usuarios";
import type { DecisaoAprovacao, ResultadoModulo } from "@/lib/actions/provisionamento-modulos";
import type { Modulo } from "@/types/database";

const TODOS_MODULOS = Object.values(MODULOS);

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type Catalogos = {
  setoresCompras: CatalogoItem[];
  secretariasRequerimentos: CatalogoItem[];
  documentosNumera: DocumentoNumera[];
};

export function PainelConfiguracoes({
  usuarios,
  setoresCompras,
  secretariasRequerimentos,
  documentosNumera,
}: { usuarios: UsuarioComAcessos[] } & Catalogos) {
  // Bug real reportado pelo usuário: o formulário de edição abria sempre
  // ABAIXO da tabela inteira (estado único compartilhado), então clicar em
  // "Editar" numa das primeiras linhas de uma tabela longa mudava o estado
  // corretamente, mas o formulário aparecia fora da área visível — parecia
  // que o clique não fazia nada. Corrigido abrindo o formulário na própria
  // linha (mesmo padrão de linha expansível já usado em Processos/Contratos
  // no App-Compras), sem precisar rolar até o fim da tabela.
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [criandoNovo, setCriandoNovo] = React.useState(false);
  const [busca, setBusca] = React.useState("");

  // Busca por nome, e-mail, módulo liberado ("compras", "numera"...) ou
  // "admin"/"inativo" — sem acento nem caixa, para achar "Júnia" digitando
  // "junia". Tudo no cliente: a lista inteira já está carregada (dezenas de
  // contas), então não há por que ir ao servidor a cada tecla.
  const itens = React.useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return usuarios;
    return usuarios.filter((u) => {
      const alvo = normalizar(
        [
          u.nome,
          u.email,
          u.adminHub ? "admin" : "",
          u.ativo ? "ativo" : "inativo",
          ...u.modulos.map((m) => `${m} ${moduloInfo(m).nome}`),
        ].join(" ")
      );
      return termo.split(/\s+/).every((parte) => alvo.includes(parte));
    });
  }, [usuarios, busca]);

  const catalogos = { setoresCompras, secretariasRequerimentos, documentosNumera };
  const colunas = 3 + TODOS_MODULOS.length; // Usuário, Admin, Ativo, Ações + 1 por módulo

  function alternarEdicao(id: string) {
    setCriandoNovo(false);
    setEditandoId((atual) => (atual === id ? null : id));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-cataguases-marinho">Usuários e acessos</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Marcar um módulo aqui cria (ou reaproveita) a conta e o cadastro de verdade naquele
            app — não é preciso a pessoa já ter login em nenhum outro módulo antes.
          </p>
        </div>
      </div>

      {/* Barra de ações no topo (pedido do usuário): busca à esquerda,
          "Conceder acesso" à direita — antes o botão ficava depois da
          tabela inteira, fora da vista. O formulário abre logo abaixo. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou módulo"
            aria-label="Buscar usuário"
            className={`${ESTILO_CAMPO} w-full pl-8`}
          />
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            setEditandoId(null);
            setCriandoNovo(true);
          }}
          disabled={criandoNovo}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Conceder acesso
        </Button>
      </div>

      {criandoNovo && (
        <div className="mt-3">
          <FormularioAcesso usuario={null} {...catalogos} onFechar={() => setCriandoNovo(false)} />
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400" aria-live="polite">
        {busca.trim()
          ? `${itens.length} de ${usuarios.length} usuários`
          : `${usuarios.length} usuários`}
      </p>

      {/* Rolagem interna: a lista nunca empurra o resto da página — o
          cabeçalho da tabela fica fixo enquanto se rola. */}
      <div className="mt-1 max-h-[65vh] overflow-auto rounded-md border border-slate-100">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-left text-[11px] text-slate-400">
              <th />
              <th
                colSpan={TODOS_MODULOS.length}
                className="border-b border-slate-100 pb-1 text-center font-medium uppercase tracking-wide"
              >
                Módulos liberados
              </th>
              <th colSpan={3} />
            </tr>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Usuário</th>
              {TODOS_MODULOS.map((m) => (
                <th key={m.chave} className="px-2 py-1.5 text-center font-medium" title={m.nome}>
                  <span
                    className="inline-flex h-1.5 w-1.5 rounded-full align-middle"
                    style={{ backgroundColor: m.cor }}
                    aria-hidden
                  />{" "}
                  {m.nomeCurto}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-medium">Admin</th>
              <th className="px-2 py-1.5 text-center font-medium">Ativo</th>
              <th className="py-1.5 pl-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {itens.map((u) => {
              const aberto = editandoId === u.id;
              return (
                <React.Fragment key={u.id}>
                  <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-800">{u.nome}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    {TODOS_MODULOS.map((m) => {
                      const liberado = u.modulos.includes(m.chave);
                      return (
                        <td key={m.chave} className="px-2 py-2 text-center">
                          {liberado ? (
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${m.cor}1A`, color: m.corTexto }}
                              title={`${m.nomeCurto}: liberado`}
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                            </span>
                          ) : (
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center text-slate-300"
                              title={`${m.nomeCurto}: sem acesso`}
                              aria-hidden
                            >
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      {u.adminHub ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[rgba(233,166,59,0.14)] px-2 py-0.5 text-[11px] font-medium text-[#9C6A17]"
                          title="Administrador do Hub"
                        >
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          Admin
                        </span>
                      ) : (
                        <span className="text-slate-300" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={
                          u.ativo
                            ? "inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
                            : "inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                        }
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => alternarEdicao(u.id)}>
                        {aberto ? "Fechar" : "Editar"}
                      </Button>
                    </td>
                  </tr>
                  {aberto && (
                    <tr className="border-b border-slate-100">
                      <td colSpan={colunas} className="bg-slate-50 p-3">
                        <FormularioAcesso usuario={u} {...catalogos} onFechar={() => setEditandoId(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td colSpan={colunas} className="py-6 text-center text-xs text-slate-400">
                  {usuarios.length === 0
                    ? "Nenhum usuário com acesso ainda."
                    : "Nenhum usuário encontrado para essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}

function FormularioAcesso({
  usuario,
  setoresCompras,
  secretariasRequerimentos,
  documentosNumera,
  onFechar,
}: {
  usuario: UsuarioComAcessos | null;
  onFechar: () => void;
} & Catalogos) {
  const [email, setEmail] = React.useState(usuario?.email ?? "");
  const [nome, setNome] = React.useState(usuario?.nome ?? "");
  const [adminHub, setAdminHub] = React.useState(usuario?.adminHub ?? false);
  const [modulos, setModulos] = React.useState<Modulo[]>(usuario?.modulos ?? []);
  const [ativo, setAtivo] = React.useState(usuario?.ativo ?? true);

  const [pendente, setPendente] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultados, setResultados] = React.useState<Partial<Record<Modulo, ResultadoModulo>> | null>(null);

  // Só módulos que a pessoa AINDA não tinha (ou o cadastro inteiro, se está
  // sendo criado agora) precisam de perfil/setor/secretaria — um módulo já
  // liberado continua marcado sem pedir a decisão de novo, para não arriscar
  // rebaixar um perfil sem querer só por reabrir este formulário.
  const jaTinha = React.useCallback((m: Modulo) => !!usuario?.modulos.includes(m), [usuario]);
  const precisaDecisao = (m: Modulo) => modulos.includes(m) && !jaTinha(m);
  const modulosParaDecisao = (["compras", "requerimentos", "numera"] as Modulo[]).filter(precisaDecisao);

  function alternarModulo(m: Modulo, marcado: boolean) {
    setModulos((prev) => (marcado ? [...prev, m] : prev.filter((x) => x !== m)));
  }

  const [decisoes, setDecisoes] = React.useState<DecisaoAprovacao>({});
  const [decisoesValidas, setDecisoesValidas] = React.useState(true);
  const podeSalvar = !!email && !!nome && decisoesValidas;

  async function salvar() {
    setPendente(true);
    setErro(null);
    const resultado = await definirAcesso({
      usuarioId: usuario?.id,
      email,
      nome,
      adminHub,
      modulos,
      ativo,
      decisoes,
    });
    setPendente(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    if (Object.keys(resultado.resultados).length > 0) {
      setResultados(resultado.resultados);
      return;
    }
    onFechar();
  }

  if (resultados) {
    return (
      <div className="space-y-3">
        {(Object.entries(resultados) as [Modulo, ResultadoModulo][]).map(
          ([m, r]) =>
            r && (
              <div
                key={m}
                className={`rounded-md border px-3 py-2 text-sm ${
                  r.sucesso
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p className="font-medium">
                  {moduloInfo(m).nome}: {r.sucesso ? "acesso concedido" : "falhou"}
                </p>
                {r.mensagem && <p className="mt-0.5 text-xs">{r.mensagem}</p>}
                {r.linkPrimeiroAcesso && <LinkCopiavel link={r.linkPrimeiroAcesso} />}
              </div>
            )
        )}
        <Button size="sm" variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-600">
        {usuario ? `Editando acesso de ${usuario.nome}` : "Conceder novo acesso"}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500">E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!usuario}
            className={`${ESTILO_CAMPO} mt-1 w-full disabled:bg-slate-100`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs text-slate-500">Módulos liberados</p>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {TODOS_MODULOS.map((m) => {
            const marcado = modulos.includes(m.chave);
            return (
              <label
                key={m.chave}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  marcado ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100/60 text-slate-500"
                }`}
                style={marcado ? { borderColor: `${m.cor}55` } : undefined}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => alternarModulo(m.chave, e.target.checked)}
                />
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.cor }} aria-hidden />
                <span className={marcado ? "font-medium text-slate-700" : undefined}>{m.nome}</span>
              </label>
            );
          })}
        </div>
        {usuario?.modulos.includes("numera") && !modulos.includes("numera") && (
          <p className="mt-1.5 text-xs text-amber-700">
            Numera tem projeto próprio, sem SSO — desmarcar aqui só tira o cartão do Hub, a conta de
            lá continua ativa. Para desativar de verdade, entre no Numera → Configurações → Usuários.
          </p>
        )}
      </div>

      {modulosParaDecisao.length > 0 && (
        <div className="mt-3">
          <FormularioDecisaoModulos
            modulosVisiveis={modulosParaDecisao}
            setoresCompras={setoresCompras}
            secretariasRequerimentos={secretariasRequerimentos}
            documentosNumera={documentosNumera}
            onMudar={(d, valido) => {
              setDecisoes(d);
              setDecisoesValidas(valido);
            }}
          />
        </div>
      )}

      <div className="mt-3 flex gap-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={adminHub} onChange={(e) => setAdminHub(e.target.checked)} />
          Admin do hub (vê e gerencia tudo)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>

      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={pendente || !podeSalvar} onClick={salvar}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function LinkCopiavel({ link }: { link: string }) {
  const [copiado, setCopiado] = React.useState(false);
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        readOnly
        value={link}
        className="flex-1 truncate rounded border border-green-300 bg-white px-2 py-1 text-[11px] text-slate-600"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="rounded border border-green-300 bg-white p-1 text-green-700 hover:bg-green-100"
        title="Copiar link"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
      >
        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
