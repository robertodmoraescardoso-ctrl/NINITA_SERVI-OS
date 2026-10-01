import { estado } from "./estado.js";
import { BUCKET, idsFotosAtuais, salvar, sb } from "./supabase.js";
import { id } from "./ui.js";

/* ------------------------------------------------------------
   FOTOS
   Sobem comprimidas para o depósito do Supabase. A exibição usa
   link assinado com validade de 8 horas, então a foto não fica
   exposta em endereço público.
   ------------------------------------------------------------ */
export const LADO_MAX = 1400;
export const QUALIDADE = 0.72;
export const VALIDADE_LINK = 28800; /* 8 horas */

export function comprimir(arquivo){
  return new Promise(function(ok){
    const leitor = new FileReader();
    leitor.onload = function(){
      const img = new Image();
      img.onload = function(){
        let l = img.width, a = img.height;
        if(l > LADO_MAX || a > LADO_MAX){
          const f = Math.min(LADO_MAX / l, LADO_MAX / a);
          l = Math.round(l * f); a = Math.round(a * f);
        }
        const cv = document.createElement("canvas");
        cv.width = l; cv.height = a;
        cv.getContext("2d").drawImage(img, 0, 0, l, a);
        cv.toBlob(function(blob){ ok(blob || arquivo); }, "image/jpeg", QUALIDADE);
      };
      img.onerror = function(){ ok(arquivo); };
      img.src = leitor.result;
    };
    leitor.onerror = function(){ ok(arquivo); };
    leitor.readAsDataURL(arquivo);
  });
}

export async function guardarFoto(arquivo){
  const blob = await comprimir(arquivo);
  const registro = { id:id(), blob:blob, nome:arquivo.name || "foto.jpg", em:new Date().toISOString() };
  await salvar("fotos", registro);
  /* a prévia usa o arquivo que já está na memória: aparece na hora */
  estado.urls.set(registro.id, URL.createObjectURL(blob));
  return registro.id;
}

export async function urlFoto(idFoto){
  if(estado.urls.has(idFoto)) return estado.urls.get(idFoto);
  const r = await sb.storage.from(BUCKET).createSignedUrl(idFoto + ".jpg", VALIDADE_LINK);
  if(!r.data || !r.data.signedUrl) return null;
  estado.urls.set(idFoto, r.data.signedUrl);
  return r.data.signedUrl;
}

/* pede os links de todas as fotos de uma vez, em lotes */
export async function prepararFotos(){
  const faltando = idsFotosAtuais().filter(function(f){ return !estado.urls.has(f); });
  if(!faltando.length) return;
  for(let i = 0; i < faltando.length; i += 100){
    const lote = faltando.slice(i, i + 100);
    const r = await sb.storage.from(BUCKET)
      .createSignedUrls(lote.map(function(f){ return f + ".jpg"; }), VALIDADE_LINK);
    (r.data || []).forEach(function(item){
      if(item && item.signedUrl && item.path){
        estado.urls.set(String(item.path).replace(/\.jpg$/, ""), item.signedUrl);
      }
    });
  }
}

export function srcFoto(idFoto){ return estado.urls.get(idFoto) || ""; }
