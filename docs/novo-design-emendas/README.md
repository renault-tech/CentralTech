# Novo design do módulo Emendas: avaliação

Proposta a partir do documento "CentralTech: Especificação Completa do Sistema de Design (UI/UX)".
Nada do app foi alterado: esta pasta só tem o mockup (`mockup.html`, abre direto no navegador) e esta análise.
O mockup usa os dados reais do exercício 2026, lidos do banco só para leitura em 21/11/2026 (215 emendas,
R$ 5.157.490,05 indicados, R$ 2.787.969,58 empenhados, R$ 1.863.374,43 pagos, 16 vereadores, lançamentos por mês e a emenda nº 043 completa).

## Telas do mockup
Painel, Emendas (lista), Detalhe da emenda (nº 043), Vereadores e "O que muda". As demais telas do menu aparecem
como "mantida como hoje, com o novo visual". Botões no topo comparam a cor de destaque (violeta do módulo × verde do documento)
e o modo escuro.

## Perdas se o documento for seguido ao pé da letra (e como o mockup evita)
| Item do documento | Hoje na plataforma | Risco | Proposta |
|---|---|---|---|
| FilterBar com selects | Painel clicável na lista (pizza + ranking em 9 dimensões, chips, filtro lembrado por aba) | Perda | Manter o painel clicável; barra só com busca e 2–3 seletores rápidos |
| Stepper de 5 nós | Fluxo por tipo (8 a 12 fases), editável, com "presumida" e "não se aplica" | Perda | Stepper com as fases reais do tipo, rolagem lateral |
| 5 status fixos | 11 etapas editáveis | Atenção | Cor pelo grupo da etapa; nome do catálogo |
| Cartão "Liquidado" | Liquidação não é fase (decisão de 13/11) | Regressão | "A pagar" e "Sem empenhar"; ações de conciliação/encerramento seguem sob os cartões |
| "+14,5% vs ano anterior" | Só existe 2026 | Sem dado | Removido até haver 2027 |
| Foto do parlamentar | Sem campo de foto | Sem dado | Iniciais |
| Selo de regularidade do beneficiário | Categoria, CNPJ validado, documentos faltando | Sem dado | Derivar dos documentos faltando |
| Sidebar própria do módulo | Cabeçalho único da Central em 6 módulos (sino, feedback, ajuda, tema, zoom, voltar) | Atenção | Topbar mantém todos os controles |
| Só tema claro, px | Modo escuro, Apple/Clássico, zoom em rem | Atenção | Tokens com versão escura; implementar em rem |
| Recharts | Gráficos próprios em SVG | Escolha | Seguir com SVG próprio |
| Wizard de 4 passos | Formulário único com validações | Ganho | Viável, com as mesmas validações por passo |

## Decisões pendentes do dono
1. Cor de destaque: violeta (recomendado; o verde-azulado já é do Compras) ou verde do documento.
2. Só Emendas ou todos os módulos (a regra da plataforma é visual único).
3. Filtros: painel clicável (recomendado) ou barra de seletores.

## Se aprovado: ordem de implementação
1. Tokens (`globals.css`/`tailwind.config.ts`) com versão escura e em rem; tom por grupo de etapa no `SeloEtapa`.
2. Layout do módulo com sidebar (reaproveitando `NavModulo` como fonte dos itens) e topbar com os controles da Central.
3. `KpiCard`, tabela paginada e stepper nas telas Painel, Lista e Detalhe; depois Vereadores, Secretarias e demais.
Nenhuma rota, RLS, action ou regra do banco muda.
