"use client";

import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";

// Inicializa Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getUserFingerprint() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("user_fingerprint");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("user_fingerprint", id);
  }
  return id;
}

function RealtimeCounter({ duelId, side }: { duelId: string; side: string }) {
  const [counts, setCounts] = useState({ like: 0, dislike: 0 });
  const [highlight, setHighlight] = useState<string | null>(null);

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
        () => fetchCounts()
      )
      .subscribe();

    const handleLocal = (e: any) => {
      if (e.detail.side === side) {
        setCounts((prev) => ({
          like: e.detail.rtype === "like" ? prev.like + 1 : prev.like,
          dislike:
            e.detail.rtype === "dislike" ? prev.dislike + 1 : prev.dislike,
        }));
        setHighlight(e.detail.rtype);
        setTimeout(() => setHighlight(null), 400);
      }
    };

    window.addEventListener("reaction-added", handleLocal);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("reaction-added", handleLocal);
    };
  }, [duelId, side]);

  return (
    <div className="flex justify-center gap-6 text-xl font-semibold">
      <div
        className={`flex items-center gap-2 transition-transform duration-300 ${
          highlight === "like" ? "scale-110 text-green-400" : "text-green-400"
        }`}
      >
        👍 {counts.like}
      </div>
      <div
        className={`flex items-center gap-2 transition-transform duration-300 ${
          highlight === "dislike" ? "scale-110 text-red-400" : "text-red-400"
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

  // 🎬 Inicializa os players do YouTube (usando os iframes já existentes)
  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        ytPlayer.current = new window.YT.Player("player-left");
        twPlayer.current = new window.YT.Player("player-right");
      } else {
        setTimeout(loadYouTubeAPI, 300);
      }
    };
    loadYouTubeAPI();
  }, []);

  // 🎧 Controles de som e volume
  const muteBoth = () => {
    ytPlayer.current?.mute();
    twPlayer.current?.mute();
  };

  const muteYt = () => {
    ytPlayer.current?.mute();
    twPlayer.current?.unMute();
  };

  const muteTw = () => {
    ytPlayer.current?.unMute();
    twPlayer.current?.mute();
  };

  const unmuteBoth = () => {
    ytPlayer.current?.unMute();
    twPlayer.current?.unMute();
  };

  // 🎚️ Controle de volume
  useEffect(() => {
    if (ytPlayer.current && ytPlayer.current.setVolume) {
      ytPlayer.current.setVolume(ytVolume);
    }
  }, [ytVolume]);

  useEffect(() => {
    if (twPlayer.current && twPlayer.current.setVolume) {
      twPlayer.current.setVolume(twVolume * 100); // YouTube espera 0–100
    }
  }, [twVolume]);


  const sendReaction = async (side: string, rtype: string) => {
    if (cooldown) return;
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

// 💬 Chat da torcida (Realtime)
function ChatBox({ duelId }: { duelId: string }) {
  const [messages, setMessages] = useState<
    { username: string; content: string; created_at: string }[]
  >([]);
  const [newMsg, setNewMsg] = useState("");
  const [username, setUsername] = useState("");

  // Ao abrir a página, define um nome local (fixo na sessão)
  useEffect(() => {
    const stored = localStorage.getItem("chat_username");
    if (stored) {
      setUsername(stored);
    } else {
      const random = "User" + Math.floor(Math.random() * 1000);
      setUsername(random);
      localStorage.setItem("chat_username", random);
    }
  }, []);

  // Busca mensagens existentes
  async function loadMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("duel_id", duelId)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data);
  }

  // Inscreve-se no canal Realtime
  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`messages-${duelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `duel_id=eq.${duelId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [duelId]);

  // Envia mensagem
  async function sendMessage() {
    if (!newMsg.trim()) return;
    await supabase.from("messages").insert([
      {
        duel_id: duelId,
        username,
        content: newMsg.trim(),
      },
    ]);
    setNewMsg("");
  }

  return (
    <div className="bg-[#1E1E1E] p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-3">💬 Chat da Torcida</h2>

      <div className="h-64 overflow-y-auto bg-zinc-900 p-3 rounded-lg mb-3 border border-zinc-800">
        {messages.length === 0 ? (
          <p className="text-zinc-500 text-center mt-10">
            Nenhuma mensagem ainda. Seja o primeiro a comentar!
          </p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="mb-2">
              <span className="text-blue-400 font-semibold mr-2">
                {msg.username}:
              </span>
              <span className="text-zinc-200">{msg.content}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-zinc-800 px-3 py-2 rounded-md text-sm outline-none"
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

  
  return (
    <main className="min-h-screen bg-[#121212] text-white p-6 space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold">⚔️ Play Zone Arena</h1>
      </header>

      <Script src="https://www.youtube.com/iframe_api" strategy="lazyOnload" />
      <Script src="https://player.twitch.tv/js/embed/v1.js" strategy="lazyOnload" />

      {/* Duas transmissões */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* 🎥 Esquerda – INSTA VERDE TV */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            id="player-left" // ✅ ADICIONE ESTE ID
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/agTa_KXC-0A?si=K7zeq-jI_hv6nZ34&enablejsapi=1&controls=0"
            //src="https://www.youtube.com/embed/agTa_KXC-0A?si=K7zeq-jI_hv6nZ34&controls=0"
            title="INSTA VERDE TV"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>

        {/* 🎥 Direita – Paparazzo Rubro-Negro */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            id="player-right" // ✅ ADICIONE ESTE ID
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/Z7IhuaycEhk?si=jO94fCZipV7i_WIY&enablejsapi=1&controls=0"
            //src="https://www.youtube.com/embed/Z7IhuaycEhk?si=jO94fCZipV7i_WIY&controls=0"
            title="Paparazzo Rubro-Negro"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
      </div>


      {/* Controls */}
      <div className="flex flex-wrap justify-center items-center gap-4">
        <button onClick={muteBoth} className="bg-zinc-800 ...">🔇 Mutar ambos</button>
        <button onClick={muteYt} className="bg-zinc-800 ...">🔇 Mutar YouTube</button>
        <button onClick={muteTw} className="bg-zinc-800 ...">🔇 Mutar Twitch</button>
        <button onClick={unmuteBoth} className="bg-blue-600 ...">🔊 Ativar ambos</button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 justify-center">
        <div className="flex flex-col items-center">
          <p className="text-sm text-zinc-400 mb-1">YouTube Volume</p>
          <input
            type="range"
            min={0}
            max={100}
            value={ytVolume}
            onChange={(e) => setYtVolume(Number(e.target.value))}
            className="w-full md:w-48"
          />
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm text-zinc-400 mb-1">Twitch Volume</p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={twVolume}
            onChange={(e) => setTwVolume(Number(e.target.value))}
            className="w-full md:w-48"
          />
        </div>
      </div>

      {/* Reactions Section */}
      <section className="grid md:grid-cols-2 gap-6">
        {["left", "right"].map((side) => (
          <div key={side} className="bg-[#1E1E1E] p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">
              {side === "left" ? "Streamer da esquerda" : "Streamer da direita"}
            </h3>

            <RealtimeCounter duelId={duelId} side={side} />

            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => sendReaction(side, "like")}
                className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-md text-lg transition-transform hover:scale-105"
              >
                👍 Like
              </button>
              <button
                onClick={() => sendReaction(side, "dislike")}
                className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-md text-lg transition-transform hover:scale-105"
              >
                👎 Dislike
              </button>
            </div>

            <button
              className="mt-4 w-full bg-yellow-500 hover:bg-yellow-400 px-6 py-2 rounded-md text-lg transition-transform hover:scale-105"
            >
              🎥 Criar Corte
            </button>
          </div>
        ))}
      </section>

      {/* Chat */}
      <div className="bg-[#1E1E1E] p-6 rounded-lg">
      <ChatBox duelId={duelId} />
      </div>

      {/* Painel do Jogo */}
      <div className="bg-[#1E1E1E] p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-2">Painel do Jogo</h2>
        <p className="text-zinc-400 mb-1">Status: Pré-jogo (inicia em 10 minutos)</p>
        <p className="text-lg">Placar: Palmeiras 0 × 0 Flamengo</p>
      </div>
    </main>
  );
}
