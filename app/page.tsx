"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Tv, Swords } from "lucide-react";

interface Stream {
  id: string;
  title: string;
  platform: string;
  url: string;
  is_live: boolean;
}

export default function LobbyPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  // 🔹 Carrega transmissões do Supabase
  useEffect(() => {
    const fetchStreams = async () => {
      const { data, error } = await supabase.from("streams").select("*");
      if (error) console.error(error);
      else setStreams(data || []);
    };
    fetchStreams();
  }, []);

  // 🔹 Seleciona streams para o duelo
  const toggleSelect = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((i) => i !== id));
    } else if (selected.length < 2) {
      setSelected([...selected, id]);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <Tv className="text-blue-400" />
        PlayZone – Lobby
      </h1>

      <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-6">
        {streams.map((stream) => (
          <div
            key={stream.id}
            onClick={() => toggleSelect(stream.id)}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              selected.includes(stream.id)
                ? "border-blue-500 bg-zinc-800"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <h2 className="text-lg font-semibold">{stream.title}</h2>
            <p className="text-sm text-zinc-400 mb-2">
              Plataforma: {stream.platform}
            </p>
            <a
              href={stream.url}
              target="_blank"
              className="text-blue-400 hover:underline text-sm"
            >
              Acessar canal
            </a>
          </div>
        ))}
      </div>

      {/* 🔹 Botão de duelo */}
      {selected.length === 2 && (
        <div className="flex justify-center mt-8">
          <Link
            href={`/duel?s1=${selected[0]}&s2=${selected[1]}`}
            className="bg-blue-600 hover:bg-blue-500 flex items-center gap-2 px-6 py-3 rounded-lg font-semibold"
          >
            <Swords className="text-yellow-400" /> Ver em Duelo
          </Link>
        </div>
      )}
    </main>
  );
}
