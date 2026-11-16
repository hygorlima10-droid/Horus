/* ============================================================
   QUADROS E BOAS-VINDAS (prefixo qd)
   - Início: frase de boas-vindas com o primeiro nome (bom dia / boa tarde / boa noite, horário de Brasília).
   - Quadros (kanban) no computador: colunas de no mínimo 236 px, moldura e cartões compactos, ícone dentro da linha do nome.
   - Iniciais e Alvarás: "Editar colunas" na mesma linha da busca; coluna sem cartões vira uma faixa estreita (abre ao arrastar um cartão);
     botão "Ampliar quadro" (menu lateral só com ícones; a escolha fica salva neste computador).
   ============================================================ */
var QD_AMPLO = 'horus.quadroAmplo';
function qdPeriodo(h){ return h >= 5 && h < 12 ? ['Bom dia', 'sun', '#C98500'] : (h >= 12 && h < 18 ? ['Boa tarde', 'sunset', '#E07B2A'] : ['Boa noite', 'moon', '#4453D6']); }
var QD_SVG = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  sunset: '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
};
/* primeiro nome de quem está logado; o proprietário que entra só com a senha (sem usuário cadastrado) é o Hygor */
function qdNome(){
  var e = (typeof esS !== 'undefined' && esS.eu) ? esS.eu : (window.__horusEu || null); if (!e) return '';
  var n = String(e.nome || '').trim().split(/\s+/)[0];
  return n || (e.papel === 'proprietario' ? 'Hygor' : '');
}
function qdSaudacao(){
  var el = document.getElementById('iniSauda'); if (!el) return;
  var agora = new Date(Date.now() - 3 * 3600e3), p = qdPeriodo(agora.getUTCHours()), nome = qdNome();
  var data = ''; try{ data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }); }catch(x){}
  var h = '<span class="is-ic" style="background:' + p[2] + '1f;color:' + p[2] + '"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + QD_SVG[p[1]] + '</svg></span><div><h2 class="is-t">' + p[0] + (nome ? ', ' + escapeHtml(nome) : '') + '</h2><small>' + escapeHtml(data) + '</small></div>';
  if (el.getAttribute('data-h') !== h){ el.innerHTML = h; el.setAttribute('data-h', h); }
}
/* Iniciais e Alvarás: a coluna sem cartões vira faixa estreita (o nome na vertical + contador) */
function qdTrilhos(){
  ['kanbanPeticoes', 'kanbanAlvaras'].forEach(function(id){
    var w = document.getElementById(id); if (!w) return;
    Array.prototype.forEach.call(w.querySelectorAll('.kanban-col'), function(c){
      var vazia = !c.querySelector('.kanban-card'); c.classList.toggle('q-vazia', vazia);
      if (!vazia) return;
      var h = c.querySelector('h4'); if (!h || h.querySelector('.q-rot')) return;
      Array.prototype.forEach.call(h.childNodes, function(n){ if (n.nodeType === 3 && n.textContent.trim()){ var sp = document.createElement('span'); sp.className = 'q-rot'; sp.textContent = n.textContent.trim(); h.replaceChild(sp, n); } });
    });
  });
}
function qdAmploLer(){ try{ return localStorage.getItem(QD_AMPLO) === '1'; }catch(e){ return false; } }
function qdAmploAplicar(){
  var on = qdAmploLer(); document.body.classList.toggle('q-amplo', on);
  Array.prototype.forEach.call(document.querySelectorAll('.q-amplo-btn'), function(b){ b.textContent = on ? '⤢ Restaurar menu' : '⤢ Ampliar quadro'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = on ? 'Voltar o menu lateral ao tamanho normal' : 'Esconder os nomes do menu lateral para o quadro ficar mais largo'; });
}
/* "Editar colunas" sobe para a linha da busca e entra o botão "Ampliar quadro" (uma vez só: o cabeçalho é fixo) */
function qdBarra(){
  [['headPeticoes', 'editarColunasPeticao'], ['headAlvaras', 'editarColunasAlvara']].forEach(function(p){
    var hd = document.getElementById(p[0]); if (!hd) return; var fil = hd.querySelector('.filters'), ed = document.getElementById(p[1]); if (!fil) return;
    if (ed && ed.parentNode !== fil) fil.appendChild(ed);
    if (!fil.querySelector('.q-amplo-btn')){ var b = document.createElement('button'); b.type = 'button'; b.className = 'fb q-amplo-btn'; fil.appendChild(b); }
  });
  qdAmploAplicar();
}
function qdCss(){
  if (document.getElementById('qdCss')) return;
  var st = document.createElement('style'); st.id = 'qdCss';
  st.textContent =
    '.ini-sauda{display:flex;align-items:center;gap:12px;padding:14px 2px 2px}.ini-sauda:empty{display:none}.ini-sauda .is-ic{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex:none}.ini-sauda .is-t{margin:0;font-family:var(--font-display);font-size:24px;line-height:1.15;letter-spacing:-.01em}.ini-sauda small{color:var(--ink-soft);font-size:var(--t3)}' +
    '@media(max-width:999px){.ini-sauda{padding:10px 2px 0}.ini-sauda .is-ic{width:36px;height:36px;border-radius:11px}.ini-sauda .is-t{font-size:20px}}' +
    /* quadros no computador */
    '@media(min-width:1000px){' +
    '.kanban-wrap{gap:10px}#kanbanPeticoes .kanban-col:not(.q-vazia),#kanbanAlvaras .kanban-col:not(.q-vazia){flex:1 1 0;min-width:236px}.kanban-wrap .kanban-col{padding:10px;gap:8px}' +
    '.kanban-col-head h4{font-size:14px;line-height:1.25;align-items:flex-start;gap:6px;margin:0 0 2px}.kanban-col-head h4 .fv-chip{margin-left:auto;flex:none}.kanban-col-head h4 .ct-ic{width:22px;height:22px;flex:none}.kanban-col-head h4 .ct-ic svg{width:13px;height:13px}' +
    '.kanban-card{padding:10px 11px;border-radius:14px}.kanban-card .kc-top{gap:7px;align-items:flex-start}.kanban-card .kc-top .ct-ic{width:20px;height:20px;margin-top:1px;flex:none}.kanban-card .kc-top .ct-ic svg{width:12px;height:12px}' +
    '.kanban-card .kc-nome{font-size:13.5px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.kanban-card .kc-sub{font-size:11.5px;line-height:1.3;overflow-wrap:anywhere}' +
    '.kanban-card .kc-chips{margin-top:6px;gap:3px}.kanban-card .kc-chips .fv-chip{font-size:10.5px;padding:1px 7px}.kanban-card .kc-valor{font-size:15px;margin-top:6px}.kanban-card .kc-acoes{margin-top:8px;gap:6px}.kanban-card .kc-acoes select{max-width:100%}' +
    /* coluna vazia em faixa (Iniciais e Alvarás) */
    '.kanban-wrap .kanban-col.q-vazia{flex:0 0 52px;min-width:52px;padding:10px 0;align-items:center;gap:10px}.kanban-col.q-vazia .kc-soma,.kanban-col.q-vazia .kanban-vazio{display:none}.kanban-col.q-vazia h4{flex-direction:column;align-items:center;gap:8px;margin:0}.kanban-col.q-vazia h4 .fv-chip{margin:0}.kanban-col.q-vazia .q-rot{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:13px}' +
    /* ao arrastar um cartão para a faixa, ela abre */
    '.kanban-wrap .kanban-col.q-vazia.drag-over{flex:0 0 236px;min-width:236px;padding:10px;align-items:stretch}.kanban-col.q-vazia.drag-over .kc-soma,.kanban-col.q-vazia.drag-over .kanban-vazio{display:block}.kanban-col.q-vazia.drag-over h4{flex-direction:row;align-items:flex-start;gap:6px}.kanban-col.q-vazia.drag-over h4 .fv-chip{margin-left:auto}.kanban-col.q-vazia.drag-over .q-rot{writing-mode:horizontal-tb;transform:none;white-space:normal}' +
    /* barra numa linha: "Editar colunas" junto da busca; a barra antiga fica vazia */
    '#headPeticoes .alvara-view-bar,#headAlvaras .alvara-view-bar{display:none!important}[data-md="lista"] #editarColunasPeticao,[data-md="lista"] #editarColunasAlvara{display:none!important}#editarColunasPeticao,#editarColunasAlvara{white-space:nowrap;margin-left:auto}' +
    '.q-amplo-btn{white-space:nowrap}' +
    /* Ampliar quadro: menu lateral só com ícones nas telas de Iniciais e Alvarás; passando o mouse ele abre por cima */
    'body.q-amplo[data-tab="peticoes"] .main,body.q-amplo[data-tab="alvaras"] .main{margin-left:68px}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover),body.q-amplo[data-tab="alvaras"] .drawer:not(:hover){width:68px}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:hover,body.q-amplo[data-tab="alvaras"] .drawer:hover{box-shadow:var(--shadow)}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) :is(.dr-name,.lab),body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) :is(.dr-name,.lab){display:none}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) .dr-grp,body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) .dr-grp{height:1px;margin:10px 14px;padding:0;background:var(--border);font-size:0;overflow:hidden}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) .dr-n,body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) .dr-n{position:absolute;left:28px;top:3px;margin:0;padding:0 5px;font-size:var(--t1);white-space:nowrap}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) .dr-n:not(.red),body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) .dr-n:not(.red){display:none}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) .dr-foot,body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) .dr-foot{flex-direction:column}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) .dr-mini,body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) .dr-mini{padding:9px 0;gap:0;flex:none;width:40px;margin:0 auto}' +
    'body.q-amplo[data-tab="peticoes"] .drawer:not(:hover) .dr-mini .lab,body.q-amplo[data-tab="alvaras"] .drawer:not(:hover) .dr-mini .lab{display:none}' +
    '}' +
    '@media(max-width:999px){.q-amplo-btn{display:none!important}}';
  document.head.appendChild(st);
}
function qdIniciar(){
  qdCss(); qdBarra(); qdTrilhos(); qdSaudacao();
  ['kanbanPeticoes', 'kanbanAlvaras'].forEach(function(id){ var w = document.getElementById(id); if (w && window.MutationObserver) new MutationObserver(function(){ qdTrilhos(); }).observe(w, { childList: true }); });
  document.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('.q-amplo-btn') : null; if (!b) return; try{ localStorage.setItem(QD_AMPLO, qdAmploLer() ? '0' : '1'); }catch(x){} qdAmploAplicar(); });
  window.addEventListener('horus-eu', qdSaudacao);
  setInterval(qdSaudacao, 30000); setTimeout(qdSaudacao, 1500); setTimeout(qdSaudacao, 4500);
}
qdIniciar();
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { qdPeriodo: qdPeriodo, qdNome: qdNome, qdSaudacao: qdSaudacao }); })();
