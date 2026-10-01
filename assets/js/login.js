import { SUPABASE_URL, SUPABASE_CHAVE } from "../../config.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { prepararFotos } from "./fotos.js";
import { trocarAba } from "./navegacao.js";
import { cfgLocal, CHAVE_SB, conectar, configurado, definirConfig, guardarCfgLocal, ler, lerTudo, problemaConfig, sb, URL_SB } from "./supabase.js";
import { $, aviso, esc, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   TELAS DE ENTRADA — configuração e login
   ------------------------------------------------------------ */
let usuario = null;

export function logoSrc(){
  const el = document.querySelector(".carimbo__logo");
  return el ? el.src : "";
}

export function travar(){ document.body.classList.add("bloqueado"); }
export function destravar(){ document.body.classList.remove("bloqueado"); document.body.classList.add("liberado"); }

export function telaConfiguracao(mensagem){
  travar();
  $("#modais").innerHTML =
  '<div class="cortina portao">' +
    '<div class="portao__caixa">' +
      '<img class="portao__logo" src="' + logoSrc() + '" alt="Villa Ninita">' +
      '<h2>Ligar à nuvem</h2>' +
      '<p class="portao__ajuda">Cole os dois valores que aparecem no seu projeto Supabase, ' +
        'em Project Settings. Isso é pedido uma única vez neste aparelho.</p>' +
      (mensagem ? '<div class="portao__erro">' + esc(mensagem) + '</div>' : '') +
      '<label class="portao__r" for="cfgUrl">Project URL</label>' +
      '<input class="portao__campo" type="text" id="cfgUrl" placeholder="https://xxxxxxxx.supabase.co" value="' + esc(URL_SB.indexOf("COLE") === 0 ? "" : URL_SB) + '">' +
      '<label class="portao__r" for="cfgChave">Publishable key</label>' +
      '<input class="portao__campo" type="text" id="cfgChave" placeholder="sb_publishable_...">' +
      '<button class="btn btn--marca portao__btn" id="btnSalvarCfg">Ligar à nuvem</button>' +
    '</div>' +
  '</div>';
  setTimeout(function(){ const c = $("#cfgUrl"); if(c) c.focus(); }, 50);
}

export function telaLogin(mensagem){
  travar();
  $("#modais").innerHTML =
  '<div class="cortina portao">' +
    '<div class="portao__caixa">' +
      '<img class="portao__logo" src="' + logoSrc() + '" alt="Villa Ninita">' +
      '<h2>Acompanhamento de serviços</h2>' +
      '<p class="portao__ajuda">Entre com o usuário cadastrado no Supabase.</p>' +
      (mensagem ? '<div class="portao__erro">' + esc(mensagem) + '</div>' : '') +
      '<label class="portao__r" for="loginEmail">E-mail</label>' +
      '<input class="portao__campo" type="email" id="loginEmail" autocomplete="username" value="' + esc(cfgLocal("email","")) + '">' +
      '<label class="portao__r" for="loginSenha">Senha</label>' +
      '<input class="portao__campo" type="password" id="loginSenha" autocomplete="current-password">' +
      '<button class="btn btn--marca portao__btn" id="btnEntrar">Entrar</button>' +
      '<button class="portao__link" id="btnTrocarCfg">Trocar o projeto Supabase</button>' +
    '</div>' +
  '</div>';
  setTimeout(function(){
    const e = $("#loginEmail");
    const s = $("#loginSenha");
    if(e && !e.value) e.focus(); else if(s) s.focus();
  }, 50);
}

export async function entrar(){
  const email = $("#loginEmail").value.trim();
  const senha = $("#loginSenha").value;
  if(!email || !senha){ telaLogin("Preencha e-mail e senha."); return; }
  const btn = $("#btnEntrar");
  btn.disabled = true; btn.textContent = "Entrando...";
  try{
    const r = await sb.auth.signInWithPassword({ email: email, password: senha });
    if(r.error) throw r.error;
    guardarCfgLocal("email", email);
    usuario = r.data.user;
    fecharModal();
    await carregarTudo();
  } catch(e){
    telaLogin(explicarErro(e));
  }
}

export async function sair(){
  if(!confirm("Sair da conta neste aparelho?")) return;
  try { await sb.auth.signOut(); } catch(e){}
  estado.servicos = [];
  estado.urls.clear();
  usuario = null;
  telaLogin();
}

export async function carregarTudo(){
  destravar();
  aviso("Carregando os serviços...");
  try{
    estado.servicos = await lerTudo("servicos");
    const cfg = await ler("config", "obra");
    estado.nomeObra = cfg ? cfg.valor : "Torre A · Torre BC · Periferia";
    $("#nomeObra").value = estado.nomeObra;
    await prepararFotos();
    mostrarUsuario();
    trocarAba("painel");
    aviso(estado.servicos.length + " serviço(s) carregado(s) da nuvem");
  } catch(e){
    mostrarFalha(explicarErro(e));
  }
}

export function mostrarUsuario(){
  const el = $("#usuarioAtivo");
  if(el && usuario) el.textContent = usuario.email;
}

export function mostrarFalha(txt){
  const a = $("#avisoArmazenamento");
  a.classList.remove("oculto");
  a.innerHTML = "<strong>Atenção.</strong> " + esc(txt);
}

/* telas de entrada */
document.addEventListener("click", function(ev){
  const b = ev.target.closest ? ev.target.closest("#btnSalvarCfg, #btnEntrar, #btnTrocarCfg, #btnSair") : null;
  if(!b) return;
  if(b.id === "btnEntrar") entrar();
  if(b.id === "btnSair") sair();
  if(b.id === "btnTrocarCfg"){
    try{ localStorage.removeItem("vn_url"); localStorage.removeItem("vn_chave"); }catch(e){}
    definirConfig(SUPABASE_URL, SUPABASE_CHAVE);
    telaConfiguracao();
  }
  if(b.id === "btnSalvarCfg"){
    const u = $("#cfgUrl").value.trim().replace(/\/+$/, "");
    const k = $("#cfgChave").value.trim();
    definirConfig(u, k);
    const problema = problemaConfig(u, k);
    if(problema || !configurado()){
      telaConfiguracao(problema || "Confira os dois campos: a URL termina em .supabase.co e a chave começa com sb_publishable_.");
      return;
    }
    guardarCfgLocal("url", u); guardarCfgLocal("chave", k);
    conectar();
    telaLogin();
  }
});

document.addEventListener("keydown", function(ev){
  if(ev.key !== "Enter") return;
  if(ev.target.id === "loginEmail" || ev.target.id === "loginSenha"){ ev.preventDefault(); entrar(); }
  if(ev.target.id === "cfgUrl" || ev.target.id === "cfgChave"){ ev.preventDefault(); $("#btnSalvarCfg").click(); }
});

/* ------------------------------------------------------------
   INÍCIO — chamado pelo main.js depois que tudo carregou
   ------------------------------------------------------------ */
export async function iniciar(){
  travar();

  if(!window.supabase){
    document.body.classList.remove("bloqueado");
    mostrarFalha("A biblioteca do Supabase não carregou. Confira a internet e recarregue a página.");
    return;
  }
  if(!configurado()){
    const problema = problemaConfig(URL_SB, CHAVE_SB);
    telaConfiguracao(problema ? "Configuração inválida (config.js ou a salva neste aparelho): " + problema : "");
    return;
  }

  conectar();
  try{
    const r = await sb.auth.getSession();
    if(r.data && r.data.session){
      usuario = r.data.session.user;
      fecharModal();
      await carregarTudo();
    } else {
      telaLogin();
    }
  } catch(e){
    telaLogin(explicarErro(e));
  }
}
