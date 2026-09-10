import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Database, Network, Clock, Zap } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const TYPE_COLORS = {
  core: "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact: "var(--memory-fact)",
  emotion: "var(--memory-emotion)"
};

export default function StatsView() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center font-mono text-primary animate-pulse">
        Compiling diagnostics...
      </div>
    );
  }

  if (!stats) return null;

  const chartData = stats.byType.map(t => ({
    name: t.type.toUpperCase(),
    count: t.count,
    type: t.type,
    fill: `hsl(${TYPE_COLORS[t.type as keyof typeof TYPE_COLORS]})`
  }));

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary glow-core">
            <Activity className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">System Diagnostics</h1>
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">Memory allocation & network health</p>
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Nodes</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-foreground">{stats.totalMemories}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Synapses</CardTitle>
              <Network className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-foreground">{stats.totalConnections}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-chart-1/10 rounded-full blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Core Precepts</CardTitle>
              <div className="h-4 w-4 rounded-full bg-[hsl(var(--memory-core))]/20 border border-[hsl(var(--memory-core))] glow-core" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-[hsl(var(--memory-core))]">
                {stats.byType.find(t => t.type === 'core')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-chart-5/10 rounded-full blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Emotional Data</CardTitle>
              <div className="h-4 w-4 rounded-full bg-[hsl(var(--memory-emotion))]/20 border border-[hsl(var(--memory-emotion))] glow-emotion" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-[hsl(var(--memory-emotion))]">
                {stats.byType.find(t => t.type === 'emotion')?.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <Card className="bg-card border-border lg:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-widest text-sm text-muted-foreground">Type Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} fontFamily="monospace" tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} fontFamily="monospace" tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontFamily: 'monospace' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border flex flex-col">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4" /> Pinned Nodes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {stats.pinnedMemories.length === 0 ? (
                <div className="text-sm font-mono text-muted-foreground italic">No pinned nodes detected.</div>
              ) : (
                stats.pinnedMemories.map(mem => (
                  <Link key={mem.id} href={`/memories/${mem.id}`}>
                    <div className="p-3 border border-border rounded bg-background hover:border-white/20 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${TYPE_COLORS[mem.type as keyof typeof TYPE_COLORS]})` }} />
                        <span className="text-xs font-mono uppercase text-muted-foreground">{mem.type}</span>
                      </div>
                      <div className="font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{mem.title}</div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          
        </div>

        {/* Recent timeline */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-widest text-sm flex items-center gap-2 text-accent">
              <Clock className="h-4 w-4" /> Recent Encodings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentMemories.length === 0 ? (
                <div className="text-sm font-mono text-muted-foreground italic">System timeline empty.</div>
              ) : (
                stats.recentMemories.map((mem, i) => (
                  <Link key={mem.id} href={`/memories/${mem.id}`}>
                    <div className="flex gap-4 group cursor-pointer">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full border-2 border-background ring-2" style={{ backgroundColor: `hsl(${TYPE_COLORS[mem.type as keyof typeof TYPE_COLORS]})`, '--tw-ring-color': `hsl(${TYPE_COLORS[mem.type as keyof typeof TYPE_COLORS]} / 0.3)` } as any} />
                        {i !== stats.recentMemories.length - 1 && <div className="w-0.5 h-full bg-border mt-2" />}
                      </div>
                      <div className="pb-6 pt-0">
                        <div className="text-xs font-mono text-muted-foreground mb-1">{new Date(mem.createdAt).toLocaleString()}</div>
                        <div className="font-serif font-bold text-lg group-hover:text-[hsl(var(--memory-core))] transition-colors" style={{ color: `hsl(${TYPE_COLORS[mem.type as keyof typeof TYPE_COLORS]})` }}>{mem.title}</div>
                        <div className="text-sm text-muted-foreground font-sans line-clamp-1 mt-1">{mem.content}</div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
