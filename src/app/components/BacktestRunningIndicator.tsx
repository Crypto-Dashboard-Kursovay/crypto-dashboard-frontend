import { useEffect, useState } from "react";
import { Box, Stack, Typography, keyframes } from "@mui/material";
import {
  CloudDownload,
  Autorenew,
  Timeline,
  QueryStats,
  ShowChart,
  Insights,
} from "@mui/icons-material";

// Claude-style индикатор ожидания: текст стадии сменяется и мерцает, иконка
// меняется вместе с ним и анимируется по-разному на каждой стадии.

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
const bob = keyframes`0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); }`;
const pulse = keyframes`0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: .65; }`;
const shimmer = keyframes`0% { background-position: 200% 0; } 100% { background-position: -200% 0; }`;
const fadeIn = keyframes`from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }`;

const ANIM = { spin, bob, pulse } as const;
type AnimName = keyof typeof ANIM;

const STAGES: { text: string; Icon: typeof CloudDownload; anim: AnimName; dur: string }[] = [
  { text: "Загружаем исторические свечи…", Icon: CloudDownload, anim: "bob", dur: "1.4s" },
  { text: "Прогоняем стратегию по свечам…", Icon: Autorenew, anim: "spin", dur: "1.1s" },
  { text: "Исполняем сделки на симуляторе…", Icon: Timeline, anim: "pulse", dur: "1.2s" },
  { text: "Считаем метрики и просадку…", Icon: QueryStats, anim: "pulse", dur: "1s" },
  { text: "Строим кривую доходности…", Icon: ShowChart, anim: "bob", dur: "1.4s" },
  { text: "Почти готово…", Icon: Insights, anim: "spin", dur: "0.9s" },
];

const STAGE_MS = 1900;

export function BacktestRunningIndicator() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % STAGES.length), STAGE_MS);
    return () => clearInterval(t);
  }, []);

  const { text, Icon, anim, dur } = STAGES[i];

  return (
    <Stack alignItems="center" spacing={2.5}>
      <Box
        sx={{
          position: "relative",
          width: 72,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Вращающееся кольцо-градиент */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(34,197,94,0) 0deg, rgba(34,197,94,0.15) 180deg, #22c55e 360deg)",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))",
            animation: `${spin} 1.1s linear infinite`,
          }}
        />
        {/* Иконка стадии — ремоунт по key, чтобы проигрывать fade + свою анимацию */}
        <Box
          key={i}
          sx={{
            display: "flex",
            animation: `${fadeIn} .35s ease, ${ANIM[anim]} ${dur} ease-in-out infinite`,
          }}
        >
          <Icon sx={{ fontSize: 30, color: "success.main" }} />
        </Box>
      </Box>

      <Typography
        key={text}
        variant="body1"
        sx={{
          backgroundImage:
            "linear-gradient(90deg, rgba(148,163,184,.45) 0%, #f1f5f9 22%, rgba(148,163,184,.45) 44%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          fontWeight: 500,
          animation: `${fadeIn} .35s ease, ${shimmer} 2.4s linear infinite`,
        }}
      >
        {text}
      </Typography>
    </Stack>
  );
}
