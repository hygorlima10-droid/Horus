// Fichas de cadastro (Onda 3b): blocos com título, "Mais detalhes" fechado no cadastro novo e aberto quando já há conteúdo, rodapé Cancelar | Salvar sempre à vista.
// Use: node test/rodar.mjs fichas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.77' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const agora = new Date().toISOString();
const caso = await f('POST', '/api/db/casos', { cliente: 'Cliente Ficha', nomeAcao: 'Ação X', tipo: 'inicial', status: 'pendente', prioridade: 'normal', modalidadeHonorario: 'fixo', valorHonorarios: 1000, formaPagamento: 'avista', observacoes: 'Observação preenchida', criadoEm: agora });
const caso2 = await f('POST', '/api/db/casos', { cliente: 'Cliente Simples', nomeAcao: 'Ação Y', tipo: 'inicial', status: 'pendente', prioridade: 'normal', modalidadeHonorario: 'fixo', valorHonorarios: 500, formaPagamento: 'avista', criadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const abre = (fn, ...a) => page.evaluate(([fn, a]) => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const H = window.__horusTeste; if (fn === 'edit') H.abrirEdicao(a[0]); else H.fichas[fn].apply(null, a); }, [fn, a]);
const info = (ov) => page.evaluate((ov) => { const o = document.getElementById(ov), foot = o.querySelector('.modal-foot').getBoundingClientRect(), d = o.querySelector('details.f-mais'); return { secs: o.querySelectorAll('.f-sec').length, titulos: Array.from(o.querySelectorAll('.f-sec-t')).map(e => e.innerText.trim()), maisAberto: d ? d.open : null, maisN: o.querySelectorAll('details.f-mais').length, rodapeNaTela: foot.bottom <= innerHeight + 1 && foot.top > 0, botoes: Array.from(o.querySelectorAll('.modal-foot button')).map(b => b.innerText.trim()) }; }, ov);
check(await page.evaluate(() => { const c = {}, d = []; document.querySelectorAll('[id]').forEach(e => { c[e.id] = (c[e.id] || 0) + 1; if (c[e.id] === 2) d.push(e.id); }); window.__dup = d; return d.length === 0; }), 'nenhum id repetido na página (' + (await page.evaluate(() => (window.__dup || []).join(','))) + ')');
for (const [nome, fn, ov] of [['Nova inicial', 'abrirNovo', 'overlay'], ['Novo acordo', 'abrirNovoAcordo', 'overlayAcordo'], ['Novo alvará', 'abrirNovoAlvara', 'overlayAlvara']]) {
  await abre(fn); await page.waitForTimeout(500); const i = await info(ov);
  check(i.secs >= 3 && i.maisN === 1 && i.maisAberto === false, nome + ': ' + i.secs + ' blocos (' + i.titulos.join(' · ') + ') e "Mais detalhes" fechado');
  check(i.rodapeNaTela && i.botoes.join() === 'Cancelar,Salvar', nome + ': rodapé Cancelar | Salvar sempre à vista');
}
for (const [nome, fn, ov, min, mais] of [['Nova despesa', 'abrirNovaDespesa', 'overlayDespesa', 2, 1], ['Nova receita', 'abrirNovaReceita', 'overlayReceita', 2, 0], ['Nova meta', 'abrirNovaMeta', 'overlayMeta', 2, 0]]) {
  await abre(fn); await page.waitForTimeout(500); const i = await info(ov);
  check(i.secs >= min && i.maisN === mais && (mais === 0 || i.maisAberto === false) && i.rodapeNaTela, nome + ': ' + i.secs + ' blocos (' + i.titulos.join(' · ') + ')' + (mais ? ', "Mais detalhes" fechado' : '') + ' e rodapé à vista');
}
await abre('abrirNovaDespesa'); await page.waitForTimeout(400);
await page.fill('#despesaNomeInput', 'Despesa de teste da ficha'); await page.fill('#despesaValorInput', '123.45'); await page.click('#saveBtnDespesa'); await page.waitForTimeout(1200);
check((await f('GET', '/api/db/despesas')).j.docs.some(d => (d.data.nome || d.data.descricao) === 'Despesa de teste da ficha'), 'salvar uma despesa pela ficha nova grava normalmente');
await abre('abrirClienteEdit', { nome: '', pagador: 'cliente' }); await page.waitForTimeout(400);
{ const i = await info('overlayClienteEdit'); check(i.secs >= 1 && i.maisN === 1 && i.maisAberto === false && i.rodapeNaTela, 'Novo cliente: ' + i.titulos.join(' · ') + ', "Mais detalhes" fechado e rodapé à vista'); }
await abre('agAbrir', null); await page.waitForTimeout(500);
{ const i = await page.evaluate(() => { const c = document.getElementById('agEdCorpo'), r = c.querySelector('.f-rod-in'), d = c.querySelector('details.f-mais'); return { titulos: Array.from(c.querySelectorAll('.f-sec-t')).map(e => e.innerText.trim()), aberto: d && d.open, botoes: Array.from(r.querySelectorAll('button')).map(b => b.innerText.trim()), noAlcance: r.getBoundingClientRect().top < innerHeight }; });
  check(i.titulos.join() === 'O QUÊ,QUANDO,RESPONSÁVEIS' && i.aberto === false && i.botoes.join() === 'Cancelar,Salvar na agenda' && i.noAlcance, 'Novo item da agenda: ' + i.titulos.join(' · ') + ', "Mais detalhes" fechado e Cancelar | Salvar na agenda à vista'); }
await abre('prAbrirNovo', null); await page.waitForTimeout(500);
{ const i = await page.evaluate(() => { const d = document.getElementById('pr_dadosDet'); return { aberto: d.open, res: document.getElementById('pr_dadosRes').innerText, foot: Array.from(document.querySelectorAll('#prCorpo .f-rod-in button')).map(b => b.innerText.trim()) }; });
  check(i.aberto === false && /preenchidos sozinhos/.test(i.res) && i.foot.join() === 'Cancelar,Cadastrar processo', 'Cadastrar processo: dados num bloco fechado com resumo e rodapé Cancelar | Cadastrar processo'); }
await page.evaluate(() => { document.getElementById('pr_dadosDet').open = true; }); await page.fill('#pr_partes', 'Fulano x Banco Teste'); await page.waitForTimeout(900);
check(/Fulano x Banco Teste/.test(await page.evaluate(() => document.getElementById('pr_dadosRes').innerText)), 'o resumo dos dados acompanha o que está nos campos');
await abre('edit', caso.j.id); await page.waitForTimeout(600);
check((await info('overlay')).maisAberto === true && (await page.evaluate(() => document.getElementById('obsInput').value)) === 'Observação preenchida', 'Editar inicial com observação: "Mais detalhes" abre sozinho e mostra o campo');
await abre('edit', caso2.j.id); await page.waitForTimeout(600);
check((await info('overlay')).maisAberto === false, 'Editar inicial sem nada nos detalhes: continua fechado');
await page.click('#overlay details.f-mais > summary'); await page.waitForTimeout(200);
check(await page.evaluate(() => document.getElementById('obsInput').offsetParent !== null), 'tocar em "Mais detalhes" abre os campos');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
