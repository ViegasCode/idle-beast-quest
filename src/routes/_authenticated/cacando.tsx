import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Clock3, Crosshair, PackageOpen, Repeat2, Settings2, Shield, Sparkles, Swords, Target, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { CombatArena } from "@/components/CombatArena";
import { GameNav } from "@/components/GameNav";
import { Button } from "@/components/ui/button";
import { changeRegion, coletarResumo, getCombatState, listCollection, setActiveCreature, setAutoCaptura, setRepeatPhase, setSelectedPhase, tentarCaptura } from "@/lib/game.functions";
import { formatDuration } from "@/lib/game";
import { CAP_HORAS, INIMIGOS_POR_FASE, type Combatente, type Inimigo } from "@/lib/combat";
import { BOSS_KEY_ITEM_ID, getBossPhaseNumber } from "@/lib/progression";

export const Route = createFileRoute("/_authenticated/cacando")({
  head: () => ({ meta: [
    { title: "Batalha automática · Achnuba" },
    { name: "description", content: "Arena de combate PvE idle por fases de Achnuba." },
    { property: "og:title", content: "Batalha automática · Achnuba" },
    { property: "og:description", content: "Combates visíveis, capturas e progresso offline." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Combate,
});

function Combate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resolver = useServerFn(getCombatState);
  const capturar = useServerFn(tentarCaptura);
  const alternarAuto = useServerFn(setAutoCaptura);
  const coletar = useServerFn(coletarResumo);
  const trocarRegiao = useServerFn(changeRegion);
  const setPhaseFn = useServerFn(setSelectedPhase);
  const repeatPhaseFn = useServerFn(setRepeatPhase);
  const listar = useServerFn(listCollection);
  const setLeader = useServerFn(setActiveCreature);
  const [agora, setAgora] = useState(() => Date.now());
  const [resumoOffline, setResumoOffline] = useState<any>(null);
  const [mostrouResumo, setMostrouResumo] = useState(false);
  const [showPhases, setShowPhases] = useState(false);

  const { data: state, isPending } = useQuery({ queryKey: ["combatState"], queryFn: () => resolver(), refetchInterval: 20_000 });
  const { data: collection } = useQuery({ queryKey: ["collection"], queryFn: () => listar() });

  const session = state?.session as any;
  const regiao = session?.regions;
  const jogador = state?.combatente as Combatente | undefined;
  const fila = (state?.inimigos ?? []) as Inimigo[];
  const inventario = state?.inventario ?? [];
  const catalogo = state?.catalogo ?? [];
  const pending = state?.pending as any;

  const [teamIds, setTeamIds] = useState<string[]>([]);
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!isPending && state && (!state.profile || !state.profile.starter_escolhido)) navigate({ to: "/inicial", replace: true });
  }, [state, isPending, navigate]);
  useEffect(() => {
    if (mostrouResumo || !state?.resumo) return;
    if (state.resumo.segundos > 180 && state.resumo.batalhas > 0) setResumoOffline(state.resumo);
    setMostrouResumo(true);
  }, [state, mostrouResumo]);
  useEffect(() => {
    if (!session?.creature_id) return;
    try {
      const saved = JSON.parse(localStorage.getItem("team") ?? "[]") as string[];
      setTeamIds(saved.length ? saved.slice(0, 3) : [session.creature_id]);
    } catch {
      setTeamIds([session.creature_id]);
    }
  }, [session?.creature_id]);

  const refresh = () => queryClient.invalidateQueries();
  const captureMutation = useMutation({ mutationFn: (item_id?: number) => capturar({ data: { item_id } }), onSuccess: async (result) => { await refresh(); result.sucesso ? toast.success(`Capturada com ${result.item}!`) : toast.error(`${result.item} usada, mas a criatura escapou.`); }, onError: (error: Error) => toast.error(error.message) });
  const autoMutation = useMutation({ mutationFn: (ativo: boolean) => alternarAuto({ data: { ativo } }), onSuccess: async () => { await refresh(); toast.success("Preferência de captura atualizada."); } });
  const summaryMutation = useMutation({ mutationFn: () => coletar(), onSuccess: async () => { await refresh(); toast.success("Recompensas registradas."); } });
  const regionMutation = useMutation({ mutationFn: (region_id: number) => trocarRegiao({ data: { region_id } }), onSuccess: async () => { await refresh(); toast.success("Região alterada."); }, onError: (error: Error) => toast.error(error.message) });
  const phaseMutation = useMutation({ mutationFn: (fase: number) => setPhaseFn({ data: { fase } }), onSuccess: refresh, onError: (error: Error) => toast.error(error.message) });
  const repeatMutation = useMutation({ mutationFn: (payload: { ativo: boolean; fase?: number | null }) => repeatPhaseFn({ data: payload }), onSuccess: refresh });
  const leaderMutation = useMutation({ mutationFn: (creature_id: string) => setLeader({ data: { creature_id } }), onSuccess: async () => { await refresh(); toast.success("Líder atualizado."); } });

  if (isPending || !session || !jogador) return <div className="game-loading"><Shield /><span>Preparando a arena...</span></div>;

  const collectionRows = collection ?? [];
  const members = teamIds.map((id) => collectionRows.find((creature: any) => creature.id === id)).filter(Boolean) as any[];
  const combatTeam: Combatente[] = members.map((creature) => creature.id === session.creature_id ? jogador : ({ nome: creature.species?.nome ?? "Criatura", nivel: creature.nivel, tipos: [creature.species?.tipo_primario ?? null, creature.species?.tipo_secundario ?? null], sprite_url: creature.species?.sprite_url ?? null, hpMax: jogador.hpMax, ataque: Math.max(1, Math.round(jogador.ataque * .75)), defesa: jogador.defesa, velocidade: jogador.velocidade, is_shiny: creature.is_shiny }));
  const desdeColeta = agora - new Date(session.ultima_coleta_em).getTime();
  const killsHora = Math.round((session.kills_total ?? 0) / Math.max(desdeColeta / 3_600_000, 1 / 60));
  const pressao = Number(session.pressao ?? 0);
  const status = pressao >= .6 ? "Sob pressão" : pressao >= .3 ? "Equilibrado" : "Dominando";
  const totalItens = inventario.reduce((sum: number, item: any) => sum + item.quantidade, 0);
  const pendingLeft = pending ? new Date(pending.expira_em).getTime() - agora : 0;
  const phaseTotal = Number(regiao?.fases ?? 8);
  const bossPhase = getBossPhaseNumber(phaseTotal);
  const hasBossKey = (inventario.find((item: any) => item.item_id === BOSS_KEY_ITEM_ID)?.quantidade ?? 0) > 0;
  const phases = [...Array.from({ length: phaseTotal }, (_, index) => index + 1), bossPhase];

  function setTeam(id: string) {
    setTeamIds((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-3);
      localStorage.setItem("team", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="game-shell">
      <GameNav treinador={state?.profile?.nome_treinador} total={state?.totalCriaturas} />
      <main className="game-main">
        <section className="region-strip" aria-label="Regiões">
          <Button variant="ghost" size="icon" className="region-arrow" aria-label="Região anterior"><ChevronLeft /></Button>
          <div className="region-list">
            {(state?.regions ?? []).map((region: any, index: number) => {
              const active = region.id === regiao?.id;
              return <Button key={region.id} variant="ghost" disabled={active || regionMutation.isPending} onClick={() => regionMutation.mutate(region.id)} className={`region-tile region-biome-${index % 4} ${active ? "is-active" : ""}`}><span className="region-art"><Sparkles /></span><span><b>{region.nome}</b><small>Nv. {region.nivel_minimo}–{region.nivel_maximo}</small></span></Button>;
            })}
          </div>
          <Button variant="ghost" size="icon" className="region-arrow" aria-label="Próxima região"><ChevronRight /></Button>
        </section>

        <section className="battle-statusbar">
          <div><Activity /><span><small>ABATES/HORA</small><b>{killsHora}</b></span></div>
          <div><Shield /><span><small>STATUS</small><b className={pressao >= .6 ? "status-danger" : "status-good"}>{status}</b></span></div>
          <div><Clock3 /><span><small>ÚLTIMA COLETA</small><b>{formatDuration(desdeColeta)}</b></span></div>
          <div><Trophy /><span><small>GANHOS DA SESSÃO</small><b>+{Number(session.exp_total ?? 0).toLocaleString("pt-BR")} EXP · {session.kills_total ?? 0} KILLS</b></span></div>
        </section>

        <div className="game-board">
          <section className="battle-column">
            <div className="panel-heading battle-heading">
              <span><Swords /> {regiao?.nome}</span>
              <Button variant="ghost" onClick={() => setShowPhases((value) => !value)} className="phase-button">FASE {session.fase}/{phaseTotal} <ChevronRight /></Button>
              <div className="phase-progress"><span style={{ width: `${((session.fase_kills ?? 0) / INIMIGOS_POR_FASE) * 100}%` }} /></div>
            </div>
            {showPhases && <div className="phase-picker">
              {phases.map((phase) => { const isBoss = phase === bossPhase; const disabled = isBoss && !hasBossKey; return <Button size="sm" variant={phase === session.fase ? "default" : "outline"} disabled={disabled} key={phase} onClick={() => phaseMutation.mutate(phase)}>{isBoss ? "CHEFE" : phase}</Button>; })}
              <label><input type="checkbox" checked={Boolean(state?.profile?.repetir_fase)} onChange={(event) => repeatMutation.mutate({ ativo: event.target.checked, fase: event.target.checked ? session.fase : null })} /><Repeat2 /> Repetir fase</label>
            </div>}
            <CombatArena jogador={jogador} fila={fila} indiceInicial={session.fase_kills ?? 0} regiao={regiao} time={combatTeam} />

            <section className="team-deck">
              <div className="team-deck-title"><span>TIME ATIVO</span><small>Escolha até 3 · o primeiro é o líder</small></div>
              <div className="team-grid">
                {members.map((creature, index) => {
                  const isLeader = creature.id === session.creature_id;
                  const hp = isLeader ? jogador.hpMax : Math.max(30, jogador.hpMax - index * 8);
                  return <article className={`team-card ${isLeader ? "is-leader" : ""}`} key={creature.id}>
                    <div className="team-portrait">{creature.species?.sprite_url ? <img src={creature.species.sprite_url} alt={creature.species.nome} /> : <Shield />}</div>
                    <div className="team-info"><div><b>{creature.species?.nome ?? "Criatura"}</b><span>Nv. {creature.nivel}</span></div><small>{index === 0 ? "ATACANTE" : index === 1 ? "SUPORTE" : "DEFENSOR"}</small><div className="pixel-meter pixel-meter-hp"><span style={{ width: "100%" }} /></div><p>{hp} / {hp} HP</p><div className="pixel-meter pixel-meter-exp"><span style={{ width: `${35 + index * 18}%` }} /></div></div>
                    {!isLeader && <Button size="sm" variant="ghost" onClick={() => leaderMutation.mutate(creature.id)} title="Definir como líder"><Target /></Button>}
                  </article>;
                })}
                {Array.from({ length: Math.max(0, 3 - members.length) }).map((_, index) => <Button variant="ghost" key={index} className="team-card team-empty" onClick={() => document.getElementById("team-selector")?.scrollIntoView({ behavior: "smooth" })}><Crosshair /><span>Adicionar criatura</span></Button>)}
              </div>
              <details id="team-selector" className="team-selector"><summary>Editar formação</summary><div>{collectionRows.map((creature: any) => <label key={creature.id}><input type="checkbox" checked={teamIds.includes(creature.id)} onChange={() => setTeam(creature.id)} /><span className="mini-portrait">{creature.species?.sprite_url && <img src={creature.species.sprite_url} alt="" />}</span><b>{creature.species?.nome}</b><small>Nv. {creature.nivel}</small></label>)}</div></details>
            </section>
          </section>

          <aside className="capture-column">
            <div className="panel-heading"><span><Crosshair /> CAPTURA</span><span className="capture-timer">{pending && pendingLeft > 0 ? `${Math.ceil(pendingLeft / 1000)}s` : "—"}</span></div>
            <section className="capture-target">
              {pending && pendingLeft > 0 ? <><div className="capture-portrait">{pending.species?.sprite_url ? <img src={pending.species.sprite_url} alt={pending.species.nome} /> : <Crosshair />}</div><div className="capture-data"><b>{pending.species?.nome ?? "Criatura"}</b><span>Nv. {pending.nivel}</span><small>CRIATURA CAPTURÁVEL</small></div></> : <div className="capture-empty"><Crosshair /><b>Nenhum alvo disponível</b><span>Derrote inimigos capturáveis</span></div>}
            </section>
            <div className="capture-items">
              {catalogo.map((item: any) => { const quantity = inventario.find((entry: any) => entry.item_id === item.id)?.quantidade ?? 0; return <Button variant="ghost" key={item.id} disabled={!pending || pendingLeft <= 0 || quantity === 0 || captureMutation.isPending} onClick={() => captureMutation.mutate(item.id)} className="capture-item"><span className="capture-orb" style={{ backgroundColor: item.cor }}><span /></span><b>{item.nome.replace("Bola ", "")}</b><small>×{quantity}</small><em>{Math.round(Number(item.taxa_sucesso) * 100)}%</em></Button>; })}
            </div>
            <Button className="capture-cta" disabled={!pending || pendingLeft <= 0 || totalItens === 0 || captureMutation.isPending} onClick={() => captureMutation.mutate(undefined)}><Crosshair /> {totalItens === 0 ? "SEM ESFERAS" : "CAPTURAR"}</Button>

            <div className="side-tabs"><span><PackageOpen /> INVENTÁRIO</span><span><Settings2 /> AJUSTES</span></div>
            <div className="inventory-grid">{catalogo.map((item: any) => { const quantity = inventario.find((entry: any) => entry.item_id === item.id)?.quantidade ?? 0; return <div key={item.id}><span className="capture-orb small" style={{ backgroundColor: item.cor }}><span /></span><b>×{quantity}</b><small>{Math.round(Number(item.chance_drop) * 100)}% drop</small></div>; })}</div>
            <label className="auto-capture-setting"><input type="checkbox" checked={Boolean(state?.profile?.auto_captura)} onChange={(event) => autoMutation.mutate(event.target.checked)} /><span><b>CAPTURA AUTOMÁTICA</b><small>Usa a melhor esfera disponível</small></span><Zap /></label>
            <Button variant="outline" className="summary-button" onClick={() => summaryMutation.mutate()} disabled={summaryMutation.isPending}><Trophy /> Coletar resumo</Button>
            <p className="offline-note">Progresso offline ativo · limite de {CAP_HORAS}h</p>
          </aside>
        </div>
      </main>

      {resumoOffline && <div className="pixel-modal-backdrop"><section className="pixel-modal"><div className="panel-heading"><span><Trophy /> RELATÓRIO DE EXPEDIÇÃO</span></div><h2>Enquanto você esteve fora</h2><p>{formatDuration(resumoOffline.segundos * 1000)} de combate calculado</p><div className="offline-stats"><span><b>{resumoOffline.batalhas}</b>combates</span><span><b>{resumoOffline.kills}</b>abates</span><span><b>+{Number(resumoOffline.exp).toLocaleString("pt-BR")}</b>EXP</span><span><b>{resumoOffline.derrotas}</b>recuos</span></div><p>Itens encontrados: {resumoOffline.itens.length ? resumoOffline.itens.map((item: any) => `+${item.qtd} ${item.nome}`).join(" · ") : "nenhum"}</p><p>Capturas automáticas: {resumoOffline.capturadas.length} · Tentativas falhas: {resumoOffline.capturasFalhadas}</p><Button onClick={() => setResumoOffline(null)}>VOLTAR À BATALHA</Button></section></div>}
    </div>
  );
}