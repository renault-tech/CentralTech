import { redirect } from "next/navigation";

import { MatrizPermissoes, type UsuarioMatriz } from "@/components/emendas/config/matriz-permissoes";
import { Vazio } from "@/components/emendas/ui";
import { listarSecretarias, obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

export const dynamic = "force-dynamic";

/**
 * Quem enxerga quem: `emendas.usuarios`/`permissoes` vêm pela RLS (gestor
 * vê todos). Nome/e-mail moram em
 * `hub.usuarios`, que só o admin do Hub lê pela RLS — então só para os ids
 * que a RLS do módulo já liberou, eles são lidos com a service_role.
 * Gestor/admin também veem quem foi liberado na Central mas ainda não tem
 * perfil no módulo ("pendente").
 */
export default async function PaginaUsuariosEmendas() {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") redirect("/emendas");
  const gestor = ehGestor(ctx.perfil);

  const emendas = await criarClienteEmendas();
  const [secretarias, { data: usuarios }, { data: permissoes }] = await Promise.all([
    listarSecretarias(),
    emendas.from("usuarios").select("*").eq("ativo", true),
    emendas.from("permissoes").select("*"),
  ]);

  const admin = criarClienteAdmin();
  let pendentes: string[] = [];
  let admins: string[] = [];
  if (gestor) {
    const [{ data: acessos }, { data: hubAdmins }] = await Promise.all([
      admin.from("acessos_modulo").select("usuario_id").eq("modulo", "emendas"),
      admin.from("usuarios").select("id").eq("admin_hub", true).eq("ativo", true),
    ]);
    const comPerfil = new Set((usuarios ?? []).map((u) => u.id));
    pendentes = (acessos ?? []).map((a) => a.usuario_id).filter((id) => !comPerfil.has(id));
    admins = (hubAdmins ?? []).map((a) => a.id);
  }
  const ids = Array.from(new Set([...(usuarios ?? []).map((u) => u.id), ...pendentes, ...admins]));
  const { data: pessoas } = ids.length ? await admin.from("usuarios").select("id,nome,email,ativo,admin_hub").in("id", ids) : { data: [] };
  const porId = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const linhas: UsuarioMatriz[] = ids
    .map((id) => {
      const p = porId.get(id);
      if (!p || !p.ativo) return null;
      const u = (usuarios ?? []).find((x) => x.id === id);
      return {
        id,
        nome: p.nome,
        email: p.email,
        adminHub: p.admin_hub,
        perfil: u?.perfil ?? null,
        secretariaId: u?.secretaria_id ?? null,
        permissoes: Object.fromEntries((permissoes ?? []).filter((x) => x.usuario_id === id).map((x) => [x.secretaria_id, { ver: x.pode_ver, editar: x.pode_editar }])),
      };
    })
    .filter((x): x is UsuarioMatriz => !!x)
    .filter((x) => gestor || x.id !== ctx.usuario.id)
    .sort((a, b) => Number(b.adminHub) - Number(a.adminHub) || Number(!a.perfil) - Number(!b.perfil) || a.nome.localeCompare(b.nome));

  if (linhas.length === 0) {
    return <Vazio>{gestor ? "Ninguém tem acesso ao módulo ainda. Libere pela Central: Configurações → Usuários e acessos." : "Sua secretaria ainda não tem outras pessoas no módulo."}</Vazio>;
  }

  return <MatrizPermissoes usuarios={linhas} secretarias={secretarias.filter((s) => s.ativo)} />;
}
