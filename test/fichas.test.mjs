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
for (const [nome, fn, ov] of [['Nova inicial', 'abrirNovo', 'overlay'], ['Novo acordo', 'abrirNovoAcordo', 'overlayAcordo'], ['Novo alvará', 'abrirNovoAlvara', 'overlayAlvara']]) {
  await abre(fn); await page.waitForTimeout(500); const i = await info(ov);
  check(i.secs >= 3 && i.maisN === 1 && i.maisAberto === false, nome + ': ' + i.secs + ' blocos (' + i.titulos.join(' · ') + ') e "Mais detalhes" fechado');
  check(i.rodapeNaTela && i.botoes.join() === 'Cancelar,Salvar', nome + ': rodapé Cancelar | Salvar sempre à vista');
}
await abre('edit', caso.j.id); await page.waitForTimeout(600);
check((await info('overlay')).maisAberto === true && (await page.evaluate(() => document.getElementById('obsInput').value)) === 'Observação preenchida', 'Editar inicial com observação: "Mais detalhes" abre sozinho e mostra o campo');
await abre('edit', caso2.j.id); await page.waitForTimeout(600);
check((await info('overlay')).maisAberto === false, 'Editar inicial sem nada nos detalhes: continua fechado');
await page.click('#overlay details.f-mais > summary'); await page.waitForTimeout(200);
check(await page.evaluate(() => document.getElementById('obsInput').offsetParent !== null), 'tocar em "Mais detalhes" abre os campos');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
