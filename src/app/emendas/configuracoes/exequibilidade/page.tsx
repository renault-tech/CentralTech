import { EditorPareceres } from "@/components/emendas/config/exequibilidade";
import { Vazio } from "@/components/emendas/ui";
import { listarEmendas, listarPareceres, listarSecretarias, resolverExercicio } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaExequibilidade({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio, exercicios } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Cadastre um exercício primeiro.</Vazio>;
  const [secretarias, pareceres, emendas] = await Promise.all([listarSecretarias(), listarPareceres(exercicio.ano), listarEmendas(exercicio.ano)]);
  const emendasPorSecretaria: Record<string, number> = {};
  for (const e of emendas) emendasPorSecretaria[e.secretaria_id] = (emendasPorSecretaria[e.secretaria_id] ?? 0) + 1;
  return (
    <EditorPareceres
      ano={exercicio.ano}
      anos={exercicios.map((e) => e.ano)}
      prazo={exercicio.prazo_exequibilidade}
      secretarias={secretarias.filter((s) => s.ativo && emendasPorSecretaria[s.id])}
      pareceres={pareceres}
      emendasPorSecretaria={emendasPorSecretaria}
    />
  );
}
