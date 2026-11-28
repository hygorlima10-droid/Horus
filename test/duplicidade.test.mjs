// Aviso de tarefa ou prazo parecido no mesmo processo: regras de comparação (nome parecido, mesma data, tipo) e a janela de confirmação.
// Servidor do grupo 'principal':  node test/rodar.mjs duplicidade
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
const sim = (a, b) => page.evaluate(([x, y]) => window.__horusTeste.dupTitSim(x, y), [a, b]);
check(await sim('Contestação', 'Contestação') === 'igual' && await sim('Réplica à contestação', 'Réplica') === 'contem', 'mesmo nome é "igual"; um nome dentro do outro é "contém" (conta como parecido)');
check(await sim('Preparar réplica', 'Réplica à contestação') === 'parecido' && await sim('Juntar procuração atualizada', 'Juntar procuração') === 'contem', 'uma palavra só parecida, ou uma frase dentro da outra, é reconhecida (acento, maiúscula e plural não contam)');
check(await sim('Cumprir determinação (recolher custas)', 'Recolher custas e juntar comprovante') === 'parecido', 'nomes com as mesmas palavras principais ("recolher custas") são "parecidos"');
check(await sim('Juntar procuração', 'Juntar documentos') === '' && await sim('Audiência de conciliação', 'Réplica') === '', 'só uma palavra em comum de duas, ou nomes diferentes: não é parecido');
const L = (o, itens, opt) => page.evaluate(([x, y, z]) => window.__horusTeste.dupAchar(x, y, z).map((r) => r.motivo + ':' + r.item.key), [o, itens, opt]);
const P = '5000001-11.2026.8.09.0107', hoje = new Date().toISOString().slice(0, 10), d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const it = (key, titulo, data, extra) => Object.assign({ key, tipo: 'prazo', titulo, data, processo: P, concluido: false, cancelado: false }, extra || {});
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Réplica', data: d(5), processo: P }, [it('a', 'Réplica', d(5))])) === '["igual:a"]', 'mesmo processo, mesmo nome e mesma data: "igual"');
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Réplica', data: d(5), processo: P }, [it('a', 'Réplica à contestação', d(5))])) === '["parecido-data:a"]', 'um nome dentro do outro e mesma data: "nome parecido e mesma data"');
check(JSON.stringify(await L({ tipo: 'tarefa', titulo: 'Preparar réplica', data: d(9), processo: P }, [it('a', 'Réplica à contestação', d(5))])) === '["nome:a"]', 'nome parecido em OUTRA data (a tarefa existente está em aberto): avisa');
check(JSON.stringify(await L({ tipo: 'tarefa', titulo: 'Preparar réplica', data: d(9), processo: P }, [it('a', 'Réplica à contestação', d(5), { concluido: true })])) === '[]', 'nome parecido mas a existente já foi concluída e a data é outra: não avisa');
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Juntar documentos', data: d(5), processo: P }, [it('a', 'Réplica', d(5))])) === '["data:a"]', 'mesma data e mesmo tipo, nome diferente: avisa');
check(JSON.stringify(await L({ tipo: 'tarefa', titulo: 'Juntar documentos', data: d(5), processo: P }, [it('a', 'Réplica', d(5))])) === '[]', 'mesma data mas tipo diferente (tarefa × prazo) e nome diferente: não avisa');
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Réplica', data: d(5), processo: P }, [it('a', 'Réplica', d(5), { processo: '5000002-22.2026.8.09.0107' }), it('b', 'Réplica', d(5), { cancelado: true })])) === '[]', 'outro processo ou item cancelado: não avisa');
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Réplica', data: d(5), processo: '' }, [it('a', 'Réplica', d(5))])) === '[]', 'sem processo informado: não compara');
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Preparar réplica', data: d(9), processo: P, ignorarKey: 'x' }, [it('a', 'Réplica à contestação', d(5))], { estrito: true })) === '[]' && JSON.stringify(await L({ tipo: 'prazo', titulo: 'Réplica', data: d(5), processo: P }, [it('a', 'Réplica', d(5))], { estrito: true })) === '["igual:a"]', 'ao EDITAR só vale o "igual" (nome parecido em outra data não incomoda)');
check(JSON.stringify(await L({ tipo: 'prazo', titulo: 'Réplica', data: d(5), processo: '5000001-11.2026.8.09.0107' }, [it('a', 'Réplica', d(5), { processo: '50000011120268090107' })])) === '["igual:a"]', 'o número do processo com ou sem pontuação é o mesmo processo');
// janela de confirmação
const lista = [{ item: it('a', 'Réplica à contestação', d(5)), motivo: 'igual', peso: 0 }];
await page.evaluate(([l]) => { window.__dupR = null; window.__horusTeste.dupPerguntar(l, { tipo: 'prazo', titulo: 'Réplica', data: l[0].item.data }).then((v) => { window.__dupR = v; }); }, [lista]); await page.waitForTimeout(300);
const txt = await page.evaluate(() => document.getElementById('overlayDupC').innerText.replace(/\s+/g, ' '));
check(/Você está cadastrando um prazo “Réplica”/.test(txt) && /Já existe/.test(txt) && /Réplica à contestação/.test(txt) && /igual: mesmo nome e mesma data/.test(txt), 'a janela mostra o que será cadastrado e o que já existe, com o motivo');
await page.click('[data-dup="sim"]'); await page.waitForTimeout(200);
check(await page.evaluate(() => window.__dupR) === true && !(await page.evaluate(() => document.getElementById('overlayDup').classList.contains('show'))), '"Cadastrar mesmo assim" devolve verdadeiro e fecha');
for (const [acao, rot] of [['nao', '"Não cadastrar"'], ['x', 'fechar pelo X']]) {
  await page.evaluate(([l]) => { window.__dupR = null; window.__horusTeste.dupPerguntar(l, { tipo: 'prazo', titulo: 'Réplica', data: l[0].item.data }).then((v) => { window.__dupR = v; }); }, [lista]); await page.waitForTimeout(300);
  if (acao === 'nao') await page.click('[data-dup="nao"]'); else await page.click('#overlayDup [data-sg="fechar"]');
  await page.waitForTimeout(300); check(await page.evaluate(() => window.__dupR) === false, rot + ' devolve falso (nada é cadastrado)');
}
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
