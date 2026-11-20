/* PADRÃO — todo botão de ação é um cartão (20/11, decisão do proprietário; vale para o app inteiro e para tudo que for criado daqui para frente).
   Cartão = 36 px de altura, cantos de 9 px, texto de 12 px em negrito, uma linha só (sem quebra), nunca maior que o cartão que o contém.
   Cor pela função: ouro = criar (Adicionar, Novo, Lançar, Cadastrar); verde = pagar / registrar entrada / confirmar; vermelho = excluir; cinza = o resto
   (Editar, Anexar, Ver, links "ver … ›"). Editar e Excluir que vêm em fila com outros botões (Construção) viram quadrados de 36 px com ícone.
   As classes antigas de "botão só de texto" (btn-text, md-link, es-lk) já nascem como cartão; as linhas clicáveis dos resumos (md-fase, md-at) também.
   Botão novo: use `class="btn btn-ghost"` (ou btn-text/md-link, que agora são cartão). Nunca crie um botão com fundo e borda transparentes.
   Teste que impede o erro de voltar: test/botoes-guarda.test.mjs. */
(function(){
  var st = document.createElement('style');
  var T = 'button.btn-text,button.md-link,button.es-lk,button.btn-pagas';
  st.textContent =
    ':root{--bp-ouro-bg:rgba(201,133,0,.17);--bp-ouro-fg:#7A4E00;--bp-ouro-bd:rgba(201,133,0,.42);--bp-verde-bg:rgba(23,137,90,.14);--bp-verde-fg:#0F6B46;--bp-verde-bd:rgba(23,137,90,.38);--bp-verm-bg:rgba(217,59,59,.10);--bp-verm-fg:#B42323;--bp-verm-bd:rgba(217,59,59,.32)}' +
    ':root[data-theme="dark"]{--bp-ouro-bg:rgba(242,176,30,.18);--bp-ouro-fg:#F2C260;--bp-ouro-bd:rgba(242,176,30,.45);--bp-verde-bg:rgba(34,197,94,.16);--bp-verde-fg:#6FDBA8;--bp-verde-bd:rgba(34,197,94,.42);--bp-verm-bg:rgba(239,68,68,.16);--bp-verm-fg:#FCA5A5;--bp-verm-bd:rgba(239,68,68,.4)}' +
    T + '{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;min-height:36px;box-sizing:border-box;padding:0 12px!important;border-radius:9px!important;font-family:inherit;font-size:12px!important;font-weight:700!important;line-height:1;white-space:nowrap;background:var(--surface-2)!important;color:var(--ink)!important;border:1px solid var(--border)!important;cursor:pointer;width:auto;max-width:100%;flex:0 0 auto;text-decoration:none}' +
    T.split(',').map(function(x){ return x + ':hover'; }).join(',') + '{border-color:var(--ink-soft)!important}' +
    'button.bp-ouro{background:var(--bp-ouro-bg)!important;color:var(--bp-ouro-fg)!important;border-color:var(--bp-ouro-bd)!important}' +
    'button.bp-verde{background:var(--bp-verde-bg)!important;color:var(--bp-verde-fg)!important;border-color:var(--bp-verde-bd)!important}' +
    'button.bp-verm{background:var(--bp-verm-bg)!important;color:var(--bp-verm-fg)!important;border-color:var(--bp-verm-bd)!important}' +
    'button.bp-quad{width:36px;min-width:36px;padding:0!important}button.bp-quad svg{width:16px;height:16px}' +
    /* linhas de ações: uma linha só, alinhadas à direita, sem passar do cartão (só quebram em tela muito estreita) */
    '#bodyObra .ob-etapa-acoes,#bodyObra .ob-gasto-val>span,#bodyObra .ob-mo-acoes,#bodyObra .ob-edit{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;min-width:0}' +
    '#bodyObra .ob-gasto-val>span,#bodyObra .ob-edit{justify-content:flex-end}#bodyObra .ob-gasto-val{min-width:0;max-width:100%}' +
    '@media (max-width:340px){#bodyObra .ob-etapa-acoes,#bodyObra .ob-gasto-val>span{flex-wrap:wrap}}' +
    /* linhas clicáveis dos resumos viram cartão cinza com a seta ›, em todas as abas */
    '.md-fase{grid-template-columns:minmax(0,1.3fr) minmax(40px,1fr) auto 12px!important;background:var(--surface-2)!important;border:1px solid var(--border)!important;margin:4px 0!important;padding:8px 10px!important;box-sizing:border-box!important;border-radius:10px!important}' +
    'button.md-at,button.md-at:first-of-type{background:var(--surface-2)!important;border:1px solid var(--border)!important;border-radius:10px!important;padding:8px 10px!important;margin:4px 0;box-sizing:border-box}' +
    '.md-fase::after,button.md-at::after{content:"›";color:var(--ink-soft);font-weight:800;flex:none;margin-left:2px}' +
    '.md-fase:hover,button.md-at:hover{border-color:var(--ink-soft)!important}';
  document.head.appendChild(st);

  var PAPEIS = [[/^(excluir|remover|apagar|descartar|desfazer tudo)/i, 'verm'], [/^(adicionar|nov[oa]\b|lan[çc]ar|cadastrar|criar|\+)/i, 'ouro'], [/^(pagar|registrar (pagamento|libera[çc][ãa]o|repasse|recebimento)|marcar (como )?recebid|confirmar|vincular)/i, 'verde']];
  function classificar(b){
    if (b.getAttribute('data-bp')) return;
    var t = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(), papel = '';
    if (b.classList.contains('acao-excluir') || b.classList.contains('btn-danger-text')) papel = 'verm';
    else if (b.classList.contains('acao-pagar')) papel = 'verde';
    else for (var i = 0; i < PAPEIS.length; i++) if (PAPEIS[i][0].test(t)){ papel = PAPEIS[i][1]; break; }
    b.setAttribute('data-bp', papel || 'cinza');
    if (papel) b.classList.add('bp-' + papel);
    /* Construção: Editar e Excluir em fila com outros botões viram quadrados com ícone */
    if (b.closest && b.closest('#bodyObra') && (t === 'Editar' || t === 'Excluir') && typeof ico === 'function'){
      b.classList.add('bp-quad'); b.setAttribute('aria-label', t); b.setAttribute('title', t); b.innerHTML = ico(t === 'Editar' ? 'pencil' : 'trash-2', 16);
    }
  }
  var SEL = 'button.btn-text:not([data-bp]),button.md-link:not([data-bp]),button.es-lk:not([data-bp]),button.btn-pagas:not([data-bp])', timer = null;
  function varrer(){ timer = null; try{ Array.prototype.forEach.call(document.querySelectorAll(SEL), classificar); }catch(e){ console.error('botões', e); } }
  function agendar(){ if (!timer) timer = setTimeout(varrer, 20); }
  try{ new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true }); }catch(e){}
  varrer();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { bpVarrer: varrer });
})();
