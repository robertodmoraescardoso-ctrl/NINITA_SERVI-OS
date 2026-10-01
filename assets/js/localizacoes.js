import { estado } from "./estado.js";
import { sb } from "./supabase.js";

/* ------------------------------------------------------------
   LOCALIZAÇÕES — frente > pavimento > ambiente/unidade
   Tabelas: localizacoes e servico_localizacoes
   (migracoes/002_localizacoes.sql).
   Um serviço pode estar ligado a vários pavimentos (alvenaria do
   1º ao 4º = quatro ligações). Nada é apagado de verdade: desfazer
   uma ligação ou desativar um local só preenche excluido_em.
   ------------------------------------------------------------ */

export const NIVEL = { FRENTE:1, PAVIMENTO:2, AMBIENTE:3 };

/* Lê a árvore e as ligações. Se as tabelas ainda não existirem
   (migração não rodada), a localização fica desligada e o resto
   do sistema segue normal. */
export async function carregarLocalizacoes(){
  estado.locAtivo = false;
  estado.locErro = "";
  estado.localizacoes = [];
  estado.ligacoes = new Map();
  try{
    const r1 = await sb.from("localizacoes").select("*").is("excluido_em", null)
      .order("nivel", {ascending:true}).order("ordem", {ascending:true});
    if(r1.error) throw r1.error;
    const r2 = await sb.from("servico_localizacoes").select("servico_id,localizacao_id").is("excluido_em", null);
    if(r2.error) throw r2.error;
    estado.localizacoes = r1.data || [];
    (r2.data || []).forEach(function(l){
      if(!estado.ligacoes.has(l.servico_id)) estado.ligacoes.set(l.servico_id, new Set());
      estado.ligacoes.get(l.servico_id).add(l.localizacao_id);
    });
    estado.locAtivo = true;
  } catch(e){
    const t = String((e && e.message) || e);
    estado.locErro = /does not exist|schema cache|relation/i.test(t)
      ? "A localização por frente e pavimento ainda não está ligada: falta rodar o arquivo migracoes/002_localizacoes.sql no Supabase (instruções no README)."
      : "Não foi possível carregar as localizações: " + t;
  }
}

/* ---------- consulta à árvore ---------- */
export function local(id){
  return estado.localizacoes.find(function(l){ return l.id === id; }) || null;
}
export function filhos(paiId){
  return estado.localizacoes
    .filter(function(l){ return (l.pai_id || null) === (paiId || null); })
    .sort(function(a,b){ return (a.ordem - b.ordem) || a.nome.localeCompare(b.nome, "pt-BR", {numeric:true}); });
}
export function frentes(){ return filhos(null); }

/* o próprio local e tudo o que está abaixo dele */
export function comDescendentes(id){
  const out = new Set([id]);
  let fila = [id];
  while(fila.length){
    const prox = [];
    fila.forEach(function(p){ filhos(p).forEach(function(f){ out.add(f.id); prox.push(f.id); }); });
    fila = prox;
  }
  return out;
}

/* frente a que um local pertence (sobe a árvore) */
export function frenteDe(id){
  let l = local(id);
  while(l && l.pai_id) l = local(l.pai_id);
  return l;
}

/* ---------- serviço x localização ---------- */
export function ligacoesDe(servicoId){
  const s = estado.ligacoes.get(servicoId);
  if(!s) return [];
  return Array.from(s).filter(function(id){ return !!local(id); });   /* ignora locais desativados */
}
export function semLocalizacao(servicoId){
  return estado.locAtivo && ligacoesDe(servicoId).length === 0;
}
export function servicoEm(servicoId, localId){
  const alvo = comDescendentes(localId);
  return ligacoesDe(servicoId).some(function(id){ return alvo.has(id); });
}

/* tipo do item no nível de pavimento: "pav" (1º pavimento), "teto" (1º teto) ou outro */
function tipo(nome){
  if(/^\d+\s*[º°o]?\s*pav/i.test(nome)) return "pav";
  if(/^\d+\s*[º°o]?\s*teto/i.test(nome)) return "teto";
  return "";
}
/* "3º pavimento" / "3º teto" -> "3º"; outros nomes ficam como estão */
function curto(nome){
  const m = /^(\d+)/.exec(nome);
  return tipo(nome) && m ? m[1] + "º" : nome;
}
function numerado(nome){ return tipo(nome) === "pav"; }

/* rótulo curto para botões: "3º pavimento" -> "3º pav" ("3º teto" fica igual) */
export function nomeCurto(nome){ return numerado(nome) ? curto(nome) + " pav" : nome; }

/* Junta itens consecutivos do mesmo tipo em faixas:
   [1º,2º,3º,4º,6º pav] -> "1º a 4º, 6º pav"; [2º,3º teto] -> "2º, 3º teto".
   Pavimentos e tetos são contados separadamente (ficam intercalados na lista). */
function faixas(lista){
  if(!lista.length) return "";
  const todos = filhos(lista[0].pai_id);
  const porTipo = new Map();
  lista.forEach(function(l){ const k = tipo(l.nome); if(!porTipo.has(k)) porTipo.set(k, []); porTipo.get(k).push(l); });
  const ordemTipos = ["", "pav", "teto"];
  return ordemTipos.filter(function(k){ return porTipo.has(k); }).map(function(k){
    const irmaos = todos.filter(function(l){ return tipo(l.nome) === k; });
    const pos = function(l){ return irmaos.indexOf(l); };
    const ord = porTipo.get(k).slice().sort(function(a,b){ return pos(a) - pos(b); });
    const grupos = [];
    ord.forEach(function(l){
      const g = grupos[grupos.length - 1];
      if(g && pos(l) === pos(g[g.length - 1]) + 1) g.push(l); else grupos.push([l]);
    });
    const partes = grupos.map(function(g){
      const a = curto(g[0].nome), b = curto(g[g.length-1].nome);
      if(g.length === 1) return a;
      if(g.length === 2) return a + ", " + b;
      return a + " a " + b;
    });
    return partes.join(", ") + (k === "pav" ? " pav" : k === "teto" ? " teto" : "");
  }).join(" · ");
}

/* Texto legível da localização de um serviço, ex.:
   "Torre A · 1º a 4º pav"  |  "Torre BC · 3º pav · 301, 302"  |  "Guarita" */
export function textoLocalizacao(servicoId){
  return textoDeIds(ligacoesDe(servicoId));
}

/* mesmo texto, a partir de uma lista de ids (usado no formulário) */
export function textoDeIds(lista){
  const ids = lista.filter(function(id){ return !!local(id); });
  if(!ids.length) return "";
  const porFrente = new Map();
  ids.forEach(function(id){
    const f = frenteDe(id);
    if(!f) return;
    if(!porFrente.has(f.id)) porFrente.set(f.id, []);
    porFrente.get(f.id).push(local(id));
  });
  const ordemFrentes = frentes();
  return Array.from(porFrente.keys())
    .sort(function(a,b){ return ordemFrentes.findIndex(function(f){ return f.id === a; }) - ordemFrentes.findIndex(function(f){ return f.id === b; }); })
    .map(function(fid){
      const itens = porFrente.get(fid);
      const pav = itens.filter(function(l){ return l.nivel === NIVEL.PAVIMENTO; });
      const amb = itens.filter(function(l){ return l.nivel === NIVEL.AMBIENTE; });
      let t = local(fid).nome;
      if(pav.length) t += " · " + faixas(pav);
      if(amb.length){
        /* ambientes agrupados pelo pavimento */
        const porPav = new Map();
        amb.forEach(function(a){ if(!porPav.has(a.pai_id)) porPav.set(a.pai_id, []); porPav.get(a.pai_id).push(a); });
        porPav.forEach(function(lista, pavId){
          const p = local(pavId);
          const jaCitado = pav.some(function(x){ return x.id === pavId; });
          t += " · " + (jaCitado || !p ? "" : curto(p.nome) + (numerado(p.nome) ? " pav " : " ")) +
               lista.map(function(a){ return a.nome; }).join(", ");
        });
      }
      return t;
    }).join(" | ");
}

/* ---------- gravação ---------- */
function falha(r){ if(r.error) throw r.error; return r.data; }

export async function criarLocal(nivel, paiId, nome, ordem){
  const r = await sb.from("localizacoes")
    .insert({ nivel:nivel, pai_id:paiId || null, nome:String(nome).trim(), ordem:ordem || 0 })
    .select();
  const linha = falha(r)[0];
  estado.localizacoes.push(linha);
  return linha;
}

export async function renomearLocal(id, nome){
  falha(await sb.from("localizacoes").update({ nome:String(nome).trim() }).eq("id", id));
  local(id).nome = String(nome).trim();
}

/* troca a posição com o irmão de cima (-1) ou de baixo (+1) */
export async function moverLocal(id, sentido){
  const l = local(id);
  const irmaos = filhos(l.pai_id);
  const i = irmaos.indexOf(l), j = i + sentido;
  if(j < 0 || j >= irmaos.length) return;
  /* renumera todos para garantir ordem limpa (0,1,2...) */
  const nova = irmaos.slice();
  nova.splice(i, 1); nova.splice(j, 0, l);
  for(let k = 0; k < nova.length; k++){
    if(nova[k].ordem !== k){
      falha(await sb.from("localizacoes").update({ ordem:k }).eq("id", nova[k].id));
      nova[k].ordem = k;
    }
  }
}

/* desativa o local e tudo abaixo dele (exclusão lógica) */
export async function desativarLocal(id){
  const ids = Array.from(comDescendentes(id));
  const agora = new Date().toISOString();
  falha(await sb.from("localizacoes").update({ excluido_em:agora }).in("id", ids));
  estado.localizacoes = estado.localizacoes.filter(function(l){ return ids.indexOf(l.id) === -1; });
}

/* serviços ligados a um local ou a qualquer coisa abaixo dele */
export function servicosEm(id){
  return estado.servicos.filter(function(s){ return servicoEm(s.id, id); });
}

/* Define exatamente quais localizações o serviço tem.
   As que saem ganham excluido_em; as que entram são criadas
   (ou reativadas, se já tinham existido). */
export async function definirLigacoes(servicoId, ids){
  const novos = Array.from(new Set(ids));
  const atuais = estado.ligacoes.get(servicoId) || new Set();
  const sair = Array.from(atuais).filter(function(id){ return novos.indexOf(id) === -1; });
  const entrar = novos.filter(function(id){ return !atuais.has(id); });
  if(sair.length){
    falha(await sb.from("servico_localizacoes").update({ excluido_em:new Date().toISOString() })
      .eq("servico_id", servicoId).in("localizacao_id", sair));
  }
  if(entrar.length){
    falha(await sb.from("servico_localizacoes").upsert(entrar.map(function(id){
      return { servico_id:servicoId, localizacao_id:id, excluido_em:null };
    }), { onConflict:"servico_id,localizacao_id" }));
  }
  estado.ligacoes.set(servicoId, new Set(novos));
}
