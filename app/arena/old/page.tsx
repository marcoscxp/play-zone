"use client";

import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";

// ✅ Inicializa o Supabase Client (apenas uma vez)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🔴 Componente: contador de reações em tempo real
function RealtimeCounter({ duelId, side }: { duelId: string; side: string }) {
  const [counts, setCounts] = useState({ like: 0, dislike: 0 });

  // Função que busca contagens atuais
  async function fetchCounts() {
  const { data, error } = await supabase
    .from("reactions")
    .select("rtype")
    .eq("duel_id", duelId)
    .eq("side", side);

  if (error) {
    console.error("Erro ao buscar reações:", error.message);
    return;
  }

  if (!data) {
    console.warn("⚠️ Nenhum dado retornado de Supabase!");
    return;
  }

  const likeCount = data.filter((r) => r.rtype === "like").length;
  const dislikeCount = data.filter((r) => r.rtype === "dislike").length;
  setCounts({ like: likeCount, dislike: dislikeCount });
}

  // Listener em tempo real para novas reações
useEffect(() => {
  fetchCounts(); // carrega inicial

  // Ouve reações em tempo real do Supabase
  const channel = supabase
    .channel(`reactions-${duelId}-${side}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "reactions",
        filter: `duel_id=eq.${duelId}`,
      },
      () => fetchCounts()
    )
    .subscribe();

  // 🧩 Ouve evento local (disparado pelo próprio usuário)
  const handleLocalUpdate = (e: any) => {
    if (e.detail.side === side) {
      setCounts((prev) => ({
        like:
          e.detail.rtype === "like"
            ? prev.like + 1
            : prev.like,
        dislike:
          e.detail.rtype === "dislike"
            ? prev.dislike + 1
            : prev.dislike,
      }));
    }
  };

  window.addEventListener("reaction-added", handleLocalUpdate);

  return () => {
    supabase.removeChannel(channel);
    window.removeEventListener("reaction-added", handleLocalUpdate);
  };
}, [duelId, side]);


  return (
    <div className="flex justify-center gap-6 text-lg">
      <div className="text-green-400 animate-pulse">👍 {counts.like}</div>
      <div className="text-red-400 animate-pulse">👎 {counts.dislike}</div>
    </div>
  );
}

// 🔵 Componente principal
export default function ArenaPage() {
  // Referências para players
  const ytPlayer = useRef<any>(null);
  const twPlayer = useRef<any>(null);

  // Estados
  const [ytReady, setYtReady] = useState(false);
  const [twReady, setTwReady] = useState(false);
  const [ytVolume, setYtVolume] = useState(50);
  const [twVolume, setTwVolume] = useState(0.5);

  // ID fixo do duelo (mock)
  const duelId = "duel1";

  // 🧩 Inicializa YouTube
  useEffect(() => {
    if (window.YT && !ytPlayer.current) {
      ytPlayer.current = new window.YT.Player("yt-player", {
        videoId: "abcd1234", // substitua pelo vídeo real
        events: { onReady: () => setYtReady(true) },
      });
    }
  }, []);

  // 🧩 Inicializa Twitch
  useEffect(() => {
    if (window.Twitch && !twPlayer.current) {
      twPlayer.current = new window.Twitch.Player("tw-player", {
        channel: "alanzoka", // substitua pelo canal real
        parent: ["localhost"], // obrigatoriamente o host do app
      });
      twPlayer.current.addEventListener(window.Twitch.Player.READY, () =>
        setTwReady(true)
      );
    }
  }, []);

  // 🎚️ Funções de controle de áudio
  const muteBoth = () => {
    ytPlayer.current?.mute?.();
    twPlayer.current?.setMuted(true);
  };
  const muteYt = () => {
    ytPlayer.current?.mute?.();
    twPlayer.current?.setMuted(false);
  };
  const muteTw = () => {
    ytPlayer.current?.unMute?.();
    twPlayer.current?.setMuted(true);
  };
  const unmuteBoth = () => {
    ytPlayer.current?.unMute?.();
    twPlayer.current?.setMuted(false);
  };

  // 🎚️ Volume individual
  const handleYtVolume = (v: number) => {
    setYtVolume(v);
    ytPlayer.current?.setVolume?.(v);
  };
  const handleTwVolume = (v: number) => {
    setTwVolume(v);
    twPlayer.current?.setVolume?.(v);
  };

  // 💬 Envio de reação
    const sendReaction = async (side: string, rtype: string) => {
  try {
    const { error } = await supabase.from("reactions").insert([
      {
        duel_id: duelId,
        side,
        rtype,
        user_fingerprint: crypto.randomUUID(),
      },
    ]);

    if (error) {
      console.error("Erro ao enviar reação:", error.message);
    } else {
      console.log(`👍 Reação registrada: ${rtype} (${side})`);
      // 🔥 Dispara evento manual local (para atualizar contador na hora)
      window.dispatchEvent(
        new CustomEvent("reaction-added", { detail: { side, rtype } })
      );
    }
  } catch (e) {
    console.error("Erro inesperado ao enviar reação:", e);
  }
};

  // 🎥 Criar corte
  const createClip = async (side: string) => {
    const now = Math.floor(Date.now() / 1000);
    const { error } = await supabase.from("clips").insert({
      duel_id: duelId,
      side,
      title: "Momento marcante",
      ts_seconds: now,
    });
    if (error) console.error("Erro ao criar corte:", error);
    else alert("🎬 Corte criado e salvo no Supabase!");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        ⚔️ Play Zone Arena
      </h1>

      {/* Scripts das APIs */}
      <Script src="https://www.youtube.com/iframe_api" strategy="lazyOnload" />
      <Script src="https://player.twitch.tv/js/embed/v1.js" strategy="lazyOnload" />

      {/* Duas transmissões lado a lado */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div id="yt-player" className="aspect-video bg-black rounded-lg" />
        <div id="tw-player" className="aspect-video bg-black rounded-lg" />
      </div>

      {/* 🎧 Controles de áudio */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        <button onClick={muteBoth} className="bg-zinc-800 px-4 py-2 rounded">
          🔇 Mutar ambos
        </button>
        <button onClick={muteYt} className="bg-zinc-800 px-4 py-2 rounded">
          🔇 Mutar YouTube
        </button>
        <button onClick={muteTw} className="bg-zinc-800 px-4 py-2 rounded">
          🔇 Mutar Twitch
        </button>
        <button onClick={unmuteBoth} className="bg-blue-600 px-4 py-2 rounded">
          🔊 Ativar ambos
        </button>
      </div>

      {/* 🎚️ Sliders de volume */}
      <div className="flex flex-col md:flex-row gap-8 justify-center mb-10">
        <div className="flex flex-col items-center">
          <p>YouTube Volume</p>
          <input
            type="range"
            min={0}
            max={100}
            value={ytVolume}
            onChange={(e) => handleYtVolume(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col items-center">
          <p>Twitch Volume</p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={twVolume}
            onChange={(e) => handleTwVolume(Number(e.target.value))}
          />
        </div>
      </div>

      {/* ❤️ Reações com contador em tempo real */}
      <section className="grid md:grid-cols-2 gap-6 mb-10">
        {["left", "right"].map((side) => (
          <div key={side} className="bg-zinc-900 p-4 rounded-lg text-center">
            <h3 className="font-semibold mb-3">
              {side === "left"
                ? "Streamer da esquerda"
                : "Streamer da direita"}
            </h3>

            {/* Contadores */}
            <RealtimeCounter duelId={duelId} side={side} />

            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => sendReaction(side, "like")}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
              >
                👍 Like
              </button>
              <button
                onClick={() => sendReaction(side, "dislike")}
                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded"
              >
                👎 Dislike
              </button>
            </div>

            <button
              onClick={() => createClip(side)}
              className="bg-yellow-500 hover:bg-yellow-400 px-4 py-2 rounded mt-4"
            >
              🎥 Criar Corte
            </button>
          </div>
        ))}
      </section>

      {/* 💬 Chat (placeholder) */}
      <div className="bg-zinc-900 rounded-lg p-4 mb-10">
        <h2 className="text-xl font-semibold mb-3">💬 Chat da Torcida</h2>
        <p className="text-zinc-400 text-sm">
          (Em breve: chat em tempo real usando Supabase Realtime)
        </p>
      </div>

      {/* 🧾 Painel do Jogo */}
      <div className="p-4 bg-zinc-900 rounded-lg text-center">
        <h2 className="text-xl font-bold mb-2">Painel do Jogo</h2>
        <p>Status: Pré-jogo (inicia em 10 minutos)</p>
        <p>Placar: Palmeiras 0 x 0 Flamengo</p>
      </div>
    </main>
  );
}
