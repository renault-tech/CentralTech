import { EditorBeneficiarios } from "@/components/emendas/config/editores";
import { listarBeneficiarios } from "@/lib/emendas/dados";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

export const dynamic = "force-dynamic";

export default async function PaginaBeneficiariosConfig() {
  const emendas = await criarClienteEmendas();
  const [beneficiarios, { data: usos }] = await Promise.all([listarBeneficiarios(), emendas.from("emendas").select("beneficiario_id")]);
  const contagem: Record<string, number> = {};
  for (const u of usos ?? []) if (u.beneficiario_id) contagem[u.beneficiario_id] = (contagem[u.beneficiario_id] ?? 0) + 1;
  return <EditorBeneficiarios beneficiarios={beneficiarios} usos={contagem} />;
}
