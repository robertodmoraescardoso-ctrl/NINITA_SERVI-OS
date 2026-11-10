import { $, esc } from "../ui.js";
import { est, ROTULO, chavePlanta, m2Executado, nf, percentual, status, temArea, visiveis } from "./modelo.js";

/* ------------------------------------------------------------
   VISTAS — a planta de 1ª fiada e o mosaico

   Planta: a prancha da Tecomat como imagem, com um alvo de toque
   sobre cada código PRxxx/SHxxx impresso no desenho. As posições
   vêm em fração da página (0 a 1), então valem em qualquer zoom
   e em qualquer tamanho de tela — é por isso que o alvo é
   posicionado em % e não em pixel.

   Mosaico: uma peça por parede, largura proporcional à área de
   projeto, para varrer o pavimento sem procurar na planta.
   ------------------------------------------------------------ */

const COR  = { ok:"var(--alv-ok)", andamento:"var(--alv-andamento)", atraso:"var(--alv-atraso)",
               zero:"var(--alv-zero)", semquant:"var(--alv-semquant)" };
const TINTA = { ok:"var(--alv-ok-t)", andamento:"var(--alv-andamento-t)", atraso:"var(--alv-atraso-t)",
                zero:"var(--alv-zero-t)", semquant:"var(--alv-semquant-t)" };

/* ============================================================
   PLANTA
   ============================================================ */

export function desenharPlanta(){
  const pav = est.pav;
  const chave = chavePlanta(pav);
  const g = chave && est.plantas[chave];
  const alvo = $("#alvPlanta");
  if(!alvo) return;

  if(!g){
    alvo.innerHTML = '<div class="vazio">Sem planta de 1ª fiada publicada para este pavimento.</div>';
    est.plantaDe = null;
    return;
  }

  /* só remonta quando muda de pavimento: remontar a cada
     repintura perderia a posição de rolagem e o zoom */
  if(est.plantaDe !== pav){
    est.plantaDe = pav;
    const usadas = g.marcas.filter(function(m){ return est.porId[pav + "__" + m[0]]; });
    alvo.innerHTML =
      '<div class="alv-planta">' +
        '<div class="alv-zoom">' +
          '<button type="button" data-zoom="menos" aria-label="Afastar">−</button>' +
          '<button type="button" data-zoom="mais" aria-label="Aproximar">+</button>' +
          '<button type="button" data-zoom="tudo" class="alv-largo">Tudo</button>' +
          '<span class="alv-prancha">' + esc(g.prancha) + '</span>' +
        '</div>' +
        '<div class="alv-scroll" id="alvScroll">' +
          '<div class="alv-tela" id="alvTela">' +
            '<img src="' + esc(g.imagem) + '" width="' + g.w + '" height="' + g.h + '" ' +
                 'alt="Planta de 1ª fiada — ' + esc(est.pavPorCodigo[pav].n) + '" decoding="async">' +
            usadas.map(function(m){
              return '<button type="button" class="alv-pino" data-peca="' + pav + '__' + m[0] + '" ' +
                     'style="left:' + (m[1]*100).toFixed(3) + '%;top:' + (m[2]*100).toFixed(3) + '%" ' +
                     'aria-label="' + esc(m[0]) + '">' +
                     '<span class="alv-rot">' + esc(m[0]) + '</span></button>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="alv-nota">' + usadas.length + ' marcações sobre a planta. ' +
          'Toque numa parede para apontar, ou use a busca para ir direto a ela.</div>' +
      '</div>';
    observarLargura();
    const img = $("#alvTela img");
    if(img && !img.complete) img.addEventListener("load", aplicarZoom, { once:true });
  }
  /* Fora do bloco de remontagem de propósito: a planta é montada
     atrás da tela de login, quando o container ainda tem largura
     zero, e só esta chamada — que roda a cada repintura — garante
     o zoom certo quando a página enfim aparece. */
  aplicarZoom();
  pintarPinos();
}

/* Recalcula o zoom sempre que o container muda de largura: ao sair
   do login, ao girar o aparelho, ao abrir a barra do navegador no
   celular. Mexemos na largura do filho, nunca na do container, então
   isto não entra em laço. */
let observador = null;
function observarLargura(){
  if(typeof ResizeObserver === "undefined") return;
  const sc = $("#alvScroll");
  if(!sc) return;
  if(observador) observador.disconnect();
  let ultima = 0;
  observador = new ResizeObserver(function(){
    const l = sc.clientWidth;
    if(l >= 50 && Math.abs(l - ultima) > 1){ ultima = l; aplicarZoom(); }
  });
  observador.observe(sc);
}

export function aplicarZoom(){
  const sc = $("#alvScroll"), tela = $("#alvTela");
  if(!sc || !tela) return;
  /* Enquanto a tela de login cobre a página o container ainda não
     tem largura. Medir aqui daria uma planta de 4px: melhor não
     mexer e deixar o observador abaixo chamar de novo. */
  if(sc.clientWidth < 50) return;
  tela.style.width = Math.round(sc.clientWidth * est.zoom) + "px";
  /* o pino cresce com o zoom, mas nunca vira um borrão nem some */
  tela.style.setProperty("--alv-pino-d", Math.max(9, Math.min(26, Math.round(6*est.zoom + 5))) + "px");
  tela.classList.toggle("rotulada", est.zoom >= 2.6);
}

export function mudarZoom(z){
  const sc = $("#alvScroll"), tela = $("#alvTela");
  if(!sc || !tela) return;
  const larguraAntes = tela.offsetWidth || 1, alturaAntes = tela.offsetHeight || 1;
  const cx = (sc.scrollLeft + sc.clientWidth/2) / larguraAntes;
  const cy = (sc.scrollTop + sc.clientHeight/2) / alturaAntes;
  est.zoom = Math.max(1, Math.min(14, z));
  aplicarZoom();
  sc.scrollLeft = cx * tela.offsetWidth  - sc.clientWidth/2;
  sc.scrollTop  = cy * tela.offsetHeight - sc.clientHeight/2;
}

export function pintarPinos(){
  const tela = $("#alvTela");
  if(!tela) return;
  const vis = {};
  visiveis().forEach(function(w){ vis[w.id] = true; });
  const filtrando = est.filtro !== "todas" || !!est.busca.trim();
  Array.prototype.forEach.call(tela.querySelectorAll(".alv-pino"), function(b){
    const w = est.porId[b.dataset.peca];
    if(!w) return;
    const s = status(w);
    b.className = "alv-pino " + s + (filtrando && !vis[w.id] ? " apagado" : "");
    b.title = w.codigo + " · " + ROTULO[s] + " · " + percentual(w) + "%";
  });
}

/* leva a planta até a parede e a destaca */
export function irAtePeca(codigo){
  const sc = $("#alvScroll"), tela = $("#alvTela");
  const g = est.plantas[chavePlanta(est.pav)];
  if(!sc || !tela || !g) return;
  const m = g.marcas.find(function(x){ return x[0] === codigo; });
  if(!m) return;
  if(est.zoom < 3) mudarZoom(4);
  const esq = m[1]*tela.offsetWidth  - sc.clientWidth/2;
  const topo = m[2]*tela.offsetHeight - sc.clientHeight/2;
  if(sc.scrollTo) sc.scrollTo({ left: esq, top: topo, behavior: "smooth" });
  else { sc.scrollLeft = esq; sc.scrollTop = topo; }
  Array.prototype.forEach.call(tela.querySelectorAll(".alv-pino.alvo"), function(b){ b.classList.remove("alvo"); });
  Array.prototype.forEach.call(tela.querySelectorAll('.alv-pino[data-peca="' + est.pav + "__" + codigo + '"]'),
    function(b){ b.classList.add("alvo"); });
}

/* ============================================================
   MOSAICO
   ============================================================ */

/* largura em colunas: a área de projeto vira peso visual */
function colunas(w){
  if(!temArea(w)) return 2;
  const a = w.area;
  return a < 1 ? 1 : a < 3 ? 2 : a < 7 ? 3 : a < 14 ? 4 : 5;
}

function peca(w){
  const p = percentual(w), s = status(w), pl = est.plano[w.id];
  const marcas = [];
  if(w.avisos) marcas.push('<span class="alv-bloco__alerta" aria-hidden="true">!</span>');
  if(pl && pl.responsavel){
    const iniciais = pl.responsavel.trim().split(/\s+/).map(function(x){ return x[0]; }).join("").slice(0,2).toUpperCase();
    marcas.push("<b>" + esc(iniciais) + "</b>");
  }
  return '<button type="button" class="alv-bloco ' + s + '" data-peca="' + w.id + '" ' +
      'style="grid-column:span ' + colunas(w) + '" ' +
      'aria-label="' + esc(w.codigo + ", " + ROTULO[s] + ", " + p + "%") + '">' +
      '<span class="alv-bloco__fiada' + (p === 0 ? " vazia" : "") + '" ' +
        'style="height:' + p + '%;--alv-c:' + COR[s] + ';--alv-t:' + TINTA[s] + '"></span>' +
      (marcas.length ? '<span class="alv-bloco__marca">' + marcas.join("") + "</span>" : "") +
      '<span class="alv-bloco__cod">' + esc(w.codigo) + '</span>' +
      '<span class="alv-bloco__m2">' +
        (temArea(w) ? nf(w.area, 1) + " m²" : (w.area === 0 ? "s/ vedação" : "s/ quant.")) + '</span>' +
      (p > 0 ? '<span class="alv-bloco__pc">' + p + "%</span>" : "") +
    "</button>";
}

export function desenharMosaico(){
  const alvo = $("#alvMosaico");
  if(!alvo) return;
  const lista = visiveis();
  if(!lista.length){
    alvo.innerHTML = '<div class="vazio">Nenhuma parede com esse filtro.</div>';
    return;
  }
  const paredes = lista.filter(function(w){ return w.tipo === "p"; });
  const shafts  = lista.filter(function(w){ return w.tipo === "s"; });

  function secao(titulo, arr){
    if(!arr.length) return "";
    const prev = arr.reduce(function(s,w){ return s + (temArea(w) ? w.area : 0); }, 0);
    const feito = arr.reduce(function(s,w){ return s + m2Executado(w); }, 0);
    return '<div class="alv-secao"><div class="alv-secao__cab"><h3>' + titulo + "</h3>" +
      "<span>" + arr.length + (prev > 0 ? " · " + nf(feito,0) + "/" + nf(prev,0) + " m²" : "") + "</span></div>" +
      '<div class="alv-mosaico">' + arr.map(peca).join("") + "</div></div>";
  }
  alvo.innerHTML = secao("Paredes", paredes) + secao("Shafts", shafts);
}
