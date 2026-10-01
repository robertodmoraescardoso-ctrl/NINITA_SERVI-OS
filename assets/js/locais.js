import { mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { chavePavimento } from "./inferencia.js";
import { criarLocal, desativarLocal, filhos, frentes, local, moverLocal, NIVEL, renomearLocal, servicosEm } from "./localizacoes.js";
import { pintarTudo } from "./navegacao.js";
import { sb } from "./supabase.js";
import { $, aviso, esc } from "./ui.js";

/* ------------------------------------------------------------
   TELA "LOCAIS" — cadastro da árvore frente > pavimento > unidade
   ------------------------------------------------------------ */
const abertas = new Set();     // frentes expandidas
const comUnidades = new Set(); // pavimentos com unidades à mostra

/* posição natural de um pavimento: subsolo, térreo, 1º, 2º... cobertura */
export function posicaoPavimento(nome){
  const k = chavePavimento(nome);
  if(/^\d+$/.test(k)) return 10 + Number(k);
  if(/^\d+t$/.test(k)) return 10 + parseInt(k, 10) + 0.5;   /* "2º teto" logo depois do 2º pavimento */
  if(k === "subsolo") return 0;
  if(k === "terreo" || k === "pilotis") return 5;
  if(k === "mezanino") return 7;
  if(k === "coberta" || k === "cobertura") return 900;
  return null;
}

/* reordena os irmãos pela posição natural; nomes desconhecidos ficam no fim */
async function reordenarNatural(paiId){
  const irmaos = filhos(paiId).slice().sort(function(a,b){
    const pa = posicaoPavimento(a.nome), pb = posicaoPavimento(b.nome);
    return (pa === null ? 1000 + a.ordem : pa) - (pb === null ? 1000 + b.ordem : pb);
  });
  for(let i = 0; i < irmaos.length; i++){
    if(irmaos[i].ordem !== i){
      const r = await sb.from("localizacoes").update({ ordem:i }).eq("id", irmaos[i].id);
      if(r.error) throw r.error;
      irmaos[i].ordem = i;
    }
  }
}

function botoes(l){
  return '<span class="locais__acoes">' +
    '<button type="button" class="btn btn--p btn--fantasma" data-loc-acao="subir" data-id="' + l.id + '" aria-label="Subir">&uarr;</button>' +
    '<button type="button" class="btn btn--p btn--fantasma" data-loc-acao="descer" data-id="' + l.id + '" aria-label="Descer">&darr;</button>' +
    '<button type="button" class="btn btn--p btn--fantasma" data-loc-acao="renomear" data-id="' + l.id + '">Renomear</button>' +
    '<button type="button" class="btn btn--p btn--fantasma btn--perigo" data-loc-acao="desativar" data-id="' + l.id + '">Desativar</button>' +
  '</span>';
}
function qtd(l){
  const n = servicosEm(l.id).length;
  return n ? '<span class="dica">' + n + ' serviço(s)</span>' : '';
}

export function abrirLocais(){
  const corpo = !estado.locAtivo
    ? '<p class="aviso">' + esc(estado.locErro) + '</p>'
    : frentes().map(function(f){
        const aberta = abertas.has(f.id);
        const pavs = filhos(f.id);
        return '<div class="locais__frente">' +
          '<div class="locais__linha">' +
            '<button type="button" class="locais__nome" data-loc-acao="abrir" data-id="' + f.id + '" aria-expanded="' + aberta + '">' +
              (aberta ? "&#9662; " : "&#9656; ") + esc(f.nome) + '</button>' +
            '<span class="dica">' + pavs.length + ' pavimento(s)</span>' + qtd(f) + botoes(f) +
          '</div>' +
          (aberta ? pavimentosHTML(f, pavs) : '') +
        '</div>';
      }).join("") +
      '<div class="locais__novo">' +
        '<input type="text" id="novaFrente" placeholder="Nova frente (ex.: Área de lazer)">' +
        '<button type="button" class="btn btn--p" data-loc-acao="nova-frente">Adicionar frente</button>' +
      '</div>';

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal" role="dialog" aria-modal="true" aria-label="Locais da obra">' +
      '<div class="modal__cab"><h2>Locais da obra</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo locais">' +
        '<p class="dica" style="margin-top:0">Frente &gt; pavimento &gt; ambiente/unidade. Desativar não apaga nada: o local some das listas e os serviços continuam gravados.</p>' +
        corpo +
      '</div>' +
    '</div>' +
  '</div>';
}

function pavimentosHTML(f, pavs){
  return '<div class="locais__filhos">' +
    pavs.map(function(p){
      const unidades = filhos(p.id);
      const mostrar = comUnidades.has(p.id);
      return '<div class="locais__linha locais__linha--pav">' +
          '<span class="locais__rotulo">' + esc(p.nome) + '</span>' + qtd(p) +
          '<button type="button" class="btn btn--p btn--fantasma" data-loc-acao="unidades" data-id="' + p.id + '">' +
            'Unidades (' + unidades.length + ')</button>' + botoes(p) +
        '</div>' +
        (mostrar ? '<div class="locais__filhos locais__filhos--unid">' +
          (unidades.length ? '<div class="chips-loc">' + unidades.map(function(u){
            return '<span class="chip-loc chip-loc--fixo">' + esc(u.nome) +
              ' <button type="button" data-loc-acao="desativar" data-id="' + u.id + '" aria-label="Desativar ' + esc(u.nome) + '">&times;</button></span>';
          }).join("") + '</div>' : '') +
          '<div class="locais__novo">' +
            '<input type="text" id="unid_' + p.id + '" placeholder="101, 102, 103 ou 101-104">' +
            '<button type="button" class="btn btn--p" data-loc-acao="nova-unidade" data-id="' + p.id + '">Adicionar unidades</button>' +
          '</div></div>' : '');
    }).join("") +
    '<div class="locais__novo">' +
      '<span class="dica">Criar pavimentos do</span>' +
      '<input type="number" id="pavDe_' + f.id + '" min="1" max="99" value="1" style="width:64px">' +
      '<span class="dica">ao</span>' +
      '<input type="number" id="pavAte_' + f.id + '" min="1" max="99" placeholder="8" style="width:64px">' +
      '<label class="dica"><input type="checkbox" id="pavSub_' + f.id + '"> Subsolo</label>' +
      '<label class="dica"><input type="checkbox" id="pavTer_' + f.id + '"> Térreo</label>' +
      '<label class="dica"><input type="checkbox" id="pavCob_' + f.id + '"> Coberta</label>' +
      '<label class="dica"><input type="checkbox" id="pavTeto_' + f.id + '"> Tetos (1º teto, 2º teto...)</label>' +
      '<button type="button" class="btn btn--p" data-loc-acao="criar-pavs" data-id="' + f.id + '">Criar</button>' +
    '</div>' +
    '<div class="locais__novo">' +
      '<input type="text" id="pavNome_' + f.id + '" placeholder="Outro pavimento (ex.: Mezanino)">' +
      '<button type="button" class="btn btn--p" data-loc-acao="novo-pav" data-id="' + f.id + '">Adicionar</button>' +
    '</div>' +
  '</div>';
}

/* "101, 102; 103" e "101-104" -> lista de nomes */
export function separarUnidades(txt){
  const out = [];
  String(txt || "").split(/[,;\n]+/).map(function(t){ return t.trim(); }).filter(Boolean).forEach(function(t){
    const m = /^(\d+)\s*(?:-|a|ao|até)\s*(\d+)$/i.exec(t);
    if(m && Number(m[2]) >= Number(m[1]) && Number(m[2]) - Number(m[1]) <= 200){
      for(let n = Number(m[1]); n <= Number(m[2]); n++) out.push(String(n));
    } else out.push(t);
  });
  return Array.from(new Set(out));
}

/* cria os pavimentos que ainda não existem; devolve quantos criou */
async function criarPavimentos(frenteId, nomes){
  const existentes = filhos(frenteId).map(function(p){ return chavePavimento(p.nome); });
  let n = 0;
  for(const nome of nomes){
    if(existentes.indexOf(chavePavimento(nome)) !== -1) continue;
    await criarLocal(NIVEL.PAVIMENTO, frenteId, nome, posicaoPavimento(nome) || 999);
    existentes.push(chavePavimento(nome));
    n++;
  }
  if(n) await reordenarNatural(frenteId);
  return n;
}
export { criarPavimentos };

export async function acaoLocais(acao, id){
  const val = function(sel){ const e = $(sel); return e ? e.value.trim() : ""; };
  try{
    if(acao === "abrir"){ abertas.has(id) ? abertas.delete(id) : abertas.add(id); }
    if(acao === "unidades"){ comUnidades.has(id) ? comUnidades.delete(id) : comUnidades.add(id); }
    if(acao === "subir")  await moverLocal(id, -1);
    if(acao === "descer") await moverLocal(id, 1);
    if(acao === "renomear"){
      const l = local(id);
      const novo = prompt("Novo nome para \"" + l.nome + "\":", l.nome);
      if(novo && novo.trim() && novo.trim() !== l.nome) await renomearLocal(id, novo);
    }
    if(acao === "desativar"){
      const l = local(id);
      const n = servicosEm(id).length;
      const abaixo = filhos(id).length;
      if(!confirm('Desativar "' + l.nome + '"' + (abaixo ? " e o que está abaixo dele" : "") + "?" +
         (n ? "\n\n" + n + " serviço(s) ligado(s) deixam de ter essa localização (os serviços não são apagados)." : ""))) return;
      await desativarLocal(id);
      aviso('"' + l.nome + '" desativado');
    }
    if(acao === "nova-frente"){
      const nome = val("#novaFrente");
      if(!nome){ aviso("Digite o nome da frente."); return; }
      const f = await criarLocal(NIVEL.FRENTE, null, nome, frentes().length + 1);
      abertas.add(f.id);
    }
    if(acao === "novo-pav"){
      const nome = val("#pavNome_" + id);
      if(!nome){ aviso("Digite o nome do pavimento."); return; }
      const n = await criarPavimentos(id, [nome]);
      if(!n) aviso("Esse pavimento já existe nesta frente.");
    }
    if(acao === "criar-pavs"){
      const de = Number(val("#pavDe_" + id)), ate = Number(val("#pavAte_" + id));
      const nomes = [];
      if($("#pavSub_" + id).checked) nomes.push("Subsolo");
      if($("#pavTer_" + id).checked) nomes.push("Térreo");
      if(ate){
        if(!de || de > ate || ate > 99){ aviso("Confira o intervalo de pavimentos."); return; }
        const tetos = $("#pavTeto_" + id).checked;
        for(let n = de; n <= ate; n++){
          nomes.push(n + "º pavimento");
          if(tetos) nomes.push(n + "º teto");
        }
      }
      if($("#pavCob_" + id).checked) nomes.push("Coberta");
      if(!nomes.length){ aviso("Informe o intervalo ou marque Subsolo, Térreo ou Coberta."); return; }
      const n = await criarPavimentos(id, nomes);
      aviso(n ? n + " pavimento(s) criado(s)" : "Todos esses pavimentos já existiam.");
    }
    if(acao === "nova-unidade"){
      const nomes = separarUnidades(val("#unid_" + id));
      if(!nomes.length){ aviso("Digite as unidades, ex.: 101, 102 ou 101-104."); return; }
      const ja = filhos(id).map(function(u){ return u.nome.toLowerCase(); });
      let n = 0, ordem = filhos(id).length;
      for(const nome of nomes){
        if(ja.indexOf(nome.toLowerCase()) !== -1) continue;
        await criarLocal(NIVEL.AMBIENTE, id, nome, ordem++);
        n++;
      }
      aviso(n + " unidade(s) criada(s)");
    }
  } catch(e){ mostrarErro(e); }
  abrirLocais();
  pintarTudo();
}
