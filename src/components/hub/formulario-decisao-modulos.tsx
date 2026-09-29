"use client";

import * as React from "react";

import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import {
  PERFIS_COMPRAS,
  PERFIS_COMPRAS_SEM_SETOR,
  PERFIS_REQUERIMENTOS,
  NIVEIS_NUMERA,
  type CatalogoItem,
  type DocumentoNumera,
} from "@/lib/catalogos-solicitacao";
import type { DecisaoAprovacao } from "@/lib/actions/provisionamento-modulos";
import type { Modulo } from "@/types/database";

/**
 * Campos de decisão (perfil/setor do Compras, perfil/secretaria do
 * Requerimentos, nível/documentos do Numera) — usado tanto na aprovação de
 * solicitações quanto na concessão direta em Configurações. Antes desta
 * extração, as duas telas mantinham a mesma lógica de estado/validação
 * copiada; um ajuste de regra (ex.: novo perfil do Compras exigindo campo
 * extra) tinha que lembrar de mexer nos dois lugares. Componente é dono do
 * próprio estado e só reporta `decisoes`/`valido` pro pai via `onMudar` —
 * o pai decide o que fazer com isso (chamar a action, desabilitar o botão
 * de salvar etc.), sem duplicar os `<select>`/checkboxes.
 */
export function FormularioDecisaoModulos({
  modulosVisiveis,
  setoresCompras,
  secretariasRequerimentos,
  documentosNumera,
  onMudar,
}: {
  /** Módulos para os quais mostrar o bloco de decisão (o pai decide quais —
   * ex.: todos os solicitados, ou só os recém-marcados numa edição). Cada um
   * ganha seu próprio checkbox "incluir agora" — nem toda solicitação com
   * vários módulos deve ser tudo-ou-nada: o admin pode aprovar só o que já
   * decidiu e deixar o resto para depois (mesma tela, reaberta mais tarde). */
  modulosVisiveis: Modulo[];
  setoresCompras: CatalogoItem[];
  secretariasRequerimentos: CatalogoItem[];
  documentosNumera: DocumentoNumera[];
  onMudar: (decisoes: DecisaoAprovacao, valido: boolean) => void;
}) {
  // Por padrão todos os módulos visíveis entram na decisão (comportamento
  // de sempre quando só há 1 módulo, que é o caso mais comum) — o checkbox
  // só precisa ser desmarcado quando o admin quer excluir um dos vários.
  const [incluidos, setIncluidos] = React.useState<Set<Modulo>>(() => new Set(modulosVisiveis));

  const [perfilCompras, setPerfilCompras] = React.useState((PERFIS_COMPRAS[0] as string) ?? "");
  const [setorCompras, setSetorCompras] = React.useState<string>("");

  const [perfilRequerimentos, setPerfilRequerimentos] = React.useState(
    (PERFIS_REQUERIMENTOS[3] as string) ?? ""
  );
  const [secretariaRequerimentos, setSecretariaRequerimentos] = React.useState<string>("");

  const [roleNumera, setRoleNumera] = React.useState("user_restricted");
  const [docsNumera, setDocsNumera] = React.useState<string[]>([]);

  function alternarIncluido(m: Modulo, marcado: boolean) {
    setIncluidos((prev) => {
      const novo = new Set(prev);
      if (marcado) novo.add(m);
      else novo.delete(m);
      return novo;
    });
  }

  const mostraCompras = modulosVisiveis.includes("compras");
  const mostraRequerimentos = modulosVisiveis.includes("requerimentos");
  const mostraNumera = modulosVisiveis.includes("numera");
  const incluiVarios = modulosVisiveis.length > 1;

  const incluiCompras = mostraCompras && incluidos.has("compras");
  const incluiRequerimentos = mostraRequerimentos && incluidos.has("requerimentos");
  const incluiNumera = mostraNumera && incluidos.has("numera");

  const decisoes: DecisaoAprovacao = {};
  if (incluiCompras) {
    decisoes.compras = {
      perfil: perfilCompras,
      setorId: PERFIS_COMPRAS_SEM_SETOR.includes(perfilCompras) ? null : setorCompras || null,
    };
  }
  if (incluiRequerimentos) {
    decisoes.requerimentos = {
      perfil: perfilRequerimentos,
      secretariaId: perfilRequerimentos === "secretaria" ? secretariaRequerimentos || null : null,
    };
  }
  if (incluiNumera) {
    decisoes.numera = { role: roleNumera, documentos: docsNumera };
  }

  // Validação: o banco recusaria (com erro cru de RPC/constraint) perfil
  // que exige setor/secretaria sem um selecionado — checar aqui evita a
  // viagem ao servidor e mostra uma mensagem legível. Só se aplica ao que
  // está de fato incluído nesta decisão — um módulo desmarcado não trava o
  // botão de aprovar por causa de um campo que nem vai ser usado agora.
  const faltaSetorCompras =
    incluiCompras && !PERFIS_COMPRAS_SEM_SETOR.includes(perfilCompras) && !setorCompras;
  const faltaSecretariaRequerimentos =
    incluiRequerimentos && perfilRequerimentos === "secretaria" && !secretariaRequerimentos;
  const semDocumentosNumera = incluiNumera && roleNumera === "user_restricted" && docsNumera.length === 0;
  const nenhumIncluido = !incluiCompras && !incluiRequerimentos && !incluiNumera;
  const valido = !faltaSetorCompras && !faltaSecretariaRequerimentos && !nenhumIncluido;

  // Reporta pro pai a cada mudança relevante — evita o pai duplicar esta
  // mesma lógica de montagem/validação de `decisoes`.
  React.useEffect(() => {
    onMudar(decisoes, valido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    incluiCompras,
    incluiRequerimentos,
    incluiNumera,
    perfilCompras,
    setorCompras,
    perfilRequerimentos,
    secretariaRequerimentos,
    roleNumera,
    docsNumera,
  ]);

  if (!mostraCompras && !mostraRequerimentos && !mostraNumera) return null;

  return (
    <div className="space-y-3">
      {incluiVarios && nenhumIncluido && (
        <p className="text-xs text-red-700">Marque ao menos um módulo para incluir nesta decisão.</p>
      )}
      {mostraCompras && (
        <div className="rounded-md border border-slate-200 p-3">
          {incluiVarios && (
            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={incluiCompras}
                onChange={(e) => alternarIncluido("compras", e.target.checked)}
              />
              Incluir Compras nesta decisão
            </label>
          )}
          {incluiCompras && (
            <>
              <p className="text-xs font-semibold text-slate-600">Compras — perfil e setor</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select
                  className={ESTILO_CAMPO}
                  value={perfilCompras}
                  onChange={(e) => setPerfilCompras(e.target.value)}
                >
                  {PERFIS_COMPRAS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {!PERFIS_COMPRAS_SEM_SETOR.includes(perfilCompras) && (
                  <select className={ESTILO_CAMPO} value={setorCompras} onChange={(e) => setSetorCompras(e.target.value)}>
                    <option value="">Selecione o setor…</option>
                    {setoresCompras.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {faltaSetorCompras && (
                <p className="mt-1.5 text-xs text-red-700">Este perfil exige um setor selecionado.</p>
              )}
            </>
          )}
        </div>
      )}

      {mostraRequerimentos && (
        <div className="rounded-md border border-slate-200 p-3">
          {incluiVarios && (
            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={incluiRequerimentos}
                onChange={(e) => alternarIncluido("requerimentos", e.target.checked)}
              />
              Incluir Requerimentos nesta decisão
            </label>
          )}
          {incluiRequerimentos && (
            <>
              <p className="text-xs font-semibold text-slate-600">Requerimentos — perfil e secretaria</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select
                  className={ESTILO_CAMPO}
                  value={perfilRequerimentos}
                  onChange={(e) => setPerfilRequerimentos(e.target.value)}
                >
                  {PERFIS_REQUERIMENTOS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {perfilRequerimentos === "secretaria" && (
                  <select
                    className={ESTILO_CAMPO}
                    value={secretariaRequerimentos}
                    onChange={(e) => setSecretariaRequerimentos(e.target.value)}
                  >
                    <option value="">Selecione a secretaria…</option>
                    {secretariasRequerimentos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {faltaSecretariaRequerimentos && (
                <p className="mt-1.5 text-xs text-red-700">Este perfil exige uma secretaria selecionada.</p>
              )}
            </>
          )}
        </div>
      )}

      {mostraNumera && (
        <div className="rounded-md border border-slate-200 p-3">
          {incluiVarios && (
            <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={incluiNumera}
                onChange={(e) => alternarIncluido("numera", e.target.checked)}
              />
              Incluir Numera nesta decisão
            </label>
          )}
          {incluiNumera && (
            <>
              <p className="text-xs font-semibold text-slate-600">Numera — nível e documentos</p>
              <select
                className={`${ESTILO_CAMPO} mt-2`}
                value={roleNumera}
                onChange={(e) => setRoleNumera(e.target.value)}
              >
                {NIVEIS_NUMERA.map((n) => (
                  <option key={n.valor} value={n.valor}>
                    {n.rotulo}
                  </option>
                ))}
              </select>
              {roleNumera === "user_restricted" && (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-100 p-2">
                  {documentosNumera.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Lista de documentos indisponível (configure NUMERA_SUPABASE_URL/ANON_KEY).
                    </p>
                  )}
                  {documentosNumera.map((d) => {
                    const marcado = docsNumera.includes(d.id);
                    return (
                      <label key={d.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) =>
                            setDocsNumera((prev) =>
                              e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id)
                            )
                          }
                        />
                        {d.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {semDocumentosNumera && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Nenhum documento selecionado — a pessoa não verá nenhum documento até você conceder
                  algum (dá para ajustar depois em Configurações → Usuários, no próprio Numera).
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
