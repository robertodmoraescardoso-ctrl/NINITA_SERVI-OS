import { $, aviso, esc, fecharModal } from "../ui.js";
import { abrirFicha, definirRepintar, fecharFicha, registrarApontamento, salvarPlanejamento } from "./ficha.js";
import { carregarCatalogo, definirMeuNome, est, hojeISO, percentual, temArea } from "./modelo.js";
import { CHAVE_SB, URL_SB, cfgLocal, conectar, entrar, guardarCfgLocal, lerColaboradores,
         lerPlano, lerSituacao, problemaConfig, sair, sessaoAtual, usuario } from "./nuvem.js";
import { desenharEquipes, desenharFiltros, desenharIndicadores, desenharMaterial,
         desenharPavimentos, desenharPrazos } from "./paineis.js";
import { aplicarZoom, desenharMosaico, desenharPlanta, irAtePeca, mudarZoom, pintarPinos } from "./vistas.js";

/* ------------------------------------------------------------
   ALVENARIA DE VEDAÇÃO — ponto de partida

   Ordem: catálogo (vem do repositório, sempre funciona) → ligação
   com o Supabase → login → apontamentos. A planta aparece mesmo
   que a nuvem falhe; só o lançamento fica desligado, com aviso.
   ------------------------------------------------------------ */

window.vnCarregado = true;

function travar(){ document.body.classList.add("bloqueado"); }
function destravar(){
  document.body.classList.remove("bloqueado");
  document.body.classList.add("liberado");
  /* a planta foi montada atrás da tela de login, quando o container
     ainda podia ter largura zero: refaz a conta agora que ela aparece */
  requestAnimationFrame(function(){ if(est.vista === "planta") aplicarZoom(); });
}

/* ---------- telas de entrada (mesmo visual do sistema de serviços) ---------- */
function logoSrc(){
  const el = document.querySelector(".carimbo__logo");
  return el ? el.src : "";
}
function telaConfiguracao(mensagem){
  travar();
  $("#modais").innerHTML =
  '<div class="cortina portao"><div class="portao__caixa">' +
    '<img class="portao__logo" src="' + logoSrc() + '" alt="Villa Ninita">' +
    "<h2>Ligar à nuvem</h2>" +
    '<p class="portao__ajuda">Esta página usa o mesmo projeto Supabase do Acompanhamento de Serviços. ' +
      "Abra aquela página uma vez para configurar, ou cole os valores aqui.</p>" +
    (mensagem ? '<div class="portao__erro">' + esc(mensagem) + "</div>" : "") +
    '<label class="portao__r" for="cfgUrl">Project URL</label>' +
    '<input class="portao__campo" type="text" id="cfgUrl" inputmode="url" autocapitalize="off" ' +
      'placeholder="https://xxxxxxxx.supabase.co" value="' + esc(String(URL_SB).indexOf("COLE") === 0 ? "" : URL_SB) + '">' +
    '<label class="portao__r" for="cfgChave">Publishable key</label>' +
    '<input class="portao__campo" type="text" id="cfgChave" autocapitalize="off" placeholder="sb_publishable_...">' +
    '<button class="btn btn--marca portao__btn" id="btnSalvarCfg">Ligar à nuvem</button>' +
  "</div></div>";
}
function telaLogin(mensagem){
  travar();
  $("#modais").innerHTML =
  '<div class="cortina portao"><div class="portao__caixa">' +
    '<img class="portao__logo" src="' + logoSrc() + '" alt="Villa Ninita">' +
    "<h2>Alvenaria de vedação</h2>" +
    '<p class="portao__ajuda">Entre com o mesmo usuário do Acompanhamento de Serviços.</p>' +
    (mensagem ? '<div class="portao__erro">' + esc(mensagem) + "</div>" : "") +
    '<label class="portao__r" for="loginEmail">E-mail</label>' +
    '<input class="portao__campo" type="email" id="loginEmail" autocomplete="username" ' +
      'inputmode="email" autocapitalize="off" value="' + esc(cfgLocal("email","")) + '">' +
    '<label class="portao__r" for="loginSenha">Senha</label>' +
    '<input class="portao__campo" type="password" id="loginSenha" autocomplete="current-password">' +
    '<button class="btn btn--marca portao__btn" id="btnEntrar">Entrar</button>' +
  "</div></div>";
  setTimeout(function(){
    const e = $("#loginEmail"), s = $("#loginSenha");
    if(e && !e.value) e.focus(); else if(s) s.focus();
  }, 60);
}

async function fazerLogin(){
  const email = ($("#loginEmail").value || "").trim();
  const senha = $("#loginSenha").value || "";
  if(!email || !senha){ telaLogin("Preencha e-mail e senha."); return; }
  const b = $("#btnEntrar");
  b.disabled = true; b.textContent = "Entrando…";
  try{
    await entrar(email, senha);
    fecharModal();
    destravar();
    await carregarDaNuvem();
  }catch(e){
    telaLogin(/Invalid login/i.test(String(e && e.message)) ? "E-mail ou senha não conferem." : String(e && e.message || e));
  }
}

/* ---------- carga ---------- */
async function carregarDaNuvem(){
  est.conectado = true;
  est.podeGravar = true;
  try{
    const [situacao, plano, equipe] = await Promise.all([
      lerSituacao(), lerPlano(), lerColaboradores()
    ]);
    est.situacao = {};
    situacao.forEach(function(s){ est.situacao[s.pavimento + "__" + s.parede] = s; });
    est.plano = {};
    plano.forEach(function(p){
      est.plano[p.pavimento + "__" + p.parede] = { id:p.id, responsavel:p.responsavel, inicio:p.inicio, fim:p.fim };
    });
    est.equipeSugerida = equipe;
    est.aviso = "";
    if(usuario && usuario.email) definirMeuNome(cfgLocal("nome", ""));
    $("#alvUsuario").textContent = (usuario && usuario.email) || "";
  }catch(e){
    const t = String(e && (e.message || e));
    est.podeGravar = false;
    est.aviso = /relation .* does not exist|schema cache|alvenaria_/i.test(t)
      ? "As tabelas da alvenaria ainda não existem no banco. Rode migracoes/004_alvenaria.sql no Supabase: a planta e o catálogo funcionam, o apontamento não."
      : "Não foi possível ler os apontamentos: " + t;
  }
  repintar();
}

/* ---------- repintura ---------- */
function repintar(){
  desenharPavimentos();
  desenharIndicadores();

  const abas = { mapa:"#alvMapa", prazos:"#alvPrazosTela", equipes:"#alvEquipesTela", material:"#alvMaterial" };
  for(const k in abas){ const el = $(abas[k]); if(el) el.classList.toggle("oculto", est.aba !== k); }
  Array.prototype.forEach.call(document.querySelectorAll("[data-aba]"), function(b){
    b.setAttribute("aria-selected", String(b.dataset.aba === est.aba));
  });

  if(est.aba === "mapa"){
    desenharFiltros();
    const naPlanta = est.vista === "planta";
    $("#alvPlanta").classList.toggle("oculto", !naPlanta);
    $("#alvMosaico").classList.toggle("oculto", naPlanta);
    $("#alvLegendaDim").classList.toggle("oculto", naPlanta);
    Array.prototype.forEach.call(document.querySelectorAll("[data-vista]"), function(b){
      b.setAttribute("aria-pressed", String(b.dataset.vista === est.vista));
    });
    if(naPlanta) desenharPlanta(); else desenharMosaico();
  }
  if(est.aba === "prazos") desenharPrazos();
  if(est.aba === "material") desenharMaterial();

  const av = $("#alvAviso");
  av.innerHTML = est.aviso ? "<strong>Atenção.</strong> " + esc(est.aviso) : "";
  av.classList.toggle("oculto", !est.aviso);
}
definirRepintar(repintar);

/* ---------- eventos ---------- */
document.addEventListener("click", function(ev){
  const alvo = ev.target.closest(
    "[data-pav],[data-aba],[data-vista],[data-zoom],[data-filtro],[data-peca],[data-pct]," +
    "#alvFechar,#alvRegistrar,#alvSalvarPlano,#btnEntrar,#btnSalvarCfg,#alvSair,#alvCortina");
  if(!alvo) return;

  if(alvo.id === "alvCortina" || alvo.id === "alvFechar"){ fecharFicha(); return; }
  if(alvo.id === "btnEntrar"){ fazerLogin(); return; }
  if(alvo.id === "btnSalvarCfg"){ salvarConfiguracao(); return; }
  if(alvo.id === "alvSair"){ sair().then(function(){ location.reload(); }); return; }
  if(alvo.id === "alvRegistrar"){ registrarApontamento(alvo); return; }
  if(alvo.id === "alvSalvarPlano"){ salvarPlanejamento(alvo); return; }

  if(alvo.dataset.pav){
    est.pav = alvo.dataset.pav; est.busca = "";
    guardarCfgLocal("alv_pav", est.pav);
    repintar();
    window.scrollTo({ top:0, behavior:"smooth" });
    return;
  }
  if(alvo.dataset.aba){
    est.aba = alvo.dataset.aba;
    repintar();
    if(est.aba === "equipes") desenharEquipes();
    return;
  }
  if(alvo.dataset.vista){
    est.vista = alvo.dataset.vista;
    guardarCfgLocal("alv_vista", est.vista);
    repintar();
    return;
  }
  if(alvo.dataset.zoom){
    const z = alvo.dataset.zoom;
    mudarZoom(z === "tudo" ? 1 : z === "mais" ? est.zoom*1.6 : est.zoom/1.6);
    return;
  }
  if(alvo.dataset.filtro){ est.filtro = alvo.dataset.filtro; repintar(); return; }
  if(alvo.dataset.peca){ abrirFicha(alvo.dataset.peca); return; }

  if(alvo.dataset.pct !== undefined){
    const v = Number(alvo.dataset.pct);
    const w = est.porId[est.aberta];
    if(!w) return;
    const r = $("#alvPct"); if(r) r.value = v;
    const n = $("#alvPctN"); if(n) n.value = v;
    const m = $("#alvM2"); if(m && temArea(w)) m.value = (w.area*v/100).toFixed(2);
    Array.prototype.forEach.call($("#alvFicha").querySelectorAll("[data-pct]"), function(b){
      b.setAttribute("aria-pressed", String(Number(b.dataset.pct) === v));
    });
    return;
  }
});

document.addEventListener("input", function(ev){
  const w = est.porId[est.aberta];
  const alvo = ev.target;

  if(alvo.id === "alvPct" && w){
    const v = Number(alvo.value);
    if($("#alvPctN")) $("#alvPctN").value = v;
    if($("#alvM2") && temArea(w)) $("#alvM2").value = (w.area*v/100).toFixed(2);
    Array.prototype.forEach.call($("#alvFicha").querySelectorAll("[data-pct]"), function(b){
      b.setAttribute("aria-pressed", String(Number(b.dataset.pct) === v));
    });
  }
  if(alvo.id === "alvPctN" && w){
    const v = Math.max(0, Math.min(100, Number(alvo.value) || 0));
    if($("#alvPct")) $("#alvPct").value = v;
    if($("#alvM2") && temArea(w)) $("#alvM2").value = (w.area*v/100).toFixed(2);
  }
  if(alvo.id === "alvM2" && w && temArea(w)){
    const m = Math.max(0, Math.min(w.area, Number(alvo.value) || 0));
    const v = Math.round(m/w.area*100);
    if($("#alvPct")) $("#alvPct").value = v;
    if($("#alvPctN")) $("#alvPctN").value = v;
  }
  if(alvo.id === "alvBusca"){
    est.busca = alvo.value;
    if(est.vista === "planta"){
      pintarPinos();
      const q = est.busca.trim().toUpperCase();
      const casa = (est.porPavimento[est.pav] || []).filter(function(x){ return x.codigo.indexOf(q) !== -1; });
      if(q.length >= 4 && casa.length === 1) irAtePeca(casa[0].codigo);
    } else {
      desenharMosaico();
    }
  }
});

document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && est.aberta) fecharFicha();
  if(ev.key === "Enter" && $("#btnEntrar")) fazerLogin();
});

let tempoResize;
window.addEventListener("resize", function(){
  clearTimeout(tempoResize);
  tempoResize = setTimeout(function(){ if(est.vista === "planta") aplicarZoom(); }, 180);
});
/* o giro do aparelho muda a largura depois do evento: espera o layout assentar */
window.addEventListener("orientationchange", function(){
  setTimeout(function(){ if(est.vista === "planta") aplicarZoom(); }, 320);
});

function salvarConfiguracao(){
  const url = ($("#cfgUrl").value || "").trim().replace(/\/+$/, "");
  const chave = ($("#cfgChave").value || "").trim();
  const problema = problemaConfig(url, chave);
  if(problema){ telaConfiguracao(problema); return; }
  guardarCfgLocal("url", url);
  guardarCfgLocal("chave", chave);
  location.reload();
}

/* ---------- arranque ---------- */
(async function(){
  try{
    const v = cfgLocal("alv_vista", "");
    if(v === "planta" || v === "mosaico") est.vista = v;
    const p = cfgLocal("alv_pav", "");

    await carregarCatalogo();
    if(p && est.pavPorCodigo[p]) est.pav = p;
    else est.pav = "TE";
    /* no celular a planta inteira não diz nada: começa aproximada */
    est.zoom = window.innerWidth < 700 ? 4 : 3;
    repintar();
  }catch(e){
    $("#alvAviso").classList.remove("oculto");
    $("#alvAviso").innerHTML = "<strong>Atenção.</strong> Não foi possível carregar o catálogo da alvenaria (" +
      esc(String(e && e.message || e)) + "). Confira se a pasta assets foi publicada inteira.";
    destravar();
    return;
  }

  const problema = problemaConfig(URL_SB, CHAVE_SB);
  if(problema){ telaConfiguracao(problema); return; }

  try{ conectar(); }
  catch(e){
    est.aviso = "A biblioteca do Supabase não carregou. A planta funciona; o apontamento não.";
    destravar(); repintar(); return;
  }

  const u = await sessaoAtual();
  if(!u){ telaLogin(); return; }
  destravar();
  await carregarDaNuvem();
})();
