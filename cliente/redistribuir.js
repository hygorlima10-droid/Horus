/* Redistribuir saldo — parcelas dos honorários (ficha da Inicial) e do Acordo.
   Aparece só depois que o valor foi mudado na ficha e a soma das parcelas deixou de bater com o total.
   O que já foi pago (parcela paga, ou a parte paga de uma parcela com pagamento parcial) fica como está;
   o saldo restante é dividido em partes iguais entre as parcelas em aberto (os centavos vão na última).
   Nada é gravado aqui: só muda as parcelas da ficha; vale quando a pessoa toca em Salvar. */
var rsAberto = { i: false, a: false }, rsMudou = { i: false, a: false }, rsN = { i: 0, a: 0 }, rsDigitando = { i: false, a: false }, rsTempo = { i: 0, a: 0 };   // rsDigitando: o valor ainda está sendo digitado
var RS_CFG = {
  i: { box: 'rsBoxI', sufixo: 'I', lista: function(){ return parcelasState; }, set: function(l){ parcelasState = l; },
       total: function(){ return parseFloat(qs('valorInput').value) || 0; }, render: function(){ renderParcelasEditor(); },
       ativo: function(){ return formState.pagamento === 'parcelado' && (formState.modalidade === 'fixo' || formState.modalidade === 'fixo_exito'); },
       rot: 'Novo valor dos honorários' },
  a: { box: 'rsBoxA', sufixo: 'A', lista: function(){ return parcelasAcordoState; }, set: function(l){ parcelasAcordoState = l; },
       total: function(){ return parseFloat(qs('acordoValorMeuInput').value) || 0; }, render: function(){ renderParcelasAcordoEditor(); },
       ativo: function(){ return formStateAcordo.pagamento === 'parcelado'; },
       rot: 'Novo valor que lhe cabe' }
};

function rsDataMaisMeses(iso, k){
  if (!iso) return '';
  var p = String(iso).split('-'), y = +p[0], m = +p[1] - 1 + k, d = +p[2];
  var dt = new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

/* Calcula como ficariam as parcelas. nNovo = 0 mantém o número de parcelas em aberto. Não altera nada. */
function rsCalc(cfg, nNovo){
  var lista = cfg.lista(), total = r2(cfg.total()), recebido = 0, pagas = 0, parciais = 0, ab = [];
  lista.forEach(function(p, i){
    if (p.pago){ recebido = r2(recebido + (Number(p.valor) || 0)); pagas++; }
    else {
      var pp = somaParciais(p); recebido = r2(recebido + pp);
      if (pp > 0.004) parciais++;
      ab.push({ i: i, pago: pp, comPag: pp > 0.004 });
    }
  });
  var r = { total: total, recebido: recebido, saldo: r2(total - recebido), pagas: pagas, parciais: parciais, abertas: ab.length, n: 0, linhas: [], final: null, erro: '' };
  if (!ab.length){ r.erro = 'Não há parcela em aberto para receber o saldo.'; return r; }
  if (r.saldo <= 0.004){ r.erro = 'O novo total (' + fmtMoeda(total) + ') precisa ser maior que o já recebido (' + fmtMoeda(recebido) + ').'; return r; }
  var n = nNovo > 0 ? Math.floor(nNovo) : ab.length, fixas = ab.filter(function(x){ return x.comPag; }).length;
  if (n > 60){ r.erro = 'No máximo 60 parcelas em aberto.'; return r; }
  if (n < Math.max(1, fixas)){ r.erro = fixas ? ('Há ' + fixas + ' parcela(s) com pagamento parcial; não dá para ter menos que isso em aberto.') : 'Informe ao menos 1 parcela em aberto.'; return r; }
  var ent = ab.slice();
  if (n < ent.length){                                   // tira do fim as parcelas em aberto sem nenhum pagamento
    var rem = ent.length - n;
    for (var k = ent.length - 1; k >= 0 && rem > 0; k--) if (!ent[k].comPag){ ent.splice(k, 1); rem--; }
  }
  var cent = Math.round(r.saldo * 100), base = Math.floor(cent / n), ultima = cent - base * (n - 1);
  var ultData = lista.reduce(function(m, p){ return p.data && p.data > m ? p.data : m; }, '') || todayISO();
  var porIdx = {}, j, novas = n - ent.length;
  for (j = 0; j < ent.length; j++) porIdx[ent[j].i] = { pago: ent[j].pago, v: (j === n - 1 ? ultima : base) / 100 };
  var fin = [];
  lista.forEach(function(p, i){
    if (p.pago) { fin.push(p); return; }
    var x = porIdx[i];
    if (!x) return;                                      // parcela em aberto removida
    fin.push(Object.assign({}, p, { valor: r2(x.pago + x.v), _rs: true }));
  });
  for (j = 0; j < novas; j++) fin.push({ numero: 0, valor: ((ent.length + j) === n - 1 ? ultima : base) / 100, data: rsDataMaisMeses(ultData, j + 1), pago: false, _rs: true, _nova: true });
  fin.forEach(function(p, i){ p.numero = i + 1; });
  r.n = n; r.final = fin;
  r.linhas = fin.filter(function(p){ return !p.pago; }).map(function(p){ return { numero: p.numero, data: p.data || '', valor: p.valor, nova: !!p._nova }; });
  return r;
}

function rsCaixa(k){
  var cfg = RS_CFG[k], box = qs(cfg.box);
  if (!box){
    var ref = qs(k === 'i' ? 'parcelaSum' : 'parcelaSumAcordo');
    if (!ref) return null;
    box = document.createElement('div'); box.id = cfg.box; box.className = 'rs-box'; box.style.display = 'none';
    ref.insertAdjacentElement('afterend', box);
  }
  return box;
}
function rsPainelHtml(k){
  var s = RS_CFG[k].sufixo;
  return '<div class="rs-pan"><h4>Redistribuir saldo</h4><div class="rs-c" id="rsC' + s + '"></div>' +
    '<div class="rs-l">Dividir em</div><div class="rs-seg"><button type="button" data-rs="manter" data-k="' + k + '" id="rsM' + s + '" class="on"></button><button type="button" data-rs="outro" data-k="' + k + '" id="rsO' + s + '">Outro nº de parcelas</button></div>' +
    '<div class="rs-n" id="rsNW' + s + '" style="display:none"><input type="number" id="rsN' + s + '" min="1" max="60" step="1" inputmode="numeric" placeholder="Nº de parcelas em aberto"></div>' +
    '<div class="rs-prev" id="rsP' + s + '"></div><div class="rs-ok" id="rsS' + s + '"></div>' +
    '<div class="rs-ac"><button type="button" class="btn btn-ghost" data-rs="cancelar" data-k="' + k + '">Cancelar</button><button type="button" class="btn btn-primary" id="rsA' + s + '" data-rs="aplicar" data-k="' + k + '">Aplicar nas parcelas</button></div></div>';
}
function rsPreencher(k){
  var cfg = RS_CFG[k], s = cfg.sufixo, r = rsCalc(cfg, rsN[k]);
  if (!qs('rsC' + s)) return;
  qs('rsC' + s).innerHTML = '<div class="rs-ct"><span>' + cfg.rot + '</span><b>' + fmtMoeda(r.total) + '</b></div>' +
    '<div class="rs-ct"><span>Já recebido (' + (r.pagas ? r.pagas + (r.pagas === 1 ? ' parcela paga' : ' parcelas pagas') : '') + (r.pagas && r.parciais ? ' + ' : '') + (r.parciais ? (r.parciais === 1 ? 'pagamento parcial' : 'pagamentos parciais') : '') + (!r.pagas && !r.parciais ? 'nada ainda' : '') + ')</span><b>− ' + fmtMoeda(r.recebido) + '</b></div>' +
    '<div class="rs-ct rs-tot"><span>Saldo a dividir</span><b>' + fmtMoeda(Math.max(0, r.saldo)) + '</b></div>';
  qs('rsM' + s).textContent = (r.abertas || 0) + (r.abertas === 1 ? ' parcela em aberto' : ' parcelas em aberto');
  var prev = qs('rsP' + s), ok = qs('rsS' + s), bt = qs('rsA' + s);
  if (r.erro){ prev.innerHTML = ''; ok.className = 'rs-ok rs-err'; ok.textContent = r.erro; bt.disabled = true; return; }
  prev.innerHTML = r.linhas.map(function(l){ return '<div class="rs-ln"><span>' + l.numero + 'ª</span><span>' + (l.data ? fmtData(l.data) : '—') + (l.nova ? ' · nova' : '') + '</span><b>' + fmtMoeda(l.valor) + '</b></div>'; }).join('');
  var soma = r2(r.final.reduce(function(t, p){ return t + (Number(p.valor) || 0); }, 0));
  ok.className = 'rs-ok'; ok.textContent = 'Soma: ' + fmtMoeda(soma) + ' ✓ — a última parcela leva os centavos';
  bt.disabled = false;
}
function rsFechar(k){ rsAberto[k] = false; rsN[k] = 0; var b = qs(RS_CFG[k].box); if (b) b.innerHTML = ''; }
function rsAtualizar(){
  ['i', 'a'].forEach(function(k){
    var cfg = RS_CFG[k], box = rsCaixa(k); if (!box) return;
    var lista = cfg.lista(), total = cfg.total(), soma = lista.reduce(function(t, p){ return t + (Number(p.valor) || 0); }, 0);
    var tem = cfg.ativo() && rsMudou[k] && !rsDigitando[k] && total > 0 && soma > 0.009 && Math.abs(soma - total) > 0.009 && lista.some(function(p){ return !p.pago; });
    if (!tem){ if (!rsAberto[k] || !(cfg.ativo() && rsMudou[k] && total > 0)){ box.style.display = 'none'; rsFechar(k); } else if (rsAberto[k]) rsPreencher(k); return; }
    box.style.display = '';
    if (rsAberto[k]){ if (qs('rsC' + cfg.sufixo)) rsPreencher(k); return; }
    if (!box.querySelector('.rs-abrir')) box.innerHTML = '<button type="button" class="pd-bt pd-ouro rs-abrir" data-rs="abrir" data-k="' + k + '">Redistribuir saldo</button>';   // não refaz o botão: refazer entre o toque e o soltar perderia o clique
  });
}
function rsReiniciar(){ ['i', 'a'].forEach(function(k){ rsMudou[k] = false; var b = qs(RS_CFG[k].box); if (b){ b.style.display = 'none'; rsFechar(k); } }); rsAvisoLimpar(); }

/* aviso do "Gerar parcelas automaticamente" quando há parcela já paga: aparece logo abaixo do botão */
function rsAviso(k){
  var id = k === 'i' ? 'genBtn' : 'genABtn', bt = qs(id); if (!bt) return;
  var el = qs('rsAviso' + k);
  if (!el){ el = document.createElement('div'); el.id = 'rsAviso' + k; el.className = 'rs-aviso'; bt.insertAdjacentElement('afterend', el); }
  el.textContent = 'Há parcelas já pagas — para não perder esse histórico, mude o valor e use "Redistribuir saldo" (ou ajuste as parcelas à mão).';
  el.style.display = '';
}
function rsAvisoLimpar(){ ['i', 'a'].forEach(function(k){ var el = qs('rsAviso' + k); if (el) el.style.display = 'none'; }); }

document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-rs]') : null; if (!b) return;
  var k = b.getAttribute('data-k') || 'i', cfg = RS_CFG[k], acao = b.getAttribute('data-rs'), box = qs(cfg.box);
  if (acao === 'abrir'){ rsAberto[k] = true; rsN[k] = 0; box.innerHTML = rsPainelHtml(k); rsPreencher(k); }
  else if (acao === 'cancelar'){ rsFechar(k); rsAtualizar(); }
  else if (acao === 'manter'){ rsN[k] = 0; qs('rsM' + cfg.sufixo).className = 'on'; qs('rsO' + cfg.sufixo).className = ''; qs('rsNW' + cfg.sufixo).style.display = 'none'; rsPreencher(k); }
  else if (acao === 'outro'){
    qs('rsM' + cfg.sufixo).className = ''; qs('rsO' + cfg.sufixo).className = 'on'; qs('rsNW' + cfg.sufixo).style.display = '';
    var inp = qs('rsN' + cfg.sufixo); if (!inp.value) inp.value = rsCalc(cfg, 0).abertas; rsN[k] = parseInt(inp.value, 10) || 0; rsPreencher(k);
  }
  else if (acao === 'aplicar'){
    var r = rsCalc(cfg, rsN[k]); if (r.erro) return;
    cfg.set(r.final); rsFechar(k); cfg.render(); rsAtualizar();
  }
}, true);   // captura: as fichas (modais) interrompem o clique antes de chegar ao document
document.addEventListener('input', function(ev){
  var t = ev.target; if (!t || !t.id) return;
  if (t.id === 'rsNI' || t.id === 'rsNA'){ var k = t.id === 'rsNI' ? 'i' : 'a'; rsN[k] = parseInt(t.value, 10) || 0; rsPreencher(k); }
});
(function(){
  var campos = [['valorInput', 'i'], ['acordoValorMeuInput', 'a']];
  campos.forEach(function(c){
    var el = qs(c[0]); if (!el) return;
    var k = c[1], pronto = function(){ rsDigitando[k] = false; try{ if (k === 'i') updateParcelaSum(); else updateParcelaSumAcordo(); }catch(e){} rsAtualizar(); };
    el.addEventListener('input', function(){ rsMudou[k] = true; rsDigitando[k] = true; clearTimeout(rsTempo[k]); rsTempo[k] = setTimeout(pronto, 800); try{ if (k === 'i') updateParcelaSum(); else updateParcelaSumAcordo(); }catch(e){} });   // só compara depois que a pessoa para de digitar
    el.addEventListener('blur', function(){ clearTimeout(rsTempo[k]); pronto(); });
  });
  ['overlay', 'overlayAcordo'].forEach(function(id){
    var ov = qs(id); if (!ov || !window.MutationObserver) return;
    new MutationObserver(function(){ if (!ov.classList.contains('show')) rsReiniciar(); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  });
  var st = document.createElement('style');
  st.textContent = '.rs-box{margin-top:10px}.rs-box .rs-abrir{width:100%}' +
    '.rs-pan{background:var(--surface-2,#f2f3f6);border-radius:16px;padding:12px}.rs-pan h4{margin:0 0 8px;font-size:15px}' +
    '.rs-ct{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin:3px 0}.rs-ct b{text-align:right;white-space:nowrap}.rs-tot{border-top:1.5px solid var(--line,#cfd3dc);margin-top:6px;padding-top:6px;font-size:14px}' +
    '.rs-l{font-size:12.5px;font-weight:800;margin:10px 0 5px}.rs-seg{display:flex;gap:8px}.rs-seg button{flex:1;min-height:40px;border-radius:12px;border:1px solid var(--line,#d6d9e0);background:var(--surface-1,#fff);color:inherit;font:inherit;font-size:13px;padding:6px}.rs-seg button.on{background:var(--ink,#0f1011);color:var(--bg,#fff);border-color:var(--ink,#0f1011);font-weight:700}' +
    '.rs-n{margin-top:8px}.rs-n input{width:100%}.rs-prev{margin-top:10px;font-size:12.5px}.rs-ln{display:grid;grid-template-columns:34px 1fr auto;gap:6px;padding:5px 0;border-bottom:1px solid var(--line,#e1e4ea)}.rs-ln span:first-child{color:var(--ink-soft,#8a8f9c)}' +
    '.rs-ok{margin-top:8px;font-size:12.5px;font-weight:700;color:var(--success,#17714a)}.rs-ok.rs-err{color:var(--urgente,#c0392b)}.rs-ac{display:flex;gap:8px;margin-top:10px}.rs-ac .btn{flex:1;justify-content:center}.rs-ac .btn:disabled{opacity:.45}' +
    '.rs-aviso{font-size:12.5px;line-height:1.4;color:var(--urgente,#c0392b);margin-top:8px}' +
    '.parcela-edit-row.rs-pg .pv,.parcela-edit-row.rs-pg .pd{background:rgba(23,113,74,.10);border-color:rgba(23,113,74,.35);color:#17714a}.parcela-edit-row.rs-mod .pv{background:#fff7e6;border-color:#e8c474;color:#1d1d1f}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { abrirEdicaoAcordo: abrirEdicaoAcordo, rsCalc: function(k, n){ var r = rsCalc(RS_CFG[k], n || 0); r.final = null; return r; } });
})();
