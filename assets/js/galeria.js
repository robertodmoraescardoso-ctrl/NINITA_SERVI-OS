import { estado } from "./estado.js";
import { srcFoto } from "./fotos.js";
import { fotosDo } from "./servicos.js";
import { $, esc } from "./ui.js";

/* ------------------------------------------------------------
   VISUALIZADOR DE FOTOS
   ------------------------------------------------------------ */
export let galeria = { fotos:[], i:0, titulo:"" };

export function abrirFoto(idFoto, idServico){
  const s = estado.servicos.find(function(x){ return x.id === idServico; });
  galeria.fotos = s ? fotosDo(s) : [idFoto];
  galeria.i = Math.max(0, galeria.fotos.indexOf(idFoto));
  galeria.titulo = s ? s.titulo : "";
  pintarLightbox();
}

export function pintarLightbox(){
  const titulo = galeria.titulo;
  const f = galeria.fotos[galeria.i];
  $("#modais").innerHTML =
  '<div class="lightbox" id="lightbox">' +
    '<img src="' + srcFoto(f) + '" alt="Registro fotográfico do serviço">' +
    '<div class="lightbox__barra">' +
      '<button class="btn btn--claro" data-nav="-1">&larr;</button>' +
      '<span>' + esc(titulo) + ' &nbsp;·&nbsp; ' + (galeria.i + 1) + ' de ' + galeria.fotos.length + '</span>' +
      '<button class="btn btn--claro" data-nav="1">&rarr;</button>' +
      '<a class="btn btn--claro" href="' + srcFoto(f) + '" download="foto-obra.jpg">Baixar</a>' +
      '<button class="btn btn--claro" data-fechar>Fechar</button>' +
    '</div>' +
  '</div>';
}
