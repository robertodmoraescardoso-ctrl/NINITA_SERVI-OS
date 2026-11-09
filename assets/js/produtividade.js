import { fmtLongo } from "./datas.js";
import { analise, comparar, DIAS_MINIMOS_POTENCIAL, fmtRUP, jornada } from "./rup.js";
import { num, quantPrevista } from "./servicos.js";
import { esc } from "./ui.js";

/* ------------------------------------------------------------
   BLOCO "PRODUTIVIDADE (RUP)" da ficha do Acompanhamento
   RUP de cada dia medido, comparação com o dia anterior, RUP
   cumulativa e potencial, perda e projeção de término.
   As regras do cálculo estão em rup.js.
   ------------------------------------------------------------ */
function linhaProjecao(rotulo, p, s){
  if(!p) return "";
  const folga = p.folga === null ? ""
    : p.folga > 0 ? ' <span class="rup-pior">— ' + p.folga + ' dia(s) útil(eis) depois do previsto (' + fmtLongo(s.fimPrev) + ')</span>'
    : p.folga < 0 ? ' <span class="rup-melhor">— ' + (-p.folga) + ' dia(s) útil(eis) antes do previsto</span>'
    : ' — no previsto';
  return '<li><strong>' + rotulo + ':</strong> termina em <strong>' + fmtLongo(p.fim) + '</strong> (' + p.dias + ' dia(s) útil(eis), ' +
    num(p.producaoDia) + ' ' + esc(s.unidade || "") + '/dia)' + folga + '</li>';
}

export function blocoProdutividade(s){
  const un = s.unidade || "un";
  let corpo;
  if(!quantPrevista(s)){
    corpo = '<p class="dica" style="margin:0">Para medir a produtividade, informe o quantitativo previsto e a unidade no cadastro do serviço.</p>';
  } else {
    const a = analise(s);
    if(!a.dias.length){
      corpo = '<p class="dica" style="margin:0">Ainda sem dias medidos. Lance a <strong>quantidade executada</strong> e o <strong>efetivo</strong> ' +
        '(ou os colaboradores) nos apontamentos para calcular a RUP.</p>';
    } else {
      const ult = a.dias.length - 1;
      const cmp = comparar(a.dias, ult);
      corpo =
        '<div class="folha__grade rup-grade">' +
          celula("RUP do último dia", fmtRUP(a.dias[ult].rupd, un) + (cmp ? '<br>' + textoCmp(cmp) : "")) +
          celula("RUP cumulativa", fmtRUP(a.cumulativa, un)) +
          celula("RUP potencial", a.potencial ? fmtRUP(a.potencial, un) : "a partir de " + DIAS_MINIMOS_POTENCIAL + " dias medidos") +
          celula("Perda", a.perda === null ? "—" : fmtRUP(a.perda, un) +
            (a.cumulativa ? ' (' + Math.round(a.perda / a.cumulativa * 100) + '%)' : "")) +
          celula("Equipe média", num(a.equipe) + " pessoa(s)") +
          celula("Saldo a executar", num(a.saldo) + " " + esc(un)) +
        '</div>' +
        (a.saldo > 0 ? '<ul class="rup-proj">' +
          linhaProjecao("No ritmo atual (RUP cumulativa)", a.projAtual, s) +
          linhaProjecao("Na produtividade potencial", a.projPotencial, s) +
          '</ul>' : '<p class="dica">Quantidade prevista já executada.</p>') +
        '<div class="painel-tabela" style="margin:10px 0 0"><table class="tabela"><thead><tr>' +
          '<th>Dia</th><th class="num">Quantidade</th><th class="num">Pessoas</th><th class="num esconde-mob">Hh</th><th class="num">RUP do dia</th><th>x dia anterior</th>' +
        '</tr></thead><tbody>' +
        a.dias.map(function(d, i){ return { d:d, c:comparar(a.dias, i) }; }).reverse().map(function(x){
          return '<tr><td class="num">' + fmtLongo(x.d.data) + '</td><td class="num">' + num(x.d.qs) + ' ' + esc(un) + '</td>' +
            '<td class="num">' + num(x.d.pessoas) + '</td><td class="num esconde-mob">' + num(x.d.hh) + '</td>' +
            '<td class="num">' + fmtRUP(x.d.rupd, un) + '</td><td>' + (x.c ? textoCmp(x.c) : '<span class="dica">primeiro dia</span>') + '</td></tr>';
        }).join("") +
        '</tbody></table></div>' +
        '<p class="dica" style="margin:6px 0 0">RUP = homens-hora por ' + esc(un) + ' (jornada de ' + String(jornada()).replace(".", ",") +
          ' h). Menor é melhor. Metodologia: Ubiraci E. L. de Souza.</p>';
    }
  }
  return '<div class="bloco"><div class="bloco__tit"><span class="rotulo">Produtividade (RUP)</span></div>' + corpo + '</div>';
}

function celula(rot, html){
  return '<div class="dados__c"><span class="dados__r">' + rot + '</span><span class="dados__v">' + html + '</span></div>';
}

export function textoCmp(c){
  const pct = Math.round(Math.abs(c.variacao) * 100);
  if(c.situacao === "melhor") return '<span class="rup-melhor">&#9660; melhor ' + pct + '%</span>';
  if(c.situacao === "pior") return '<span class="rup-pior">&#9650; pior ' + pct + '%</span>';
  return '<span class="dica">= igual</span>';
}
