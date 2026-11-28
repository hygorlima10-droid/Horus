// Padrão visual (20/11): chave liga/desliga igual à do iPhone em todo o app + três reparos de layout vistos no celular
// (frase da Construção que passava do cartão; campo de data e cartões de mês dos Extratos).
// Servidor do grupo 'permissoes':  node test/rodar.mjs padrao-visual
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
const FOTOS = process.env.FOTOS || '/tmp/horus-fotos';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
fs.mkdirSync(FOTOS, { recursive: true });
const br = await chromium.launch();
async function abrir(w) {
  const ctx = await br.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
  const page = await ctx.newPage(); page.erros = []; page.on('pageerror', (e) => page.erros.push(e.message)); await page.route(/fonts\./, (r) => r.abort());
  await page.goto(B + '/'); await page.waitForTimeout(2500); return page;
}
const page = await abrir(390);

console.log('\n— chave liga/desliga no padrão do iPhone');
await page.evaluate(() => document.getElementById('abrirLembretesBtn').click()); await page.waitForTimeout(1200);
const sw = await page.evaluate(() => Array.from(document.querySelectorAll('#overlayLembretes .nt-sw')).map((e) => {
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e), k = getComputedStyle(e, '::after');
  const m = new DOMMatrix(k.transform === 'none' ? undefined : k.transform);
  return { w: Math.round(r.width), h: Math.round(r.height), on: e.checked, bg: cs.backgroundColor, kw: parseFloat(k.width), kl: parseFloat(k.left), tx: m.m41 };
}));
check(sw.length >= 5, 'a tela Lembretes mostra as chaves: ' + sw.length);
check(sw.every((s) => s.w === 51 && s.h === 31), 'todas têm 51 × 31 px (sem esticar nem encolher)');
check(sw.filter((s) => s.on).every((s) => s.bg === 'rgb(100, 172, 108)' && s.kl + s.kw + 20 <= 51 && Math.round(s.tx) === 20), 'ligada: verde suave da foto de referência e a bolinha de 27 px fica toda dentro do trilho (' + sw.filter((s) => s.on).length + ' ligadas)');
check(sw.filter((s) => !s.on).every((s) => s.bg === 'rgb(196, 196, 201)' && Math.round(s.tx) === 0), 'desligada: cinza claro com a bolinha à esquerda (' + sw.filter((s) => !s.on).length + ' desligada(s))');
await page.screenshot({ path: FOTOS + '/chaves-lembretes.png' });
const pl = await page.evaluate(() => { const i = document.createElement('input'); i.type = 'checkbox'; i.className = 'pl-sw'; i.checked = true; document.body.appendChild(i); const r = i.getBoundingClientRect(), bg = getComputedStyle(i).backgroundColor; i.remove(); return [Math.round(r.width), Math.round(r.height), bg]; });
check(pl[0] === 51 && pl[1] === 31 && pl[2] === 'rgb(100, 172, 108)', 'a chave "Também na planilha" (.pl-sw) é a mesma: ' + pl);
const gen = await page.evaluate(() => { const i = document.createElement('input'); i.type = 'checkbox'; i.className = 'sw'; document.body.appendChild(i); const r = i.getBoundingClientRect(); i.remove(); return [Math.round(r.width), Math.round(r.height)]; });
check(gen[0] === 51 && gen[1] === 31, 'a classe genérica .sw (para chaves novas) também nasce no padrão: ' + gen);
await page.evaluate(() => document.getElementById('overlayLembretes').classList.remove('show'));

console.log('\n— Construção: a frase não passa do cartão');
await page.evaluate(() => document.querySelector('[data-tab="obra"]').click()); await page.waitForTimeout(1200);
const ob = await page.evaluate(() => {
  const wrap = document.createElement('div'); wrap.className = 'financeiro-bloco'; wrap.id = 'tstObra';
  wrap.innerHTML = '<div class="ob-gasto"><div class="ct-ic">$</div><div class="ob-gasto-info"><b>Aporte</b><span class="saldo-data">19/11/2026 · já estava na conta da obra · Recebido: Murilo Falone x Dennis e David (Honorários do acordo)</span></div><div class="ob-gasto-val"><strong>+ R$ 99.000,00</strong><span><span class="saldo-data">veio de um recebimento: para desfazer, desfaça o recebimento</span></span></div></div>';
  document.getElementById('bodyObra').appendChild(wrap);
  const f = wrap.querySelector('.ob-gasto-val .saldo-data'), r = f.getBoundingClientRect(), c = wrap.getBoundingClientRect();
  return { dir: Math.round(r.right), cartao: Math.round(c.right), linhas: Math.round(r.height / (parseFloat(getComputedStyle(f).lineHeight) || 16)) };
});
check(ob.dir <= ob.cartao, 'a frase "veio de um recebimento…" termina dentro do cartão (' + ob.dir + ' ≤ ' + ob.cartao + ') e quebra em ' + ob.linhas + ' linhas');
await page.screenshot({ path: FOTOS + '/construcao-frase.png' });

console.log('\n— Extratos: campo de data e cartões dos meses');
await page.evaluate(() => document.querySelector('[data-tab="extratos"]').click()); await page.waitForTimeout(1500);
const ex = await page.evaluate(() => {
  const d = document.getElementById('extDia');
  d.innerHTML = '<div class="financeiro-secao-head"><h4>Gastos do dia a dia (dos extratos)</h4></div>' + ['novembro de 2026', 'outubro de 2026', 'setembro de 2026'].map((m, i) => '<details class="ini-card ext-dd"><summary><b>' + m + '</b> · contas pessoais R$ ' + (4301 - i * 900) + ',52 · pago pela PJ R$ 1.021,53</summary><div class="ext-dd-tit">Contas pessoais</div><div class="plan-linha"><span>Alimentação <em>(12)</em></span><strong>R$ 1.200,00</strong></div></details>').join('');
  const cards = Array.from(d.querySelectorAll('.ext-dd')).map((c) => c.getBoundingClientRect()), sumB = Array.from(d.querySelectorAll('.ext-dd > summary > b')).map((b) => Math.round(b.getBoundingClientRect().left));
  const campo = document.getElementById('impCorte'); let dentro = null;
  if (campo) { const rc = campo.getBoundingClientRect(), pai = campo.closest('.ini-card, .financeiro-bloco, .field').getBoundingClientRect(); dentro = [Math.round(rc.right), Math.round(pai.right)]; }
  return { gaps: cards.slice(1).map((c, i) => Math.round(c.top - cards[i].bottom)), alinhados: sumB.every((x) => x === sumB[0]), dentro, larg: document.documentElement.scrollWidth <= innerWidth + 1 };
});
check(ex.gaps.every((g) => g >= 8), 'os cartões de mês não se sobrepõem (espaço entre eles: ' + ex.gaps + ' px)');
check(ex.alinhados, 'o nome do mês fica alinhado à esquerda nos três cartões');
check(!ex.dentro || ex.dentro[0] <= ex.dentro[1], 'o campo "Importar lançamentos a partir de" fica dentro do cartão (' + (ex.dentro ? ex.dentro.join(' ≤ ') : 'sem campo') + ')');
check(ex.larg, 'a tela não ganha rolagem lateral');
await page.screenshot({ path: FOTOS + '/extratos-cartoes.png' });
check(page.erros.length === 0, 'sem erros de JavaScript na página: ' + page.erros.join(' | '));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
