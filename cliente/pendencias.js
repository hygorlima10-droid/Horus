/* ============================================================
   PENDÊNCIAS (prefixo pd) — Onda 2 da auditoria
   Um selo "⚑ N" no cabeçalho substitui os avisos repetidos em cada lista
   ("N registros sem advogado definido · Definir", "Ligações a revisar", "Iniciais sem processo"…).
   Ao tocar, abre uma folha com cada pendência e o botão que resolve (Definir, Revisar…).
   ============================================================ */
var PD_TABS = { processos: 1, peticoes: 1, acordos: 1, alvaras: 1, clientes: 1, arquivados: 1, agenda: 1 };
function pdLista(){
  var l = [], eu = esS.eu || {}, dono = eu.papel === 'proprietario', n;
  try{ n = (dono && esS.sem) ? esS.sem.itens.length : 0; if (n) l.push({ k: 'sem', n: n, t: n + (n === 1 ? ' registro sem advogado definido' : ' registros sem advogado definido'), d: 'Enquanto não houver advogado, só você (e o estagiário) vê o registro.', b: 'Definir' }); }catch(e){}
  try{ n = dono ? agSemResp().length : 0; if (n) l.push({ k: 'agrev', n: n, t: n + (n === 1 ? ' prazo ou audiência sem responsável' : ' prazos e audiências sem responsável'), d: 'Quem é responsável vê o item na própria agenda.', b: 'Definir' }); }catch(e){}
  try{
    if (eu.papel && eu.papel !== 'advogado'){
      var r = lgRevCalcular(), p = []; n = r.sem.length + r.dif.length;
      if (r.sem.length) p.push(r.sem.length + ' sem processo cadastrado'); if (r.dif.length) p.push(r.dif.length + ' com cliente diferente');
      if (n) l.push({ k: 'lg', n: n, t: 'Atos com ligação a conferir', d: p.join(' · ') + ' (Iniciais, Acordos e Alvarás).', b: 'Revisar' });
    }
  }catch(e){}
  try{ n = impContaRev(); if (n) l.push({ k: 'imp', n: n, t: n + (n === 1 ? ' processo sem cliente' : ' processos sem cliente'), d: 'Importados do Diário Oficial e cadastrados sem cliente: uma lista só, do escritório todo.', b: 'Revisar' }); }catch(e){}
  try{ n = prIniciaisPend(false).length; if (n) l.push({ k: 'ini', n: n, t: n + (n === 1 ? ' Inicial sem processo cadastrado' : ' Iniciais sem processo cadastrado'), d: 'Ao cadastrar o processo, escolha “Vincular a uma Inicial cadastrada”. Se a Inicial não tem processo, marque isso no cadastro dela.', b: '' }); }catch(e){}
  return l;
}
function pdAtualizar(){
  var el = qs('pdSelo'); if (!el) return;
  var dono = esS.eu && esS.eu.papel === 'proprietario';
  if (dono && PD_TABS[activeTab] && (!esS.sem || Date.now() - esS.semEm > 60000)) esCarregarSem();
  var l = PD_TABS[activeTab] ? pdLista() : [], n = l.reduce(function(a, x){ return a + x.n; }, 0);
  el.hidden = !n; el.querySelector('b').textContent = n > 99 ? '99+' : n; el.setAttribute('aria-label', 'Pendências: ' + n + (n === 1 ? ' registro' : ' registros'));
}
function pdAbrir(){
  var ov = sgMontar('overlayPend', 'Pendências');
  if (!ov.getAttribute('data-pd')){
    ov.setAttribute('data-pd', '1');
    ov.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-pdl]') : null; if (!b) return;
      var k = b.getAttribute('data-pdl'); ov.classList.remove('show');
      if (k === 'sem') esAbrirRev(); else if (k === 'agrev') agAbrirRevResp(); else if (k === 'lg') lgAbrirRev();
      else if (k === 'imp'){ setActiveTab('processos'); prS.sub = 'lista'; prS.filtro = 'revisar'; prS.mais = 1; try{ prRender(); }catch(x){} }
    });
  }
  var l = pdLista();
  qs('overlayPendC').innerHTML = l.length ? l.map(function(x){ return '<div class="pb-sec pd-it"><div class="pb-sec-t">' + escapeHtml(x.t) + '</div><div class="saldo-data">' + escapeHtml(x.d) + '</div>' + (x.b ? '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-pdl="' + x.k + '">' + x.b + '</button></div>' : '') + '</div>'; }).join('') : '<div class="financeiro-vazio">Nada pendente.</div>';
  ov.classList.add('show');
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.pd-selo{position:relative;display:inline-grid;place-items:center;width:38px;height:38px;padding:0;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--ink);cursor:pointer;flex:none}.pd-selo[hidden]{display:none}.pd-selo b{position:absolute;top:-5px;right:-5px;background:var(--urgente);color:#fff;border-radius:99px;min-width:19px;height:19px;padding:0 5px;display:grid;place-items:center;font-size:var(--t1);font-weight:700}';
  document.head.appendChild(st);
  var b = qs('pdSelo'); if (b) b.addEventListener('click', pdAbrir);
  setInterval(function(){ if (!document.hidden) try{ pdAtualizar(); }catch(e){} }, 8000);
  var o = esBarra; esBarra = function(){ var r = o.apply(this, arguments); try{ pdAtualizar(); }catch(e){} return r; };
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { pdLista: pdLista, pdAtualizar: pdAtualizar });
  /* só para os testes e a auditoria visual abrirem cada ficha de cadastro */
  var fichas = {}; ['abrirNovo', 'abrirNovoAcordo', 'abrirNovoAlvara', 'abrirNovaDespesa', 'abrirNovaReceita', 'abrirNovaMeta', 'abrirTransferencia', 'abrirModalSaldo', 'abrirRepasse', 'abrirClienteEdit', 'abrirExito', 'abrirReneg', 'abrirBaixa', 'abrirMovMeta', 'abrirLancamentos', 'agAbrir', 'prAbrirNovo', 'pzAbrir', 'abrirModalBackup', 'pbAbrirOabs', 'usAbrir', 'obraAbrirGasto', 'abrirBaixa', 'abrirReneg'].forEach(function(n){ try{ fichas[n] = eval(n); }catch(e){} });
  window.__horusTeste.fichas = fichas;
})();
