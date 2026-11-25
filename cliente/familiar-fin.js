/* ============================================================
   FINANÇAS DO FAMILIAR (prefixo ffn) — o familiar com o módulo "Finanças pessoais" liberado vê só a parte pessoal (PF):
   sem aba PJ, sem transferência PF↔PJ, sem honorários. Os dados dele ficam no cofre próprio (o servidor separa).
   - menu e sub-abas: Visão geral · Salário e fixos (a coluna PF) · Divisão do salário · Patrimônio e metas · Orçamento · Análises;
   - "Divisão do salário" no lugar da "Divisão do mês" (que é do caixa da PJ): salário e entradas do mês → gastos fixos, parcela do consórcio,
     aporte na obra, outros gastos, reserva e o que sobra (sem plano em %: a reserva e as metas têm o valor-alvo no próprio cadastro);
   - a parcela do consórcio (Construção) sai do caixa dele: um lançamento vale nos dois módulos.
   ============================================================ */
function ffnAtivo(){ try{ return ppFamiliar() && ppFamModulos().indexOf('financas') >= 0; }catch(e){ return false; } }
var FFN_ABAS = [['resumo', 'Visão geral'], ['pf', 'Salário e fixos'], ['geral', 'Divisão do salário'], ['patrimonio', 'Patrimônio e metas'], ['orcamento', 'Orçamento'], ['analises', 'Análises']];
var FFN_ROT = { resumo: 'Visão geral', geral: 'Divisão do salário', pf: 'Salário e fixos', patrimonio: 'Patrimônio e metas', orcamento: 'Orçamento', analises: 'Análises' };
var FFN_PARTES = [['fixos', 'Gastos fixos', '#4F46E5'], ['consorcio', 'Parcela do consórcio', '#C98500'], ['aporte', 'Aporte na obra', '#B7791E'], ['outros', 'Outros gastos', '#DB2777'], ['reserva', 'Reserva', '#17895A']];

/* o que entrou, saiu e foi separado no mês escolhido (só pessoa física) */
function ffnDados(){
  var m = mesSelecionado, ent = 0, rec = 0, fixos = 0, outros = 0, parc = 0, apo = 0;
  getReceitasManuaisParaMes('pf').forEach(function(it){ var v = Number(it.valor) || 0; ent += v; if (it.recebido) rec += v; });
  getDespesasParaMes('pf').forEach(function(it){
    var d = it.despesa; if (d.transferenciaId) return;
    var v = valorDespesaItem(it); if (!(v > 0)) return;
    if (d.tipo === 'fixa') fixos += v; else outros += v;
  });
  if (ppFamModulos().indexOf('obra') >= 0) obraMov.forEach(function(x){
    if (String(x.data || '').slice(0, 7) !== m) return;
    var v = Number(x.valor) || 0;
    if (x.tipo === 'parcela') parc += v; else if (x.tipo === 'aporte' && x.origem === 'pf') apo += v;
  });
  var res = Math.max(0, aportadoReservaMes());
  var gasto = fixos + outros + parc + apo + res;
  return { entrada: r2(ent), recebido: r2(rec), v: { fixos: r2(fixos), consorcio: r2(parc), aporte: r2(apo), outros: r2(outros), reserva: r2(res) }, livre: r2(ent - gasto) };
}
function ffnPct(v, base){ return base > 0.004 ? Math.round(v / base * 100) : 0; }
function ffnDivisaoHtml(){
  var ccq = (typeof ccqResumoDivisao === 'function') ? ccqResumoDivisao() : '';
  var d = ffnDados(), base = d.entrada, tem = base > 0.004;
  var cab = '<div class="financeiro-secao-head" style="flex-wrap:wrap"><h4 style="white-space:normal;min-width:0;flex:1 1 180px">Divisão do salário · ' + escapeHtml(mesLabel(mesSelecionado)) + '</h4></div>';
  var obra = ffnObraReceberHtml();
  if (!tem) return ccq + '<div class="financeiro-bloco">' + cab + '<div class="financeiro-vazio">Ainda não há salário nem outra entrada lançada neste mês. Em <b>Salário e fixos</b>, use “Lançar receita” (marque <b>recorrente</b> para o salário se repetir todo mês).</div><button type="button" class="btn btn-ghost" data-ffn="ir-pf">Ir para Salário e fixos</button></div>' + obra;
  var partes = FFN_PARTES.filter(function(p){ return d.v[p[0]] > 0.004; });
  var barra = discreto ? '' : '<div class="mf-stk">' + partes.map(function(p){ return '<i style="width:' + Math.max(0, d.v[p[0]] / base * 100) + '%;background:' + p[2] + '" title="' + escapeHtml(p[1]) + '"></i>'; }).join('') + (d.livre > 0 ? '<i style="width:' + (d.livre / base * 100) + '%;background:#B9B7AE" title="Livre"></i>' : '') + '</div>';
  var linhas = partes.map(function(p){
    var v = d.v[p[0]], pct = ffnPct(v, base);
    return '<div class="fp-eq"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + p[2] + ';margin-right:7px"></i>' + escapeHtml(p[1]) + '</span><b>' + fmtMoeda(v) + ' · ' + pct + '%</b></div>';
  }).join('');
  var sobra = '<div class="fp-eq tot"><span>' + (d.livre >= -0.005 ? 'Livre para o mês' : 'Passou do salário') + '</span><b class="' + (d.livre >= -0.005 ? 'ok' : 'neg') + '">' + (d.livre < -0.005 ? '− ' : '') + fmtMoeda(Math.abs(d.livre)) + ' · ' + ffnPct(Math.abs(d.livre), base) + '%</b></div>';
  return ccq + '<div class="financeiro-bloco">' + cab + '<div class="fv-k">Salário e entradas do mês</div><div class="fv-big">' + fmtMoeda(base) + '</div>' +
    '<div class="saldo-data">Já recebido ' + fmtMoeda(d.recebido) + (base - d.recebido > 0.004 ? ' · ainda a receber ' + fmtMoeda(base - d.recebido) : '') + '</div>' + barra + linhas + sobra +
    '<div class="saldo-data" style="margin-top:8px">“Reserva” soma o que foi guardado na meta de reserva; “Parcela do consórcio” e “Aporte na obra” vêm da aba Construção.</div></div>' + obra;
}
/* "Dinheiro da obra a receber" (antes nas Análises): entradas que vão para a construção e saem do caixa do dia a dia; só com o módulo Construção */
function ffnObraReceberHtml(){
  try{ if (ppFamModulos().indexOf('obra') < 0 || typeof anCardObra !== 'function') return ''; return '<div id="ffnObraReceber">' + anCardObra(anProjecao(3)) + '</div>'; }catch(e){ console.error('dinheiro da obra a receber', e); return ''; }
}
document.addEventListener('click', function(e){
  var box = e.target.closest && e.target.closest('#ffnObraReceber');
  if (box){   /* o cartão veio das Análises: os cliques dele são tratados aqui */
    var pk = e.target.closest('[data-an-obra-picker]'); if (pk){ anObraPicker = !anObraPicker; renderFinGeral(); return; }
    var at = e.target.closest('[data-an-atip]'); if (at){ anMarcarObra(at.getAttribute('data-an-atip')); return; }
  }
  var b = e.target.closest && e.target.closest('[data-ffn]'); if (!b) return;
  var k = b.getAttribute('data-ffn');
  if (k === 'ir-pf') irParaFinTab('pf');
});

/* menu, títulos e sub-abas só PF */
function ffnRotular(){
  if (!ffnAtivo()) return;
  try{ EXT_ACT_ROTULO.dia = 'Gasto na conta (escolha a categoria)'; EXT_ACT_ROTULO.recNova = 'Receita de outra origem'; EXT_ACT_ROTULO.obraRetirada = 'Receita da construção (devolução da obra)'; }catch(e){}
  try{ FIN_NOMES.geral = FFN_ROT.geral; FIN_NOMES.pf = FFN_ROT.pf; FIN_NOMES.patrimonio = FFN_ROT.patrimonio; }catch(e){}
  Array.prototype.forEach.call(document.querySelectorAll('#drawer .dr-it[data-fin]'), function(b){
    var rot = FFN_ROT[b.getAttribute('data-fin')]; if (!rot) return;
    var l = b.querySelector('.lab'); if (l) l.textContent = rot; b.title = rot;
  });
  var ph = { receitaDescInput: 'Ex.: Salário, 13º salário, adicional de férias', despesaNomeInput: 'Ex.: Escola, plano de saúde, energia' };
  Object.keys(ph).forEach(function(id){ var i = qs(id); if (i) i.placeholder = ph[id]; });
  /* formulários: sem a escolha PF/PJ (tudo é dele) */
  ['segDespesaColuna', 'segReceitaColuna', 'segMetaColuna'].forEach(function(id){ var f = qs(id) && qs(id).closest('.field'); if (f) f.style.display = 'none'; });
  try{ var h = qs('headFinanceiro'); if (h) h.removeAttribute('data-h'); atualizarTituloTela(); }catch(e){}
}
(function(){
  if (typeof mfBarra === 'function'){
    var oBarra = mfBarra;
    mfBarra = function(atual){ return ffnAtivo() ? mdBarraHtml(FFN_ABAS, atual, function(k){ return 'data-mf-aba="' + k + '"'; }) : oBarra.apply(this, arguments); };
  }
  if (typeof renderFinGeral === 'function'){
    var oGeral = renderFinGeral;
    renderFinGeral = function(){
      if (!ffnAtivo()) return oGeral.apply(this, arguments);
      var el = qs('finGeral'); if (!el) return;
      try{ el.innerHTML = ffnDivisaoHtml(); }catch(e){ console.error('divisão do salário', e); el.innerHTML = '<div class="empty"><strong>Não consegui montar a divisão do salário</strong>As outras abas continuam funcionando.</div>'; }
    };
  }
  window.addEventListener('horus-eu', function(){ ffnRotular(); try{ if (ffnAtivo()) renderFinanceiro(); }catch(e){} });
  if (window.__horusEu && window.__horusEu.pronto) ffnRotular();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { ffnAtivo: ffnAtivo, ffnDados: ffnDados });
})();
