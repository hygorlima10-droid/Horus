// Petição para revisão na tela: enviar, revisor comenta e devolve, autor reenvia, aprovação, delegar protocolo, alerta de armazenamento.
// Servidor com banco semeado e novo a cada teste (grupo 'peticoes'):  node test/rodar.mjs peticoes-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8818', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const br = await chromium.launch();
async function abrir(quem, larg = 1280) {
  const ctx = await br.newContext({ viewport: { width: larg, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
  await page.goto(B + '/'); await page.waitForTimeout(2500); return page;
}
const c = await api('dono', 'POST', '/api/db/casos', { tipo: 'inicial', cliente: 'Maria Tela', nomeAcao: 'Inventário', status: 'pendente', prioridade: 'normal', origem: 'proprio', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
const cid = c.j.id;
const irPeticoes = async (p) => { await p.evaluate(() => document.querySelector('[data-tab="peticoes"]').click()); await p.waitForTimeout(1200); };
const abrirFolha = async (p) => { await p.evaluate((i) => { const b = document.querySelector('[data-pt-abrir="' + i + '"]'); b.click(); }, cid); await p.waitForTimeout(1500); };
const folha = (p) => p.evaluate(() => (document.getElementById('overlayPetC') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
const colDe = (p) => p.evaluate((i) => { const card = document.querySelector('[data-pcard="' + i + '"]'); if (!card) return ''; const col = card.closest('[data-pcol]'); return col ? col.getAttribute('data-pcol') : ''; }, cid);
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('Peticao de teste')]);

// 1. Ana envia
const ana = await abrir('ana'); await irPeticoes(ana);
check(await ana.evaluate(() => !!document.querySelector('[data-pt-abrir]')), 'o cartão da Inicial tem "Petição para revisão…" no menu');
await abrirFolha(ana);
let t = await folha(ana);
check(/Enviar para revisão/.test(t) && /Escolha quem vai revisar/.test(t), 'a folha pede o arquivo e quem vai revisar');
const opcs = await ana.evaluate(() => [...document.querySelectorAll('#ptRev option')].map((o) => o.textContent));
check(opcs.some((o) => /Bruno/.test(o)) && !opcs.some((o) => /Ana/.test(o)) && !opcs.some((o) => /Caio/.test(o)), 'o revisor é escolhido na lista (sem a própria pessoa e sem estagiários): ' + opcs.join(' | '));
await ana.click('[data-pta="enviar"]'); await ana.waitForTimeout(500);
check(/Escolha o arquivo/.test(await ana.evaluate(() => document.getElementById('toast').innerText)), 'sem arquivo, avisa');
await ana.setInputFiles('#ptArq', { name: 'Inicial Maria.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
await ana.click('[data-pta="enviar"]'); await ana.waitForTimeout(500);
check(/Escolha quem vai revisar/.test(await ana.evaluate(() => document.getElementById('toast').innerText)), 'sem revisor, não envia');
await ana.selectOption('#ptRev', { label: (opcs.find((o) => /Bruno/.test(o))) });
await ana.fill('#ptRecado', 'Conferir o pedido de tutela.');
await ana.click('[data-pta="enviar"]'); await ana.waitForTimeout(2500);
t = await folha(ana);
check(/Com o revisor/i.test(t) && /Inicial Maria\.docx/.test(t) && /Conferir o pedido de tutela/.test(t), 'enviada: mostra a versão e o recado');
await ana.evaluate(() => document.getElementById('overlayPet').classList.remove('show')); await ana.waitForTimeout(500);
check((await colDe(ana)) === 'a_corrigir', 'a Inicial foi para a coluna "A corrigir"');
check(/Petição com Bruno/.test(await ana.evaluate(() => document.querySelector('.pt-chip').innerText)), 'o cartão mostra "Petição com Bruno"');
check(await ana.evaluate(() => [...document.querySelectorAll('.kanban-col-head h4')].some((h) => /Devolvida para ajustes/i.test(h.innerText)) && [...document.querySelectorAll('.kanban-col-head h4')].some((h) => /Aguardando protocolo/i.test(h.innerText))), 'as colunas "Devolvida para ajustes" e "Aguardando protocolo" existem no quadro');

// 2. Bruno vê na Central de atenção, comenta e devolve
const bruno = await abrir('bruno'); await bruno.waitForTimeout(1500);
const cent = await bruno.evaluate(() => (document.getElementById('atencaoLista') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(/Petição de Maria Tela/.test(cent) && /Revisar/.test(cent), 'o revisor vê "Revisar" na Central de atenção: ' + cent.slice(0, 120));
await bruno.evaluate(() => document.querySelector('#atencaoLista [data-pt-abrir]').click()); await bruno.waitForTimeout(1500);
t = await folha(bruno);
check(/Sua revisão/i.test(t) && /Aprovar/.test(t) && /Baixar/.test(t), 'a folha do revisor tem comentar, devolver e aprovar');
await bruno.click('[data-pta="devolver"]'); await bruno.waitForTimeout(800);
check(/Escreva ao menos um comentário/.test(await bruno.evaluate(() => document.getElementById('toast').innerText)), 'não devolve sem comentário');
await bruno.fill('#ptCom', 'Faltou fundamentar o art. 300 do CPC.'); await bruno.click('[data-pta="comentar"]'); await bruno.waitForTimeout(1500);
check(/Faltou fundamentar o art\. 300/.test(await folha(bruno)), 'o comentário aparece');
if (process.env.FOTO) await bruno.screenshot({ path: process.env.FOTO + '/pet-revisor.png' });
await bruno.click('[data-pta="devolver"]'); await bruno.waitForTimeout(2000);
check(/Devolvida para ajustes/i.test(await folha(bruno)), 'devolvida');

// 3. Ana vê "Ajustar", reenvia a v2
await ana.reload(); await ana.waitForTimeout(3000);
const centA = await ana.evaluate(() => (document.getElementById('atencaoLista') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
check(/Petição de Maria Tela/.test(centA) && /Ajustar/.test(centA) && /1 comentário/.test(centA), 'quem fez a Inicial vê "Ajustar · 1 comentário": ' + centA.slice(0, 140));
await ana.evaluate(() => document.querySelector('#atencaoLista [data-pt-abrir]').click()); await ana.waitForTimeout(1500);
t = await folha(ana);
if (process.env.FOTO) await ana.screenshot({ path: process.env.FOTO + '/pet-autor.png' });
check(/Faltou fundamentar/.test(t) && /Enviar a versão ajustada \(v2\)/i.test(t), 'a folha mostra o comentário e o envio da v2');
check(await ana.evaluate(() => document.getElementById('ptRev').value !== ''), 'o revisor anterior já vem escolhido (pode trocar)');
await ana.setInputFiles('#ptArq', { name: 'Inicial Maria v2.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.concat([docx, Buffer.from(' v2')]) });
await ana.click('[data-pta="enviar"]'); await ana.waitForTimeout(2500);
t = await folha(ana);
check(/Com o revisor/i.test(t) && /v2/.test(t) && /v1/.test(t), 'v2 enviada; a v1 continua na lista');

// 4. Bruno aprova; Ana vê "Protocolar" e delega
await bruno.evaluate(() => window.__horusTeste.ptCarregar()); await bruno.waitForTimeout(800);
await bruno.reload(); await bruno.waitForTimeout(2500);
await bruno.evaluate(() => document.querySelector('#atencaoLista [data-pt-abrir]').click()); await bruno.waitForTimeout(1500);
bruno.on('dialog', (d) => d.accept());
await bruno.click('[data-pta="aprovar"]'); await bruno.waitForTimeout(2200);
check(/Aprovada/i.test(await folha(bruno)), 'o revisor aprova');
await ana.reload(); await ana.waitForTimeout(3000);
check(/Protocolar/.test(await ana.evaluate(() => document.getElementById('atencaoLista').innerText)), 'quem fez a Inicial vê "Protocolar" na Central');
await irPeticoes(ana);
check((await colDe(ana)) !== '' && /Aguardando protocolo/i.test(await ana.evaluate((i) => document.querySelector('[data-pcard="' + i + '"]').closest('[data-pcol]').querySelector('h4').innerText, cid)), 'a Inicial está na coluna "Aguardando protocolo"');
await abrirFolha(ana);
await ana.click('[data-pta="delegar"]'); await ana.waitForTimeout(500);
await ana.selectOption('#ptDelResp', { label: 'Caio Estagiario (estagiário)' }).catch(async () => { const o = await ana.evaluate(() => [...document.querySelectorAll('#ptDelResp option')].map((x) => x.textContent)); console.log('   opções:', o.join(' | ')); });
await ana.click('[data-pta="delegarok"]'); await ana.waitForTimeout(1500);
const dg = (await api('dono', 'GET', '/api/db/delegadas')).j.docs.map((d) => d.data);
check(dg.some((d) => /Protocolar: Maria Tela/.test(d.titulo) && /^u:/.test(d.resp)), 'delegar o protocolo cria a tarefa em Delegadas para a pessoa escolhida');

// 5. alerta de armazenamento (só o proprietário)
const dono = await abrir('dono');
const alerta = await dono.evaluate(() => { const T = window.__horusTeste; T.ptS.uso = { nivel: 'atencao', pct: 85, qual: 'armazenamento', bytes: 8.5e9, limiteBytes: 1e10, classeA: 10, limiteA: 1e6, classeB: 20, limiteB: 1e7, arquivos: 3 }; const u = T.ptUsoAlerta(); return u ? T.ptUsoChip(u) : ''; });
check(/85%/.test(alerta) && /Aproximando-se do limite/.test(alerta), 'o proprietário recebe o alerta aos 85% do limite gratuito');
const alertaAna = await ana.evaluate(() => { const T = window.__horusTeste; T.ptS.uso = { nivel: 'atencao', pct: 85, qual: 'armazenamento' }; return T.ptUsoAlerta() ? 'sim' : 'nao'; });
check(alertaAna === 'nao', 'advogado não recebe o alerta de armazenamento');
await dono.evaluate(() => window.__horusTeste.ptUsoAbrir()); await dono.waitForTimeout(1500);
const usoT = await dono.evaluate(() => document.getElementById('overlayPetUsoC').innerText.replace(/\s+/g, ' '));
check(/Espaço usado/i.test(usoT) && /Gravações no mês/i.test(usoT) && /Leituras no mês/i.test(usoT) && /10 GB/.test(usoT), 'a tela de armazenamento mostra espaço, gravações e leituras');
// celular
const cel = await abrir('ana', 390); await irPeticoes(cel); await abrirFolha(cel);
if (process.env.FOTO) await cel.screenshot({ path: process.env.FOTO + '/pet-celular.png' });
check(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular a folha cabe na largura');
for (const p of [ana, bruno, dono, cel]) check(p.erros.length === 0, 'sem erros de script na tela' + (p.erros[0] ? ': ' + p.erros[0] : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
