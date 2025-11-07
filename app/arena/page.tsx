"use client";

import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";

// ✅ Inicializa Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🔥 Gera ou recupera user_fingerprint
function getUserFingerprint() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("user_fingerprint");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("user_fingerprint", id);
  }
  return id;
}

// 🔴 RealtimeCounter com reações animadas
function RealtimeCounter({ duelId, side }: { duelId: string; side: string }) {
  const [counts, setCounts] = useState({ like: 0, dislike: 0 });
  const [highlight, setHighlight] = useState<string | null>(null);

  // Função para buscar reações
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

    const likeCount = data?.filter((r) => r.rtype === "like").length || 0;
    const dislikeCount = data?.filter((r) => r.rtype === "dislike").length || 0;
    setCounts({ like: likeCount, dislike: dislikeCount });
  }

  // Atualização em tempo real
  useEffect(() => {
    fetchCounts();

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
        fetchCounts
      )
      .subscribe();

    const handleLocal = (e: any) => {
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
        setHighlight(e.detail.rtype);
        setTimeout(() => setHighlight(null), 500);
      }
    };

    window.addEventListener("reaction-added", handleLocal);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("reaction-added", handleLocal);
    };
  }, [duelId, side]);

  return (
    <div className="flex justify-center gap-6 text-lg">
      <div
        className={`transition-transform duration-300 ${
          highlight === "like" ? "scale-125 text-green-400" : "text-green-400"
        }`}
      >
        👍 {counts.like}
      </div>
      <div
        className={`transition-transform duration-300 ${
          highlight === "dislike" ? "scale-125 text-red-400" : "text-red-400"
        }`}
      >
        👎 {counts.dislike}
      </div>
    </div>
  );
}

export default function ArenaPage() {
  const ytPlayer = useRef<any>(null);
  const twPlayer = useRef<any>(null);
  const duelId = "duel1";
  const fingerprint = getUserFingerprint();

  const [ytVolume, setYtVolume] = useState(50);
  const [twVolume, setTwVolume] = useState(0.5);
  const [cooldown, setCooldown] = useState(false);

  // Envia reação com bloqueio temporário
  const sendReaction = async (side: string, rtype: string) => {
    if (cooldown) {
      alert("⏳ Aguarde 2 segundos antes de votar novamente!");
      return;
    }
    setCooldown(true);
    setTimeout(() => setCooldown(false), 2000);

    const { error } = await supabase.from("reactions").insert([
      {
        duel_id: duelId,
        side,
        rtype,
        user_fingerprint: fingerprint,
      },
    ]);

    if (error) {
      console.error("Erro ao enviar reação:", error.message);
    } else {
      window.dispatchEvent(
        new CustomEvent("reaction-added", { detail: { side, rtype } })
      );
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        ⚔️ Play Zone Arena
      </h1>

      {/* Scripts externos */}
      <Script src="https://www.youtube.com/iframe_api" strategy="lazyOnload" />
      <Script src="https://player.twitch.tv/js/embed/v1.js" strategy="lazyOnload" />

      {/* Duas transmissões */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div id="yt-player" className="aspect-video bg-black rounded-lg"></div>
        <div id="tw-player" className="aspect-video bg-black rounded-lg"></div>
      </div>

      {/* Reações */}
      <section className="grid md:grid-cols-2 gap-6 mb-10">
        {["left", "right"].map((side) => (
          <div key={side} className="bg-zinc-900 p-4 rounded-lg text-center">
            <h3 className="font-semibold mb-3">
              {side === "left" ? "Streamer da esquerda" : "Streamer da direita"}
            </h3>

            <RealtimeCounter duelId={duelId} side={side} />

            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => sendReaction(side, "like")}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded transition-all duration-200 hover:scale-105"
              >
                👍 Like
              </button>
              <button
                onClick={() => sendReaction(side, "dislike")}
                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded transition-all duration-200 hover:scale-105"
              >
                👎 Dislike
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
