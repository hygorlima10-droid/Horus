/* Tarefa delegada criada de dentro de uma tarefa (ou prazo) da Agenda: serve para a tarefa COMPLEMENTAR (ex.: tirar as custas de um agravo de instrumento).
   Botão "Criar tarefa delegada" na ficha do item da Agenda; a delegada nasce na aba Delegadas, já ligada ao mesmo processo e cliente (campo agendaKey = item da Agenda),
   e a ficha da Agenda passa a listar as tarefas delegadas ligadas a ela (com quem faz, prazo e se já foi feita). Quem recebeu é avisado pelo caminho das demais delegadas. */
var agdgS = { key: '', resp: '', prazo: '', prio: 'Média' };

function agdgDe(i){
  if (typeof dgS === 'undefined' || !dgS.ok || !i) return [];
  return dgS.docs.filter(function(d){ return d.agendaKey && d.agendaKey === i.key; });
}
/* bloco da ficha do item: botão + as delegadas já criadas a partir dele */
function agdgBloco(i){
  if (typeof dgS !== 'undefined' && !dgS.ok && !dgS.carregando){ dgCarregar(true).then(function(){ try{ if (typeof agdAtualizar === 'function') agdAtualizar(); }catch(e){} }); }
  var ts = agdgDe(i).sort(function(a, b){ return String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')); });
  var lis = ts.map(function(t){
    return '<button type="button" class="agdg-t' + (dgFeita(t) ? ' feita' : '') + '" data-agd="dgt" data-k="' + escapeHtml(t.id) + '" title="Abrir a tarefa nas Delegadas"><span class="agdg-n">' + escapeHtml(t.titulo) + '</span><span class="agdg-m">' + escapeHtml(dgCurto(t.resp) || 'sem responsável') + (t.fatal ? ' · até ' + escapeHtml(fmtData(t.fatal).slice(0, 5)) : '') + ' · ' + escapeHtml(dgStatusDe(t.status)[1]) + '</span></button>';
  }).join('');
  return agdBloco('Tarefas delegadas', (lis ? '<div class="agdg-l">' + lis + '</div>' : '<div class="agd-sub" style="margin:0 0 6px">Nenhuma ainda. Use para uma tarefa complementar (ex.: tirar as custas).</div>') +
    '<div class="agd-acoes"><button type="button" class="btn btn-ghost pb-b" data-agd="delegar">＋ Criar tarefa delegada</button></div>');
}
function agdgDiaMais(n){ return somarDias(todayISO(), n); }
function agCriarDelegada(key){
  var i = (typeof agdItem === 'function') ? agdItem(key) : agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (typeof dgS !== 'undefined' && !dgS.ok && !dgS.carregando) dgCarregar(true);
  agdgS = { key: i.key, resp: '', prazo: '', prio: 'Média' };
  var dc = dgClienteDoProcesso(i.processo), cli = i.cliente || dc.nome || '';
  var ov = sgMontar('overlayAgDg', 'Tarefa delegada'); ov.querySelector('h2').textContent = 'Tarefa delegada';
  var pess = dgPessoas();
  var chipsP = pess.map(function(x){ return '<button type="button" class="pbdg-p" data-agdg="resp" data-k="' + escapeHtml(x.k) + '">' + dgAv(x.k) + '<span>' + escapeHtml(String(x.nome).split(/\s+/)[0]) + (x.tipo === 'est' ? ' · est.' : '') + '</span></button>'; }).join('');
  var fld = function(rot, html, f){ return '<div class="field"><label class="field-label" for="agdg_' + f + '">' + rot + '</label>' + html + '</div>'; };
  var ctx = 'Complementar à tarefa “' + i.titulo + '” (' + fmtData(i.data) + ').';
  var h = '<div class="pr-hon-cab"><b>' + escapeHtml(cli || 'Tarefa da Agenda') + '</b><span>' + (i.processo ? 'Proc. ' + escapeHtml(i.processo) + ' · ' : '') + 'a partir de: ' + escapeHtml(i.titulo) + ' · ' + escapeHtml(fmtData(i.data)) + '</span></div>' +
    fSec('Tarefa', fld('Tarefa *', '<textarea id="agdg_titulo" rows="2" maxlength="200" placeholder="Ex.: tirar as custas do agravo de instrumento"></textarea>', 'titulo') +
      '<div class="field"><label class="field-label">Quem faz</label><div class="pbdg-ch" id="agdg_pess">' + chipsP + '</div></div>' +
      '<div class="field"><label class="field-label">Prazo fatal (opcional)</label><div class="pbdg-ch" id="agdg_prazos">' +
        '<button type="button" class="pbdg-c" data-agdg="prazo" data-d="' + agdgDiaMais(0) + '">Hoje</button><button type="button" class="pbdg-c" data-agdg="prazo" data-d="' + agdgDiaMais(1) + '">Amanhã</button><button type="button" class="pbdg-c" data-agdg="prazo" data-d="' + agdgDiaMais(3) + '">Em 3 dias</button>' + (i.data && i.data >= todayISO() ? '<button type="button" class="pbdg-c" data-agdg="prazo" data-d="' + escapeHtml(i.data) + '">No prazo da tarefa (' + escapeHtml(fmtData(i.data).slice(0, 5)) + ')</button>' : '') + '<button type="button" class="pbdg-c" data-agdg="prazo" data-d="data">Escolher data</button></div>' +
        '<input type="date" id="agdg_fatal" style="display:none;margin-top:8px"></div>' +
      '<div class="field"><label class="field-label">Prioridade</label><div class="pbdg-ch" id="agdg_prios">' + DG_PRIO.slice().reverse().map(function(x){ return '<button type="button" class="pbdg-c' + (x[0] === 'Média' ? ' on' : '') + '" data-agdg="prio" data-v="' + x[0] + '">' + x[0] + '</button>'; }).join('') + '</div></div>') +
    fMais('trabalhar até · observações', fld('Trabalhar até', '<input type="date" id="agdg_trabalhar">', 'trabalhar') + fld('Observações', '<textarea id="agdg_obs" rows="3" maxlength="2000">' + escapeHtml(ctx) + '</textarea>', 'obs')) +
    '<div class="form-error" id="agdg_erro"></div><div class="f-rod-in"><button type="button" class="btn btn-ghost" data-agdg="cancelar">Cancelar</button><button type="button" class="btn btn-primary" data-agdg="lancar" id="agdg_lancar">Lançar tarefa</button></div>';
  qs('overlayAgDgC').innerHTML = h;
  if (!ov.getAttribute('data-agdg')){ ov.setAttribute('data-agdg', '1'); ov.addEventListener('click', agdgClique); }
  ov.classList.add('show'); try{ fichaMaisEm(qs('overlayAgDgC')); }catch(e){}
  var t = qs('agdg_titulo'); if (t) t.focus();
}
function agdgClique(ev){
  var b = ev.target.closest ? ev.target.closest('[data-agdg]') : null; if (!b) return;
  var a = b.getAttribute('data-agdg'), ov = qs('overlayAgDg');
  if (a === 'resp'){
    var k = b.getAttribute('data-k'); agdgS.resp = agdgS.resp === k ? '' : k;
    Array.prototype.forEach.call(qs('agdg_pess').children, function(c){ c.classList.toggle('on', c.getAttribute('data-k') === agdgS.resp); });
  } else if (a === 'prazo'){
    var d = b.getAttribute('data-d'), campo = qs('agdg_fatal');
    if (d === 'data'){ campo.style.display = ''; agdgS.prazo = campo.value || ''; try{ campo.focus(); }catch(e){} }
    else { campo.style.display = 'none'; campo.value = ''; agdgS.prazo = agdgS.prazo === d ? '' : d; }
    Array.prototype.forEach.call(qs('agdg_prazos').children, function(c){ var cd = c.getAttribute('data-d'); c.classList.toggle('on', (cd === 'data' && campo.style.display !== 'none') || (cd !== 'data' && cd === agdgS.prazo && campo.style.display === 'none')); });
  } else if (a === 'prio'){
    agdgS.prio = b.getAttribute('data-v');
    Array.prototype.forEach.call(qs('agdg_prios').children, function(c){ c.classList.toggle('on', c.getAttribute('data-v') === agdgS.prio); });
  } else if (a === 'cancelar') ov.classList.remove('show');
  else if (a === 'lancar') agdgLancar();
}
function agdgLancar(){
  var err = qs('agdg_erro'), i = (typeof agdItem === 'function') ? agdItem(agdgS.key) : null, titulo = qs('agdg_titulo').value.trim();
  if (!i) return;
  if (!titulo){ err.textContent = 'Digite a tarefa.'; qs('agdg_titulo').focus(); return; }
  var campo = qs('agdg_fatal'), fatal = campo.style.display !== 'none' ? campo.value : agdgS.prazo;
  var dc = dgClienteDoProcesso(i.processo), me = dgMe();
  var d = { titulo: titulo, cliente: i.cliente || dc.nome || '', clienteId: dc.id, processo: i.processo || '', resp: agdgS.resp || me, delegadoPor: me, prioridade: agdgS.prio || 'Média', status: 'afazer', trabalhar: qs('agdg_trabalhar').value || '', fatal: fatal || '', obs: qs('agdg_obs').value.trim(), agendaKey: i.key, agendaTitulo: i.titulo, criadoPor: esS.eu ? esS.eu.id : '', criadoEm: new Date().toISOString() };
  var bt = qs('agdg_lancar'); bt.disabled = true;
  dgGravar(d).then(function(){
    dgS.docs.push(d); dgCacheEst = {}; try{ dgAtualizarSelo(); }catch(e){}
    if (activeTab === 'delegadas') dgRender();
    qs('overlayAgDg').classList.remove('show'); bt.disabled = false;
    toast('Tarefa delegada lançada' + (d.resp ? ' · ' + dgCurto(d.resp) : '') + '.');
    try{ if (typeof agdAtualizar === 'function') agdAtualizar(); }catch(e){}
  }).catch(function(e){ bt.disabled = false; err.textContent = 'Não consegui lançar: ' + e.message; });
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.agdg-l{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}.agdg-t{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;width:100%;border:1px solid var(--border);border-left:4px solid #2A78D6;border-radius:10px;background:var(--surface);color:var(--ink);padding:7px 10px;font:inherit;cursor:pointer}.agdg-t.feita{border-left-color:#1F8A4C;opacity:.75}.agdg-n{font-weight:700;font-size:var(--t2)}.agdg-m{font-size:var(--t1);color:var(--ink-soft)}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { agCriarDelegada: agCriarDelegada, agdgDe: agdgDe });
})();
