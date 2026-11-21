/* Finanças: todos os botões no padrão de cartão do app (36 px, cantos arredondados, cor pela função; nenhum só de texto).
   Ouro = criar (Lançar receita, Nova despesa, Nova meta, Criar meta de reserva), verde = pagar/confirmar, vermelho = excluir, cinza = o resto
   (Histórico, Lançamentos, ⋯ quadrado, Cancelar, Ver composição ›, Ajustar, Pagas…). Só o visual: nada muda de lugar nem de função. */
(function(){
  var S = '#bodyFinanceiro ';
  function l(sel){ return sel.split(',').map(function(x){ return S + x.trim(); }).join(','); }
  var base = ['.btn-text', '.btn-pagas', '.md-link', '.btn-mais', '.ct-ed', '.btn-abat-lista', '.financeiro-item-actions button', '.financeiro-valor-form button', '.financeiro-secao-head > button', '.fp-vazia button', '.bolso-acoes button', '.menu-aberto button', '.fv-pat-l button', '.btn-ghost'].join(',');
  var st = document.createElement('style');
  st.textContent =
    l(base) + '{height:36px;min-height:36px;box-sizing:border-box;padding:0 12px!important;border-radius:9px!important;font-family:inherit;font-size:12px!important;font-weight:700!important;line-height:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--border)!important;background:var(--surface-2,var(--surface))!important;color:var(--ink-soft)!important;white-space:nowrap;text-decoration:none;cursor:pointer;width:auto}' +
    l('button.btn-mais, button.ct-ed') + '{width:36px;padding:0!important;font-size:16px!important}' +
    l('button.btn-pagas') + '{width:100%;justify-content:flex-start;margin-top:8px}' +
        /* verde: pagar / confirmar */
    l('button.acao-pagar') + '{background:var(--qb-verde-bg)!important;color:var(--qb-verde-fg)!important;border-color:var(--qb-verde-bd)!important}' +
    /* vermelho: excluir */
    l('button.acao-excluir, button.btn-danger-text') + '{height:36px;padding:0 12px!important;border-radius:9px!important;font-size:12px!important;font-weight:700!important;display:inline-flex;align-items:center;background:var(--qb-verm-bg)!important;color:var(--qb-verm-fg)!important;border:1px solid var(--qb-verm-bd)!important}' +
    /* ouro: criar */
    l('button[data-nova-receita], button[data-nova-despesa], button[data-nova-meta], button[data-div-criar-reserva]') + '{background:var(--qb-ouro-bg)!important;color:var(--qb-ouro-fg)!important;border-color:var(--qb-ouro-bd)!important}' +
    l('[data-nova-receita]::before, [data-nova-despesa]::before, [data-nova-meta]::before') + '{content:"+";font-size:15px;font-weight:800;margin-right:2px}' +
    /* formulários de valor: campo numa linha, botões embaixo lado a lado */
    l('.financeiro-valor-form') + '{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;margin-top:6px}' +
    l('.financeiro-valor-form input') + '{flex:1 1 100%;min-height:36px;box-sizing:border-box}' +
    l('.financeiro-valor-form button') + '{flex:1 1 0}' +
    /* Atualizar saldo + Histórico + Lançamentos continuam na mesma linha (também no celular) */
    l('.fp-acts') + '{display:flex;flex-wrap:nowrap;gap:6px}' +
    l('.fp-acts > button') + '{padding:0 10px!important;flex:0 1 auto;min-width:0}' +
    l('.financeiro-item:has(.financeiro-valor-form)') + '{flex-wrap:wrap}' +
    l('.financeiro-item-right:has(.financeiro-valor-form)') + '{flex:1 1 100%;width:100%;align-items:stretch}' +
    l('.financeiro-item-actions') + '{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}';
  document.head.appendChild(st);
})();
