// A estagiária cadastra uma Inicial pela tela (com e sem responsável marcado, com e sem honorários fixos) e o servidor aceita.
// Servidor do grupo 'permissoes':  node test/rodar.mjs estagiaria-cadastra-inicial
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { caio: 'tok-est-caio-0000000000000000000000004', dono: 'tok-dono-0000000000000000000000000001' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (q, m, p) => { const r = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[q] } }); let j = null; try { j = await r.json(); } catch (e) { /* sem corpo */ } return { s: r.status, j }; };
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK.caio, url: B }]);
const p = await ctx.newPage(); const bad = []; p.erros = [];
p.on('pageerror', (e) => p.erros.push(e.message));
p.on('request', (r) => { if (r.method() === 'PUT' && /\/api\/db\/casos\//.test(r.url()) && process.env.DEBUG_EC) console.log('PAYLOAD', (r.postData() || '').slice(0, 1500)); });
p.on('response', async (r) => { if (r.url().startsWith(B + '/api/') && r.status() >= 400) { let t = ''; try { t = (await r.text()).slice(0, 220); } catch (e) { /* sem corpo */ } bad.push(r.request().method() + ' ' + r.url().replace(B, '') + ' → ' + r.status() + ' ' + t); } });
await p.goto(B + '/'); await p.waitForTimeout(1800);
async function cadastra(rotulo, { responsavel, modalidade }) {
  bad.length = 0;
  await p.evaluate(() => window.__horusTeste.fichas.abrirNovo()); await p.waitForTimeout(600);
  await p.fill('#clienteInput', 'Cliente ' + rotulo); await p.fill('#nomeAcaoInput', 'Ação ' + rotulo);
  if (modalidade) { await p.click('#segModalidade [data-value="' + modalidade + '"]'); await p.waitForTimeout(250); }
  if (modalidade === 'fixo' || !modalidade) { await p.fill('#valorInput', '1000'); const d = p.locator('#dataAvistaInput'); if (await d.isVisible()) await d.fill('2026-12-20'); }
  if (responsavel) { const abre = p.locator('[data-esr="abrir"][data-c="casos"]'); if (await abre.count()) { await abre.first().click(); await p.waitForTimeout(300); const cb = p.locator('[data-esr="marcar"][data-c="casos"]'); if (await cb.count()) { await cb.first().check(); await p.waitForTimeout(200); } } }
  await p.click('#saveBtn'); await p.waitForTimeout(1500);
  const erro = await p.locator('#formError').innerText().catch(() => ''); const aberto = await p.evaluate(() => document.getElementById('overlay').classList.contains('show'));
  check(!aberto && !erro && bad.length === 0, rotulo + ': a estagiária salva' + (erro ? ' (erro na tela: ' + erro + ')' : '') + (bad.length ? ' [servidor: ' + bad.join(' | ') + ']' : ''));
  if (aberto) await p.click('#cancelBtn');
}
await cadastra('simples', {});
await cadastra('com responsavel', { responsavel: true });
await cadastra('sem honorarios', { modalidade: 'sem_honorarios' });
await cadastra('responsavel e sem honorarios', { responsavel: true, modalidade: 'sem_honorarios' });
// regra no servidor: o status da Inicial (pendente/protocolado) não é pagamento; "recebido" continua sendo
const caio = async (m, pth, b) => { const r = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK.caio, 'content-type': 'application/json' }, body: JSON.stringify(b) }); return r.status; };
check((await caio('POST', '/api/db/casos', { cliente: 'EC status pendente', status: 'pendente' })) === 200 && (await caio('POST', '/api/db/casos', { cliente: 'EC status protocolado', status: 'protocolado' })) === 200, 'estagiária lança Inicial com status pendente ou protocolado');
check((await caio('POST', '/api/db/termosAcordo', { cliente: 'EC acordo pendente', status: 'pendente' })) === 200, 'estagiária lança Acordo pendente');
check((await caio('POST', '/api/db/termosAcordo', { cliente: 'EC acordo recebido', status: 'recebido' })) === 403 && (await caio('POST', '/api/db/alvaras', { cliente: 'EC alvara recebido', status: 'recebido' })) === 403, 'estagiária NÃO lança Acordo nem Alvará já recebido');
check((await api('dono', 'GET', '/api/db/casos')).j.docs.filter((d) => /^Cliente (simples|com responsavel|sem honorarios|responsavel e sem honorarios)/.test(d.data.cliente || '')).length === 4, 'as quatro Iniciais chegaram ao banco');
check(p.erros.length === 0, 'sem erros de script' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
