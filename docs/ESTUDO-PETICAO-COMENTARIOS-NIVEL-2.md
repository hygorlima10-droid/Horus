# Estudo: comentários no texto da petição (nível 2)

*23/11 · só estudo e esboço, nada foi alterado no app.* Esboço: `docs/esboco-peticao-comentarios-nivel-2.png`.

## 1. O que é o nível 2

Hoje (nível 1) o revisor baixa o arquivo, lê no Word/PDF e escreve comentários **soltos** no Horus. No nível 2 o revisor **lê o texto da petição dentro do Horus, seleciona um trecho e comenta nele**. O autor vê cada comentário **no lugar certo** do texto, corrige, envia a v2, e o Horus **reencontra cada trecho** na versão nova.

## 2. Como funcionaria

1. Revisor abre "Revisar": o Horus mostra o texto da versão atual (leitura simplificada) e o botão "Baixar o original".
2. Seleciona uma frase (no celular, segura e arrasta) → botão **Comentar** → escreve → salva. O trecho fica marcado (amarelo, numerado).
3. **Devolver:** o autor abre a petição e vê os comentários no texto; tocar no comentário rola até o trecho.
4. Autor envia a v2. Para cada comentário aberto, o Horus procura o trecho na v2 e mostra: **"no mesmo lugar"**, **"trecho mudou"** (parágrafo achado, mas o texto citado mudou — ex.: o valor da causa) ou **"trecho não encontrado"** (fica na lista, sem marca).
5. O revisor confere e marca **resolvido** (ou "ainda não"). Ao aprovar com comentário aberto, o Horus avisa.

## 3. Como o Horus lê o arquivo (prova de conceito feita)

| Arquivo | Como lê | Resultado do teste |
|---|---|---|
| **.docx** | No navegador: abre o zip (o Horus já tem leitor de zip dos extratos), lê `word/document.xml` e monta parágrafos, negrito/itálico/sublinhado, títulos, alinhamento e tabelas. | Petição de teste (título, lista numerada, tabela, negrito): **lida em 25 ms**. Nada é enviado a terceiros. |
| **PDF com texto** | Biblioteca pdf.js (já usada nos extratos): desenha a página e uma camada de texto selecionável. | **Não consegui testar aqui** (o ambiente bloqueia o CDN do pdf.js); precisa de teste com PDF real. |
| **PDF escaneado** (imagem) | Não há texto para selecionar. | Fallback: comentário **da página** ("p. 3"). |

**O que a leitura do Word NÃO reproduz igual:** numeração automática de estilo ("1.", "a)") pode divergir; imagens (aparecem como "[imagem]"), notas de rodapé, cabeçalho/rodapé, quebras de página. Por isso a tela sempre tem **"Baixar o original"** e o aviso "leitura simplificada, o Word é a versão oficial". Na prova de conceito, a lista numerada criada por *estilo* saiu sem número: preciso ler também `numbering.xml`/`styles.xml` (planejado), e validar com petições reais do escritório.

## 4. Como o comentário "gruda" no texto

Cada comentário guarda: versão, **trecho citado**, parágrafo (número), posição inicial/final no parágrafo, 20 caracteres antes e depois, e uma cópia do parágrafo. Na v2 a busca segue esta ordem: (1) mesma posição → "no mesmo lugar"; (2) mesmo trecho em outro ponto do mesmo parágrafo; (3) mesmo trecho em outro parágrafo (conferindo o contexto); (4) parágrafo parecido (semelhança de texto ≥ 45%) → "trecho mudou"; (5) nada → "não encontrado". **Teste:** de 5 comentários, 3 ficaram no mesmo lugar, 1 foi sinalizado como "trecho mudou" (valor da causa) e o inventado foi "não encontrado". Nada é adivinhado em silêncio: sempre que o trecho muda, a pessoa confere.

## 5. O que muda no sistema

- **Servidor (pouco):** o comentário já existe (`_peticoes`); ganha `ancora` (os campos acima) e `estado` (`aberto`/`resolvido`, quem e quando). Novas ações: *resolver/reabrir* e *responder* (se o autor também puder responder). Regra de aprovar com comentário aberto no servidor. O texto lido **não é gravado**; só o trecho citado vai junto do comentário.
- **Custo no R2:** abrir o texto baixa o arquivo uma vez (1 leitura; o resultado fica em memória na sessão). Muito abaixo do limite gratuito.
- **Cliente:** módulo leitor (docx, e pdf.js para PDF), seleção de texto com botão "Comentar" (precisa funcionar no iPhone), marcas no texto, lista de comentários com estado, reancoragem ao abrir a v2.
- **Compatibilidade:** comentários do nível 1 continuam valendo (aparecem na lista sem marca no texto).

## 6. Riscos

- Fidelidade do Word (acima): mitigada com o "Baixar o original" e aviso claro.
- Seleção de texto no iPhone (toque/arrastar): precisa de teste em aparelho; plano B é botão "Comentar este parágrafo" ao tocar no parágrafo.
- Petições grandes (100+ páginas): leitura rápida no docx; PDF é por página (carrega sob demanda).
- Documento protegido por senha ou `.doc` antigo: não abre → só baixa o original (o envio já aceita só .docx/.pdf).

## 7. Etapas sugeridas (se aprovado)

1. **A:** leitor de .docx + comentar no trecho + autor vê no texto (nível 2 básico).
2. **B:** estado resolvido/aberto, reancoragem na v2 e aviso ao aprovar com comentário aberto.
3. **C:** PDF (texto selecionável e comentário por página).
Cada etapa com testes e teste seu no aparelho antes da próxima.

## 8. Pontos a decidir

1. **Quem comenta:** só o revisor (como hoje) ou o autor também responde ("resolvi", "não concordo")?
2. **Quem marca resolvido:** o autor ao corrigir, o revisor ao conferir, ou os dois (autor propõe, revisor confirma)? *Sugestão: autor propõe, revisor confirma.*
3. **Aprovar com comentário aberto:** só avisar ou impedir? *Sugestão: avisar e deixar passar.*
4. **PDF escaneado:** comentário só da página serve?
5. **Nível 3** (ler os comentários feitos dentro do Word) entra junto ou depois? *Sugestão: depois, com a etapa C pronta.*
6. Para validar com segurança, peço **uma petição real do escritório (.docx e o PDF dela), sem dados de cliente**, para testar a leitura antes de implementar.

## 9. Andamento (23/11)

Decisões do proprietário: só o revisor comenta; autor propõe e revisor confirma o "resolvido"; aprovar com comentário aberto só avisa; PDF escaneado com comentário da página; nível 3 depois (talvez nunca); sem sugestão de redação por ora. **Etapas A e B implementadas** (leitor de Word com os estilos do escritório, comentário no trecho, reencontro na v2, resolvido/reaberto). **Etapa C (PDF) implementada em seguida (pdf.js, comentário no trecho e comentário da página para PDF escaneado).** Validado com o modelo real "Inicial – Modelo – Falone".
