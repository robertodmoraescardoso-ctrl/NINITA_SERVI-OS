import { paraISO } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { pintarTudo } from "./navegacao.js";
import { salvar } from "./supabase.js";
import { aviso, id } from "./ui.js";

/* ------------------------------------------------------------
   EXEMPLO
   ------------------------------------------------------------ */
export async function carregarExemplo(){
  const hoje = new Date();
  function rel(n){ const d = new Date(hoje.getTime()); d.setDate(d.getDate() + n); return paraISO(d); }

  const base = [
    { codigo:"SRV-001", titulo:"Concretagem da laje do 1º pavimento", disciplina:"Estrutura",
      local:"Torre BC · trecho 01", status:"concluido", inicio:rel(-18), fimPrev:rel(-14), fimReal:rel(-13),
      responsavel:"Encarregado de estrutura", equipe:["Equipe de carpintaria","Equipe de armação"], avanco:100,
      descricao:"Montagem de fôrma, armação, concretagem e cura da laje do trecho 01. Conferência de romaneio antes da montagem.",
      apontamentos:[
        { data:rel(-16), observacao:"Fôrma concluída no trecho 01. Conferência de nível e prumo aprovada pela engenharia.", colaboradores:["Equipe de carpintaria"], avanco:45, efetivo:8 },
        { data:rel(-13), observacao:"Concretagem executada. Consumo conforme previsto, sem sobra de caminhão. Cura iniciada no mesmo dia.", colaboradores:["Equipe de armação","Operador de bomba"], avanco:100, efetivo:12 }
      ]},
    { codigo:"SRV-002", titulo:"Alvenaria de vedação do 1º pavimento", disciplina:"Alvenaria",
      local:"Torre A · apartamentos 101 a 104", status:"andamento", inicio:rel(-9), fimPrev:rel(4), fimReal:"",
      responsavel:"Encarregado de alvenaria", equipe:["Equipe de alvenaria"], avanco:55,
      descricao:"Elevação de alvenaria racionalizada com marcação a laser e paletização por pavimento.",
      apontamentos:[
        { data:rel(-6), observacao:"Marcação concluída nos quatro apartamentos. Perda de blocos abaixo da meta do mês.", colaboradores:["Equipe de alvenaria"], avanco:30, efetivo:6 },
        { data:rel(-1), observacao:"Elevação até a 8ª fiada nos apartamentos 101 e 102. Falta de argamassa parou a frente por 2 horas na parte da manhã.", colaboradores:["Equipe de alvenaria","Auxiliar de produção"], avanco:55, efetivo:6 }
      ]},
    { codigo:"SRV-003", titulo:"Retirada de escoramento e reescoramento do térreo", disciplina:"Estrutura",
      local:"Térreo · trechos 01 e 02", status:"paralisado", inicio:rel(-12), fimPrev:rel(-2), fimReal:"",
      responsavel:"Encarregado de estrutura", equipe:["Equipe de carpintaria"], avanco:70,
      descricao:"Retirada do escoramento do térreo mantendo o reescoramento conforme projeto, com reaproveitamento das peças no ciclo seguinte.",
      apontamentos:[
        { data:rel(-3), observacao:"Frente paralisada aguardando liberação da engenharia após ensaio de rompimento dos corpos de prova.", colaboradores:["Equipe de carpintaria"], avanco:70, efetivo:4 }
      ]},
    { codigo:"SRV-004", titulo:"Prumadas hidrossanitárias dos shafts", disciplina:"Instalações hidrossanitárias",
      local:"Torre A · shafts", status:"planejado", inicio:rel(3), fimPrev:rel(20), fimReal:"",
      responsavel:"Encarregado de instalações", equipe:[], avanco:0,
      descricao:"Montagem das prumadas de esgoto e água fria nos shafts, com teste de estanqueidade por trecho.",
      apontamentos:[] },
    { codigo:"SRV-005", titulo:"Execução da guarita de pedestre", disciplina:"Serviços preliminares",
      local:"Periferia · Guarita Pedestre", status:"planejado", inicio:rel(10), fimPrev:rel(38), fimReal:"",
      responsavel:"Encarregado de periferia", equipe:[], avanco:0,
      descricao:"Estrutura, alvenaria e acabamento da guarita, incluindo os pontos de CCTV previstos no relatório de segurança.",
      apontamentos:[] }
  ];

  for(const b of base){
    const s = Object.assign({ id:id(), fotos:[], criadoEm:new Date().toISOString() }, b);
    s.apontamentos = (b.apontamentos || []).map(function(a){
      return Object.assign({ id:id(), fotos:[], criadoEm:new Date().toISOString() }, a);
    });
    try{ await salvar("servicos", s); } catch(e){ aviso(explicarErro(e)); return; }
    estado.servicos.push(s);
  }
  pintarTudo();
  aviso("Exemplo carregado. Edite ou exclua os serviços à vontade.");
}
