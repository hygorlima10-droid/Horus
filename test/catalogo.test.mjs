// Testa o catálogo único de categorias de despesa: classificação por palavras, nomes antigos, seletor da ficha (PF/PJ) e reclassificar em lote.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date();
const mes = n => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.4' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
const get = async (col, id) => (await (await api('GET', col)).json()).docs.find(d => d.id === id)?.data;
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora });
const m0 = mes(0), dd = (m, d) => m + '-' + String(d).padStart(2, '0');
const desp = (id, nome, col, cat, extra) => api('PUT', 'despesas/' + id, Object.assign({ nome, coluna: col, tipo: 'unica', valor: 50, data: dd(m0, 5), mesReferencia: m0, categoria: cat, pago: true, dataPagamento: dd(m0, 5), criadoEm: agora }, extra || {}));
await desp('a1', 'UBER *TRIP', 'pf', 'outros'); await desp('a2', 'Netflix', 'pf', 'outros'); await desp('a3', 'Coisa sem pista nenhuma', 'pf', 'outros');
await desp('a4', 'Das do mês', 'pj', 'outros'); await desp('a5', 'Aluguel', 'pj', 'estrutura'); await desp('a6', 'Transferência', 'pf', 'outros', { transferenciaId: 'tx1' });
await api('PUT', 'extratos/dd_' + m0 + '_y', { tipo: 'diaadia', mes: m0, conta: 'y', coluna: 'pf', cats: { Outros: { v: 90, n: 2 } }, linhas: [{ id: 'k1', d: dd(m0, 2), t: 'IFOOD *RESTAURANTE', v: 60, c: 'Outros', h: 'a' }, { id: 'k2', d: dd(m0, 3), t: 'Xyzzy', v: 30, c: 'Outros', h: 'b' }], atualizadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 1100, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
const H = () => page.evaluate(() => window.__horusTeste);
// 1) o catálogo
const cat = await page.evaluate(() => { const c = window.__horusTeste.CAT_CATALOGO; return { n: c.length, ids: new Set(c.map(x => x.id)).size, labels: new Set(c.map(x => x.label)).size, semIcone: c.filter(x => !x.ic).length }; });
check(cat.n === 78 && cat.ids === 78 && cat.labels === 78, 'o catálogo tem 78 categorias, sem repetir id nem nome (tem ' + cat.n + ')');
check(cat.semIcone === 0, 'toda categoria tem ícone');
// 2) classificação por palavras
const cl = await page.evaluate(() => { const h = window.__horusTeste; return ['UBER *TRIP', '99 POP', 'IFOOD *RESTAURANTE', 'NETFLIX.COM', 'Droga Raia', 'SUPERMERCADO BH', 'Coisa sem pista nenhuma', ''].map(t => h.catClassificar(t)); });
check(cl[0] === 'Aplicativos de transporte (Uber, 99)' && cl[1] === 'Aplicativos de transporte (Uber, 99)', 'Uber e 99 caem em "Aplicativos de transporte"');
check(cl[2] === 'Delivery (iFood e similares)', 'iFood cai em "Delivery"');
check(cl[3] === 'Streaming de vídeo e música', 'Netflix cai em "Streaming"');
check(cl[5] === 'Supermercado', 'supermercado cai em "Supermercado"');
check(cl[6] === null && cl[7] === null, 'texto sem pista não é classificado (fica como está)');
// 3) nomes antigos
const nn = await page.evaluate(() => { const h = window.__horusTeste; return ['Mercado', 'Alimentação', 'Dia a dia · Mercado', 'Sistemas', 'Tarifas e juros', 'Outros', 'Coisa Nova'].map(t => h.catNomeNovo(t)); });
check(nn[0] === 'Supermercado' && nn[1] === 'Restaurantes e bares' && nn[2] === 'Supermercado', 'nomes antigos do extrato viram os novos na leitura (Mercado, Alimentação, "Dia a dia · …")');
check(nn[3] === 'Sistemas e software jurídico' && nn[5] === 'Outros' && nn[6] === 'Coisa Nova', 'categorias antigas do escritório e nomes desconhecidos são preservados');
// 4) seletor da ficha: PF não oferece as do escritório, PJ não oferece as da casa
const abre = async (col) => { await page.evaluate(c => window.__horusTeste.fichas.abrirNovaDespesa(c), col); await page.waitForTimeout(400); await page.click('#catPickBtn'); await page.waitForTimeout(300); };
const itens = () => page.evaluate(() => Array.from(document.querySelectorAll('#catPickPop [data-catpick]')).map(b => b.getAttribute('data-catpick')));
await abre('pf'); let its = await itens();
check(its.includes('apps_transporte') && its.includes('streaming') && !its.includes('sistemas') && !its.includes('impostos'), 'PF: oferece Uber/Streaming e não oferece Sistemas/Impostos do escritório');
await page.fill('#catPickQ', 'uber'); await page.waitForTimeout(250); its = await itens();
check(its.length >= 1 && its.includes('apps_transporte') && its.length <= 3, 'a busca "uber" acha Aplicativos de transporte');
await page.click('#catPickPop [data-catpick="apps_transporte"]'); await page.waitForTimeout(250);
check(/Aplicativos de transporte/.test(await page.evaluate(() => document.getElementById('catPickBtn').innerText)) && await page.evaluate(() => !document.getElementById('catPickPop') || getComputedStyle(document.getElementById('catPickPop')).display === 'none'), 'escolher fecha a lista e mostra a categoria no botão');
await page.evaluate(() => document.getElementById('overlayDespesa').classList.remove('show'));
await abre('pj'); its = await itens();
check(its.includes('sistemas') && its.includes('impostos') && its.includes('apps_transporte') && !its.includes('streaming'), 'PJ: oferece Sistemas/Impostos/Uber e não oferece Streaming (só de casa)');
await page.evaluate(() => document.getElementById('overlayDespesa').classList.remove('show'));
// 5) reclassificar em lote: botão no gerenciador de categorias e na Análise
await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(800);
await page.evaluate(() => document.querySelector('[data-an-periodo="hist"]').click()); await page.waitForTimeout(700);
check(await page.evaluate(() => !!document.querySelector('#anWrap [data-cat-reclass]')), 'a Análise mostra o botão "Reclassificar Outros em lote" quando há sugestões');
const antes = await get('despesas', 'a1');
await page.click('#anWrap [data-cat-reclass]'); await page.waitForTimeout(500);
const modal = await page.evaluate(() => ({ aberto: document.getElementById('overlayCatRc').classList.contains('show'), linhas: document.querySelectorAll('#overlayCatRc .cat-rc-it').length, txt: document.getElementById('overlayCatRc').innerText }));
check(modal.aberto && modal.linhas === 4, 'o modal lista 4 sugestões (Uber, Netflix, DAS, iFood) e não lista o que não tem pista, a transferência nem a despesa que já tem categoria (linhas: ' + modal.linhas + ')');
check(/Nada muda até você tocar em Aplicar/.test(modal.txt) && /2 lançamentos em “Outros” não têm sugestão|2 continuam|não têm sugestão/.test(modal.txt), 'avisa que nada muda sem aplicar e quantos ficam sem sugestão');
check((await get('despesas', 'a1')).categoria === 'outros', 'antes de aplicar nada foi alterado');
// busca no campo de categoria de cada sugestão (seletor com busca no lugar da lista do iPhone)
check(await page.evaluate(() => document.querySelectorAll('#overlayCatRc .cat-rc-it .cat-ps .cat-pk-btn').length === 4 && document.querySelectorAll('#overlayCatRc .cat-rc-it select.cat-oculto').length === 4), 'cada sugestão mostra o botão de categoria (com o <select> escondido guardando o valor)');
await page.evaluate(() => Array.from(document.querySelectorAll('#overlayCatRc .cat-rc-it')).find(l => /Netflix/i.test(l.innerText)).querySelector('.cat-pk-btn').click()); await page.waitForTimeout(250);
check(await page.evaluate(() => document.getElementById('catPsBg').classList.contains('show') && document.activeElement && document.activeElement.id === 'catPsQ'), 'tocar no botão abre o seletor com a busca já ativa');
check(await page.evaluate(() => document.querySelectorAll('#catPsL .cat-pk-i').length === 78 && !document.getElementById('catPsRod').innerText.trim()), 'sem filtro de lado: lista as 78 categorias e não mostra o atalho do outro lado');
await page.fill('#catPsQ', 'farm'); await page.waitForTimeout(150);
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#catPsL .cat-pk-i')).map(x => x.innerText.trim()); return l.length >= 1 && l.includes('Farmácia e medicamentos') && l.length < 6; }), 'digitar "farm" acha "Farmácia e medicamentos"');
await page.fill('#catPsQ', 'uber'); await page.waitForTimeout(150);
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#catPsL .cat-pk-i')).map(x => x.innerText.trim()); return l.includes('Aplicativos de transporte (Uber, 99)') && l.includes('Delivery (iFood e similares)'); }), 'a busca também acha pelas palavras do extrato ("uber" → Aplicativos de transporte e Delivery/Uber Eats)');
await page.fill('#catPsQ', 'xyzxyz'); await page.waitForTimeout(150);
check(await page.evaluate(() => /Nenhuma categoria com/.test(document.getElementById('catPsL').innerText)), 'busca sem resultado avisa "Nenhuma categoria com…"');
await page.fill('#catPsQ', 'farm'); await page.waitForTimeout(150);
await page.evaluate(() => Array.from(document.querySelectorAll('#catPsL .cat-pk-i')).find(x => /Farmácia/.test(x.innerText)).click()); await page.waitForTimeout(250);
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#overlayCatRc .cat-rc-it')).find(x => /Netflix/i.test(x.innerText)); return !document.getElementById('catPsBg').classList.contains('show') && l.querySelector('select').value === 'Farmácia e medicamentos' && /Farmácia e medicamentos/.test(l.querySelector('.cat-pk-btn').innerText) && l.querySelector('input[type=checkbox]').checked; }), 'escolher fecha o seletor, troca o valor e o botão da linha, sem desmarcar a sugestão');
await page.evaluate(() => Array.from(document.querySelectorAll('#overlayCatRc .cat-rc-it')).find(l => /Netflix/i.test(l.innerText)).querySelector('.cat-pk-btn').click()); await page.waitForTimeout(200);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
check(await page.evaluate(() => !document.getElementById('catPsBg').classList.contains('show') && document.getElementById('overlayCatRc').classList.contains('show')), 'Esc fecha só o seletor (o modal de reclassificar continua aberto)');
// desmarca a Netflix
await page.evaluate(() => { const i = Array.from(document.querySelectorAll('#overlayCatRc .cat-rc-it')).find(l => /Netflix/i.test(l.innerText)).querySelector('input[type=checkbox]'); i.click(); }); await page.waitForTimeout(200);
check(/Aplicar a 3 lançamentos/.test(await page.evaluate(() => document.querySelector('#overlayCatRc [data-catrc="aplicar"]').innerText)), 'desmarcar uma sugestão atualiza o botão (Aplicar a 3)');
await page.click('#overlayCatRc [data-catrc="aplicar"]'); await page.waitForTimeout(1800);
const a1 = await get('despesas', 'a1'), a2 = await get('despesas', 'a2'), a3 = await get('despesas', 'a3'), a6 = await get('despesas', 'a6');
check(a1.categoria === 'apps_transporte' && a1.valor === 50 && a1.nome === 'UBER *TRIP', 'Uber foi para "Aplicativos de transporte", com nome e valor intactos');
check((await get('despesas', 'a4')).categoria === 'impostos', 'o "Das do mês" da PJ foi para Impostos e taxas');
check(a2.categoria === 'outros' && a3.categoria === 'outros' && a6.categoria === 'outros', 'a Netflix desmarcada, a sem pista e a transferência continuam em Outros');
const doc = await get('extratos', 'dd_' + m0 + '_y');
check(doc.linhas.find(l => l.id === 'k1').c === 'Delivery (iFood e similares)' && doc.linhas.find(l => l.id === 'k2').c === 'Outros', 'a linha do iFood mudou no extrato; a "Xyzzy" ficou em Outros');
check(doc.cats['Delivery (iFood e similares)'].v === 60 && doc.cats.Outros.v === 30 && doc.cats.Outros.n === 1, 'os totais por categoria do extrato foram recalculados (Delivery 60, Outros 30)');
check(await page.evaluate(() => !document.getElementById('overlayCatRc').classList.contains('show')), 'o modal fecha depois de aplicar');
// 6) gerenciador de categorias
await page.evaluate(() => { const b = document.querySelector('[data-tab="configuracoes"]'); if (b) b.click(); }); await page.waitForTimeout(600);
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
