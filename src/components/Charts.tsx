import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { TurnAnalysis, TurnScores } from "../types";

const abilityNames: Record<keyof Omit<TurnScores, "overall">, string> = {
  pronunciation: "发音",
  fluency: "流利度",
  grammar: "语法",
  expression: "表达",
  interaction: "互动"
};

export function AbilityRadar({ scores }: { scores: TurnScores }) {
  const data = Object.entries(abilityNames).map(([key, label]) => ({
    ability: label,
    score: scores[key as keyof typeof abilityNames] || 0
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#CBD5E1" />
          <PolarAngleAxis dataKey="ability" tick={{ fill: "#64748B", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.24} strokeWidth={2} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ analyses }: { analyses: TurnAnalysis[] }) {
  const data = analyses.map((item, index) => ({
    turn: `T${index + 1}`,
    pronunciation: item.scores.pronunciation,
    fluency: item.scores.fluency,
    grammar: item.scores.grammar,
    expression: item.scores.expression
  }));

  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
        完成几轮回答后显示趋势
      </div>
    );
  }

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis dataKey="turn" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey="pronunciation" stroke="#10B981" strokeWidth={2} dot={false} name="发音" />
          <Line type="monotone" dataKey="fluency" stroke="#0EA5E9" strokeWidth={2} dot={false} name="流利度" />
          <Line type="monotone" dataKey="grammar" stroke="#F59E0B" strokeWidth={2} dot={false} name="语法" />
          <Line type="monotone" dataKey="expression" stroke="#6366F1" strokeWidth={2} dot={false} name="表达" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
