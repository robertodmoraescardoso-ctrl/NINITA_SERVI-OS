import { dataLocal, fmt, fmtLongo, hojeISO } from "./datas.js";
import { servicosFiltrados } from "./filtros.js";
import { diasAtraso, duracao, STATUS } from "./servicos.js";
import { $, esc } from "./ui.js";

/* ------------------------------------------------------------
   PAINEL — linha do tempo
   ------------------------------------------------------------ */
export function pintarLinhaTempo(){
  const lista = servicosFiltrados().filter(function(s){ return s.inicio; });
  const alvo = $("#linhaTempo");

  if(!lista.length){
    alvo.innerHTML = '<div class="vazio"><h3>Sem serviços com data de início</h3>' +
      '<p>A linha do tempo usa a data de início e a data de término prevista.</p></div>';
    return;
  }

  let min = null, max = null;
  lista.forEach(function(s){
    const i = dataLocal(s.inicio);
    const f = dataLocal(s.fimReal || s.fimPrev) || dataLocal(hojeISO());
    if(!min || i < min) min = i;
    if(!max || f > max) max = f;
  });
  const h = dataLocal(hojeISO());
  if(h < min) min = h;
  if(h > max) max = h;

  min = new Date(min.getTime()); min.setDate(min.getDate() - 2);
  max = new Date(max.getTime()); max.setDate(max.getDate() + 2);

  const total = Math.max(1, Math.round((max - min) / 86400000));
  const larguraDia = total > 120 ? 5 : total > 60 ? 9 : total > 30 ? 17 : 30;
  const largura = total * larguraDia;

  function pos(d){ return Math.round((dataLocal(d) - min) / 86400000) * larguraDia; }

  /* réguas de mês */
  let regua = "";
  const c = new Date(min.getFullYear(), min.getMonth(), 1);
  while(c <= max){
    if(c >= min){
      const x = Math.round((c - min) / 86400000) * larguraDia;
      const nome = c.toLocaleDateString("pt-BR", {month:"short", year:"2-digit"}).replace(".", "");
      regua += '<span class="marca-mes" style="left:' + x + 'px">' + nome + '</span>';
    }
    c.setMonth(c.getMonth() + 1);
  }

  const xHoje = pos(hojeISO());

  const linhas = lista.map(function(s){
    const st = STATUS[s.status] || STATUS.planejado;
    const fim = s.fimReal || s.fimPrev || hojeISO();
    const x1 = pos(s.inicio);
    const x2 = pos(fim) + larguraDia;
    const w = Math.max(larguraDia, x2 - x1);
    const dur = duracao(s);
    const atraso = diasAtraso(s);

    return '<tr data-id="' + s.id + '">' +
      '<td class="col-nome">' +
        '<strong>' + esc(s.titulo) + '</strong>' +
        '<span>' + esc(s.codigo) + " · " + st.rot + (dur !== null ? " · " + dur + " dias" : "") + '</span>' +
      '</td>' +
      '<td>' +
        '<div class="faixa-tempo" style="--passo:' + larguraDia + 'px;width:' + largura + 'px">' +
          '<div class="barra-g barra-g--' + s.status + '" style="left:' + x1 + 'px;width:' + w + 'px" ' +
            'title="' + esc(s.titulo) + ' · ' + fmtLongo(s.inicio) + ' a ' + fmtLongo(fim) + '">' +
            (w > 70 ? fmt(s.inicio) + " – " + fmt(fim) + (atraso ? "  (+" + atraso + "d)" : "") : "") +
          '</div>' +
          '<div class="hoje" style="left:' + xHoje + 'px"></div>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join("");

  alvo.innerHTML =
    '<table>' +
      '<thead><tr>' +
        '<th class="col-nome">Serviço</th>' +
        '<th><div class="gantt__cab-tempo" style="width:' + largura + 'px">' + regua + '</div></th>' +
      '</tr></thead>' +
      '<tbody>' + linhas + '</tbody>' +
    '</table>';
}
