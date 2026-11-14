-- Anexos desativados por ora: ninguém envia arquivo ao bucket `emendas-documentos` (documentos ficam no Drive).
-- Leitura e exclusão continuam, para os anexos que já existem.
drop policy if exists emendas_documentos_envia on storage.objects;
