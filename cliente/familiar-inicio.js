/* ============================================================
   INÍCIO DO FAMILIAR (prefixo fmi) — tela enxuta: saudação + Central de atenção com os próximos vencimentos (esboço aprovado em 24/11).
   Entram só os módulos que o proprietário liberou:
     - Finanças: despesas pessoais a vencer (fixas e únicas em aberto, também as atrasadas) e o salário previsto ("a receber");
     - Construção: parcela do consórcio, contas da obra a pagar, medições e liberações, checklist (os mesmos avisos da obra).
   Descontos em folha e consignados não entram (já saem do salário). Janela de 7, 15 ou 30 dias; filtro Tudo / Pessoal / Obra quando há os dois módulos.
   Atrasada em vermelho, vencendo hoje em âmbar; tocar no item abre a ação dele (pagar a despesa, ações da obra, salário).
   ============================================================ */
var FMI_LS = 'horus.fmi.v1', fmiS = { filtro: 'tudo', janela: 15 };
try{ var fmiSalvo = JSON.parse(localStorage.getItem(FMI_LS) || '{}'); if ([7, 15, 30].indexOf(fmiSalvo.janela) >= 0) fmiS.janela = fmiSalvo.janela; }catch(e){}
function fmiAtivo(){ try{ return ppFamiliar(); }catch(e){ return false; } }
function fmiGuardar(){ try{ localStorage.setItem(FMI_LS, JSON.stringify({ janela: fmiS.janela })); }catch(e){} }
function fmiUltimoDia(m){ return new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); }
function fmiMesCurto(iso){ return MES_CURTO_AT[Number(iso.slice(5, 7)) - 1].toUpperCase(); }
function fmiQuando(d, hoje){
  var n = Math.round((new Date(d + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
  if (n === 0) return 'vence hoje'; if (n === 1) return 'vence amanhã'; if (n > 1) return 'vence em ' + n + ' dias';
  return n === -1 ? 'atrasada desde ontem' : 'atrasada há ' + Math.abs(n) + ' dias';
}
/* tudo o que pede atenção, já ordenado por data (as atrasadas vêm primeiro) */
function fmiItens(){
  var hoje = todayISO(), lim = somarDias(hoje, fmiS.janela), mods = ppFamModulos(), out = [], m0 = hoje.slice(0, 7), vistos = {};
  if (mods.indexOf('financas') >= 0){
    var meses = [deslocarMes(m0, -1), m0, deslocarMes(m0, 1)]; if (fmiS.janela > 15) meses.push(deslocarMes(m0, 2));
    meses.forEach(function(m){
      comMes(m, function(){
        getDespesasParaMes('pf').forEach(function(it){
          if (it.pago || it.despesa.transferenciaId || !it.vencimento || it.vencimento > lim) return;
          if (it.vencimento < hoje && m < deslocarMes(m0, -1)) return;
          var k = it.despesa.id + '|' + it.vencimento; if (vistos[k]) return; vistos[k] = 1;
          var v = (it.previsto !== null && it.previsto !== undefined) ? Math.max(0, r2(Number(it.previsto) - (it.somaParcial || 0))) : null;
          out.push({ d: it.vencimento, titulo: it.despesa.nome, tag: 'Pessoal', tipo: 'despesa', id: it.despesa.id, valor: v, estimado: v === null });
        });
        getReceitasManuaisParaMes('pf').forEach(function(it){
          if (it.recebido) return; var r = it.receita, val = Number(it.valor) || 0; if (!(val > 0)) return;
          var dia = r.ccqSalario ? Math.min(30, fmiUltimoDia(m)) : Math.min(fmiUltimoDia(m), Number(String(r.data || '').slice(8, 10)) || 5), d = m + '-' + String(dia).padStart(2, '0');
          if (d > lim || d < somarDias(hoje, -10)) return;
          out.push({ d: d, titulo: r.descricao || 'Receita', tag: 'A receber', tipo: 'receita', id: r.id, valor: val, entra: true });
        });
        return 0;
      });
    });
  }
  if (mods.indexOf('obra') >= 0 && typeof ob7Avisos === 'function'){
    try{ ob7Avisos().filter(function(a){ return a.tipo !== 'calc' && a.tipo !== 'juros' && a.d <= lim; }).forEach(function(a){ out.push({ d: a.d, titulo: String(a.titulo).replace(/^Obra · /, ''), sub: a.detalhe, tag: 'Obra', tipo: 'obra', av: a.tipo + '|' + a.id, valor: a.valor, entra: a.tipo === 'med' }); }); }catch(e){ console.error('avisos da obra', e); }
  }
  return out.sort(function(a, b){ return a.d.localeCompare(b.d); });
}
function fmiCss(){
  if (document.getElementById('fmiCss')) return;
  var st = document.createElement('style'); st.id = 'fmiCss';
  st.textContent = '.fmi-card{background:var(--surface);border-radius:20px;padding:6px 20px 12px;box-shadow:0 1px 3px rgba(20,25,50,.06);margin-top:6px}.fmi-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 0 6px}.fmi-hd h2{font-size:var(--t5);margin:0;display:flex;gap:8px;align-items:center}.fmi-badge{background:var(--accent);color:#fff;border-radius:99px;font-size:var(--t1);padding:2px 8px;font-weight:800}' +
    '.fmi-fil{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px;align-items:center}.fmi-f{border:1.5px solid var(--border);border-radius:99px;padding:5px 13px;font:inherit;font-size:var(--t2);font-weight:700;color:var(--ink-soft);background:transparent;cursor:pointer}.fmi-f.on{background:#12172A;color:#fff;border-color:#12172A}.fmi-jan{margin-left:auto;display:flex;gap:6px;align-items:center;font-size:var(--t1);color:var(--ink-soft)}' +
    '.fmi-it{display:grid;grid-template-columns:54px minmax(0,1fr) auto;column-gap:14px;align-items:center;padding:12px 2px;border-top:1px solid var(--border);cursor:pointer;background:none;border-left:0;border-right:0;border-bottom:0;width:100%;text-align:left;font:inherit;color:inherit}.fmi-it:first-of-type{border-top:0}' +
    '.fmi-d{width:54px;height:56px;border-radius:16px;background:var(--surface-2);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05}.fmi-d b{font-size:var(--t6);font-weight:700}.fmi-d span{font-size:var(--t1);font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin-top:2px}.fmi-d.atr{background:rgba(217,59,59,.14)}.fmi-d.atr b{color:var(--urgente)}.fmi-d.hoje{background:rgba(237,161,0,.2)}.fmi-d.hoje b{color:var(--accent)}' +
    '.fmi-t{font-size:var(--t4);font-weight:700}.fmi-w{font-size:var(--t2);color:var(--ink-soft);margin-top:2px}.fmi-w.atr{color:var(--urgente);font-weight:700}.fmi-w.hoje{color:var(--accent);font-weight:700}.fmi-v{font-size:var(--t4);font-weight:800;text-align:right;white-space:nowrap}.fmi-v.pos{color:#16683A}.fmi-v small{display:block;font-size:var(--t1);color:var(--ink-soft);font-weight:600}' +
    '.fmi-tag{display:inline-block;border-radius:99px;padding:1px 8px;font-size:var(--t1);font-weight:800;margin-left:6px;vertical-align:1px}.fmi-tp{background:#E6EEFB;color:#1e5ab3}.fmi-to{background:#FBEFD2;color:#8A5A0B}.fmi-tr{background:#DDF3E5;color:#16683A}' +
    '.fmi-rod{font-size:var(--t2);color:var(--ink-soft);padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.fmi-vazio{padding:18px 4px;color:var(--ink-soft)}.fmi-vazio b{color:var(--ink)}' +
    '@media(max-width:700px){.fmi-card{padding:4px 14px 10px;border-radius:18px}.fmi-it{grid-template-columns:48px minmax(0,1fr);row-gap:2px}.fmi-d{width:48px;height:50px;grid-row:1/3}.fmi-v{grid-column:2;text-align:left;font-size:var(--t3);margin-top:1px}.fmi-t{font-size:var(--t3)}}';
  document.head.appendChild(st);
}
function fmiLinha(x, hoje){
  var atr = x.d < hoje && !x.entra, hojeIt = x.d === hoje && !x.entra, cls = atr ? 'atr' : (hojeIt ? 'hoje' : '');
  var tagCls = x.tag === 'Obra' ? 'fmi-to' : (x.tag === 'A receber' ? 'fmi-tr' : 'fmi-tp');
  var dias = Math.round((new Date(x.d + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
  var when = x.entra ? (x.tipo === 'obra' ? 'liberação prevista ' + (dias === 0 ? 'hoje' : (dias > 0 ? 'em ' + dias + ' dias' : 'há ' + Math.abs(dias) + ' dias (confira)')) : (x.d < hoje ? 'previsto e ainda não marcado como recebido' : 'cai até o dia ' + x.d.slice(8, 10) + ' · previsto')) : (x.tipo === 'obra' && x.av && /^(check)\|/.test(x.av) ? (x.sub || fmiQuando(x.d, hoje)) : fmiQuando(x.d, hoje));
  var valor = x.valor == null ? (x.estimado ? '<small>valor variável</small>' : '') : (x.entra ? '+ ' : '') + fmtMoeda(x.valor);
  var attr = x.tipo === 'obra' ? ' data-ob7-aviso="' + escapeHtml(x.av) + '"' : ' data-fmi="item" data-fmi-tipo="' + x.tipo + '" data-fmi-id="' + escapeHtml(x.id || '') + '"';
  return '<button type="button" class="fmi-it"' + attr + '><span class="fmi-d ' + cls + '"><b>' + x.d.slice(8, 10) + '</b><span>' + fmiMesCurto(x.d) + '</span></span><span><span class="fmi-t">' + escapeHtml(x.titulo) + '</span><span class="fmi-tag ' + tagCls + '">' + x.tag + '</span><div class="fmi-w ' + cls + '">' + escapeHtml(when) + '</div></span><span class="fmi-v' + (x.entra ? ' pos' : '') + '">' + valor + '</span></button>';
}
function fmiHtml(){
  var hoje = todayISO(), todos = fmiItens(), mods = ppFamModulos(), dois = mods.length > 1;
  var itens = todos.filter(function(x){ return fmiS.filtro === 'tudo' || (fmiS.filtro === 'pessoal' ? (x.tag === 'Pessoal' || x.tag === 'A receber') : x.tag === 'Obra'); });
  var fim7 = somarDias(hoje, 7), semana = r2(itens.filter(function(x){ return !x.entra && x.d >= hoje && x.d <= fim7 && x.valor; }).reduce(function(t, x){ return t + x.valor; }, 0)), atrasado = r2(itens.filter(function(x){ return !x.entra && x.d < hoje && x.valor; }).reduce(function(t, x){ return t + x.valor; }, 0));
  var h = '<div class="fmi-card"><div class="fmi-hd"><h2>Central de atenção ' + (itens.length ? '<span class="fmi-badge">' + itens.length + '</span>' : '') + '</h2></div>' +
    '<div class="fmi-fil">' + (dois ? [['tudo', 'Tudo'], ['pessoal', 'Pessoal'], ['obra', 'Obra']].map(function(f){ return '<button type="button" class="fmi-f' + (fmiS.filtro === f[0] ? ' on' : '') + '" data-fmi="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') : '') +
    '<span class="fmi-jan">próximos ' + [7, 15, 30].map(function(n){ return '<button type="button" class="fmi-f' + (fmiS.janela === n ? ' on' : '') + '" data-fmi="janela" data-v="' + n + '">' + n + ' dias</button>'; }).join('') + '</span></div>';
  if (!itens.length) h += '<div class="fmi-vazio"><b>Tudo em dia ✓</b><br>Nada vence nos próximos ' + fmiS.janela + ' dias' + (fmiS.filtro === 'tudo' ? '.' : ' neste filtro.') + '</div>';
  else h += itens.map(function(x){ return fmiLinha(x, hoje); }).join('') + '<div class="fmi-rod"><span>' + (semana > 0 ? 'Vence nesta semana: ' + fmtMoeda(semana) : '') + (semana > 0 && atrasado > 0 ? ' · ' : '') + (atrasado > 0 ? 'Atrasado: ' + fmtMoeda(atrasado) : '') + '</span>' + (mods.indexOf('financas') >= 0 ? '<button type="button" class="btn-text" data-fmi="financas">Ver tudo em Finanças ›</button>' : '') + '</div>';
  return h + '</div>';
}
function fmiRender(){
  if (!fmiAtivo() || activeTab !== 'inicio') return;
  fmiCss();
  var corpo = qs('bodyInicio'); if (!corpo) return;
  var el = qs('fmiCentral'); if (!el){ el = document.createElement('div'); el.id = 'fmiCentral'; var s = qs('iniSauda'); if (s && s.parentNode === corpo) corpo.insertBefore(el, s.nextSibling); else corpo.appendChild(el); }
  try{ el.innerHTML = fmiHtml(); }catch(e){ console.error('início do familiar', e); el.innerHTML = '<div class="empty"><strong>Não consegui montar a central de atenção</strong>As outras telas continuam funcionando.</div>'; }
  try{ if (typeof qdSaudacao === 'function') qdSaudacao(); }catch(e){}
  try{ var n = fmiItens().filter(function(x){ return !x.entra && x.d <= todayISO(); }).length, b = qs('btBadgeInicio'); if (b) b.textContent = n > 0 ? String(n) : ''; }catch(e){}
}
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-fmi]') : null; if (!b || !fmiAtivo()) return;
  var a = b.getAttribute('data-fmi');
  if (a === 'filtro'){ fmiS.filtro = b.getAttribute('data-v'); fmiRender(); }
  else if (a === 'janela'){ fmiS.janela = Number(b.getAttribute('data-v')); fmiGuardar(); fmiRender(); }
  else if (a === 'financas'){ setActiveTab('financeiro'); }
  else if (a === 'item'){
    var t = b.getAttribute('data-fmi-tipo'), id = b.getAttribute('data-fmi-id');
    if (t === 'despesa') iniciarPagamentoDespesa(id);
    else { setActiveTab('financeiro'); irParaFinTab('pf'); }
  }
});
(function(){
  if (typeof renderPainelAtencao === 'function'){
    var oRender = renderPainelAtencao;
    renderPainelAtencao = function(){ var r = oRender.apply(this, arguments); try{ if (fmiAtivo()) fmiRender(); }catch(e){} return r; };
  }
  window.addEventListener('horus-eu', function(){ try{ if (fmiAtivo()) fmiRender(); }catch(e){} });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { fmiItens: fmiItens, fmiS: fmiS });
})();
