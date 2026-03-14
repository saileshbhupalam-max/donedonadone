import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Rocket, Briefcase, Building, GraduationCap, Palette, Compass } from "lucide-react";

// ─── Data ──────────────────────────────────────────
const ROLE_TYPES = [
  { value: "founder", label: "Founder", icon: Rocket },
  { value: "freelancer", label: "Freelancer", icon: Briefcase },
  { value: "employee", label: "Employee", icon: Building },
  { value: "student", label: "Student", icon: GraduationCap },
  { value: "creative", label: "Creative", icon: Palette },
  { value: "figuring_it_out", label: "Figuring It Out", icon: Compass },
];

const PROJECT_STAGES = ["Idea", "Building", "Launched", "Growing", "Stable"];
const EXP_OPTIONS = ["0-1", "2-4", "5-9", "10-15", "15+"];

const SKILL_CATEGORIES: Record<string, string[]> = {
  Tech: ["React", "Python", "Node.js", "TypeScript", "AI/ML", "DevOps", "Mobile", "Data Science", "Blockchain", "Cloud", "Go", "Rust", "Java", "PHP", "Ruby", "Flutter"],
  Design: ["UI/UX", "Figma", "Brand Design", "Illustration", "Motion Design", "User Research", "Product Design", "Graphic Design"],
  Business: ["Sales", "Marketing", "Fundraising", "Strategy", "Operations", "Finance", "Legal", "Product Management", "Growth"],
  Content: ["Writing", "Video", "Social Media", "SEO", "Podcasting", "Photography", "Copywriting", "Editing"],
  Domain: ["Healthcare", "Education", "Finance", "E-commerce", "SaaS", "Consumer", "Real Estate", "Gaming", "Media"],
};

const INDUSTRIES = ["Fintech", "Edtech", "Healthtech", "SaaS", "E-commerce", "Consumer", "Media", "Gaming", "Climate", "Real Estate", "Social Impact", "AI", "Deeptech", "D2C", "Enterprise", "Creator Economy"];

const LOOKING_FOR = ["A designer", "A developer", "Funding/investor advice", "A co-founder", "Clients/projects", "A mentor", "Someone to brainstorm with", "Beta testers", "Marketing help", "Domain expertise"];
const CAN_OFFER = ["Code reviews", "Design feedback", "Investor intros", "Marketing help", "Domain expertise", "Mentoring", "Writing/editing", "Technical architecture", "Product feedback", "Hiring advice"];

const TOPICS = ["AI/ML", "Design", "Startups", "Sustainability", "Books", "Fitness", "Food", "Investing", "Content Creation", "Mental Health", "Productivity", "Philosophy", "Music", "Movies/TV", "Sports", "Parenting", "Pets"];
const VALUES_LIST = [
  { value: "impact", label: "Impact", emoji: "🌍" },
  { value: "growth", label: "Growth", emoji: "📈" },
  { value: "creativity", label: "Creativity", emoji: "✨" },
  { value: "analytical", label: "Analytical", emoji: "🧠" },
  { value: "community", label: "Community", emoji: "👥" },
  { value: "independence", label: "Independence", emoji: "⛰️" },
  { value: "learning", label: "Learning", emoji: "📚" },
  { value: "building", label: "Building", emoji: "🔨" },
  { value: "fun_first", label: "Fun First", emoji: "🎉" },
  { value: "health", label: "Health & Wellness", emoji: "❤️" },
  { value: "authenticity", label: "Authenticity", emoji: "⭐" },
];

const PEAK_HOURS = [
  { value: "early_morning", label: "Early Morning", time: "6-9" },
  { value: "morning", label: "Morning", time: "9-12" },
  { value: "afternoon", label: "Afternoon", time: "12-3" },
  { value: "late_afternoon", label: "Late Afternoon", time: "3-6" },
  { value: "evening", label: "Evening", time: "6-9" },
  { value: "night", label: "Night", time: "9+" },
];

const SESSION_LENGTHS = ["Quick 1hr", "Standard 2hr", "Deep 4hr", "Flexible"];
const GROUP_SIZES = ["1-on-1", "Small crew 3-4", "Squad 5-8", "Whatever works"];
const CONVERSATION_DEPTHS = ["Keep it light", "Meaningful chats", "Deep rabbit holes", "Depends on mood"];

const TOTAL_STEPS = 7;

interface TasteGraphData {
  role_type: string | null;
  current_project: string | null;
  project_stage: string | null;
  experience_years: number | null;
  skills: string[];
  industries: string[];
  work_looking_for: string[];
  work_can_offer: string[];
  topics: string[];
  values: string[];
  peak_hours: string[];
  session_length_pref: string | null;
  group_size_pref: string | null;
  conversation_depth: string | null;
  openness_to_new: number | null;
  company_name: string | null;
  company_visible: boolean;
  work_profile_complete: number;
}

export default function TasteGraphBuilder() {
  usePageTitle("Build Your Work DNA — DanaDone");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<TasteGraphData>({
    role_type: null, current_project: null, project_stage: null, experience_years: null,
    skills: [], industries: [], work_looking_for: [], work_can_offer: [],
    topics: [], values: [], peak_hours: [], session_length_pref: null,
    group_size_pref: null, conversation_depth: null, openness_to_new: 3,
    company_name: null, company_visible: false, work_profile_complete: 0,
  });
  const [customSkill, setCustomSkill] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: tg } = await supabase
        .from("taste_graph")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (tg) {
        setData({
          role_type: tg.role_type,
          current_project: tg.current_project,
          project_stage: tg.project_stage,
          experience_years: tg.experience_years,
          skills: tg.skills || [],
          industries: tg.industries || [],
          work_looking_for: tg.work_looking_for || [],
          work_can_offer: tg.work_can_offer || [],
          topics: tg.topics || [],
          values: tg.values || [],
          peak_hours: tg.peak_hours || [],
          session_length_pref: tg.session_length_pref,
          group_size_pref: tg.group_size_pref,
          conversation_depth: tg.conversation_depth,
          openness_to_new: tg.openness_to_new ?? 3,
          company_name: tg.company_name,
          company_visible: tg.company_visible ?? false,
          work_profile_complete: Number(tg.work_profile_complete || 0),
        });
        // Resume at first incomplete step
        const firstIncomplete = findFirstIncompleteStep(tg);
        if (firstIncomplete <= TOTAL_STEPS) setStep(firstIncomplete);
        else setStep(TOTAL_STEPS); // summary
      }
      setLoading(false);
    })();
  }, [user]);

  function findFirstIncompleteStep(tg: any): number {
    if (!tg.role_type) return 1;
    if ((tg.skills || []).length === 0) return 2;
    if ((tg.work_looking_for || []).length === 0 && (tg.work_can_offer || []).length === 0) return 3;
    if ((tg.topics || []).length === 0 && (tg.values || []).length === 0) return 4;
    if ((tg.peak_hours || []).length === 0) return 5;
    return TOTAL_STEPS; // All done, show summary
  }

  const saveStep = async (fields: Partial<TasteGraphData>) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("taste_graph")
      .update(fields)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return false;
    }
    setData(prev => ({ ...prev, ...fields }));
    return true;
  };

  const toggleArray = (arr: string[], item: string, max?: number) => {
    if (arr.includes(item)) return arr.filter(i => i !== item);
    if (max && arr.length >= max) { toast.error(`Max ${max} selections`); return arr; }
    return [...arr, item];
  };

  const handleNext = async () => {
    let fields: Partial<TasteGraphData> = {};
    switch (step) {
      case 1: fields = { role_type: data.role_type, current_project: data.current_project, project_stage: data.project_stage, experience_years: data.experience_years }; break;
      case 2: fields = { skills: data.skills, industries: data.industries }; break;
      case 3: fields = { work_looking_for: data.work_looking_for, work_can_offer: data.work_can_offer }; break;
      case 4: fields = { topics: data.topics, values: data.values }; break;
      case 5: fields = { peak_hours: data.peak_hours, session_length_pref: data.session_length_pref, group_size_pref: data.group_size_pref, conversation_depth: data.conversation_depth, openness_to_new: data.openness_to_new }; break;
      case 6: fields = { company_name: data.company_name, company_visible: data.company_visible }; break;
    }
    const ok = await saveStep(fields);
    if (ok) setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const Chip = ({ label, selected, onClick, size = "md" }: { label: string; selected: boolean; onClick: () => void; size?: "sm" | "md" }) => (
    <button
      onClick={onClick}
      className={`px-3 ${size === "sm" ? "py-1 text-[11px]" : "py-1.5 text-xs"} rounded-full font-medium border transition-all ${
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
      }`}
    >
      {selected && <Check className="w-3 h-3 inline mr-1" />}{label}
    </button>
  );

  if (loading) return <AppShell><div className="px-4 py-6 max-w-lg mx-auto space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div></AppShell>;

  return (
    <AppShell>
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 pb-28">
        {/* Progress */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => step === 1 ? navigate(-1) : setStep(s => s - 1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex gap-1 flex-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i + 1 <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{step}/{TOTAL_STEPS}</span>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: What are you building? */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">What are you building?</h2>
              <div>
                <p className="text-xs text-muted-foreground mb-2">I am a...</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_TYPES.map(r => (
                    <button key={r.value} onClick={() => setData(d => ({ ...d, role_type: r.value }))}
                      className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${data.role_type === r.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                      <r.icon className="w-4 h-4 text-foreground" />
                      <span className="text-sm font-medium text-foreground">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current project</p>
                <Input value={data.current_project || ""} onChange={e => setData(d => ({ ...d, current_project: e.target.value.slice(0, 100) }))} placeholder="Building a fintech app" maxLength={100} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Project stage</p>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_STAGES.map(s => <Chip key={s} label={s} selected={data.project_stage === s} onClick={() => setData(d => ({ ...d, project_stage: s }))} />)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Experience</p>
                <div className="flex gap-2 flex-wrap">
                  {EXP_OPTIONS.map((e, i) => <Chip key={e} label={`${e} yrs`} selected={data.experience_years === i} onClick={() => setData(d => ({ ...d, experience_years: i }))} />)}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Skills & Industries */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">Your superpowers</h2>
              <p className="text-xs text-muted-foreground">{data.skills.length}/15 skills selected</p>
              {Object.entries(SKILL_CATEGORIES).map(([cat, skills]) => (
                <div key={cat}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{cat}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {skills.map(s => <Chip key={s} label={s} selected={data.skills.includes(s)} onClick={() => setData(d => ({ ...d, skills: toggleArray(d.skills, s, 15) }))} size="sm" />)}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={customSkill} onChange={e => setCustomSkill(e.target.value)} placeholder="Add custom skill" className="flex-1" />
                <Button size="sm" variant="outline" disabled={!customSkill.trim() || data.skills.length >= 15} onClick={() => {
                  if (customSkill.trim()) { setData(d => ({ ...d, skills: toggleArray(d.skills, customSkill.trim(), 15) })); setCustomSkill(""); }
                }}>Add</Button>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Industries ({data.industries.length}/5)</p>
                <div className="flex gap-1.5 flex-wrap">
                  {INDUSTRIES.map(i => <Chip key={i} label={i} selected={data.industries.includes(i)} onClick={() => setData(d => ({ ...d, industries: toggleArray(d.industries, i, 5) }))} size="sm" />)}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Looking for / Can offer */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">What you need, what you bring</h2>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">I'm looking for...</p>
                <div className="flex gap-1.5 flex-wrap">
                  {LOOKING_FOR.map(l => <Chip key={l} label={l} selected={data.work_looking_for.includes(l)} onClick={() => setData(d => ({ ...d, work_looking_for: toggleArray(d.work_looking_for, l) }))} />)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">I can offer...</p>
                <div className="flex gap-1.5 flex-wrap">
                  {CAN_OFFER.map(c => <Chip key={c} label={c} selected={data.work_can_offer.includes(c)} onClick={() => setData(d => ({ ...d, work_can_offer: toggleArray(d.work_can_offer, c) }))} />)}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Topics & Values */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">Your vibe</h2>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Topics you enjoy ({data.topics.length}/10)</p>
                <div className="flex gap-1.5 flex-wrap">
                  {TOPICS.map(t => <Chip key={t} label={t} selected={data.topics.includes(t)} onClick={() => setData(d => ({ ...d, topics: toggleArray(d.topics, t, 10) }))} size="sm" />)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Your values (pick up to 4)</p>
                <div className="grid grid-cols-2 gap-2">
                  {VALUES_LIST.map(v => (
                    <button key={v.value} onClick={() => setData(d => ({ ...d, values: toggleArray(d.values, v.value, 4) }))}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${data.values.includes(v.value) ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                      <span className="text-lg">{v.emoji}</span>
                      <span className="text-xs font-medium text-foreground">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: How you work */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">How you work</h2>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Peak hours</p>
                <div className="grid grid-cols-3 gap-2">
                  {PEAK_HOURS.map(p => (
                    <button key={p.value} onClick={() => setData(d => ({ ...d, peak_hours: toggleArray(d.peak_hours, p.value) }))}
                      className={`p-2 rounded-lg border text-center transition-all ${data.peak_hours.includes(p.value) ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                      <p className="text-[10px] font-medium text-foreground">{p.label}</p>
                      <p className="text-[9px] text-muted-foreground">{p.time}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Session length</p>
                <div className="flex gap-2 flex-wrap">
                  {SESSION_LENGTHS.map(s => <Chip key={s} label={s} selected={data.session_length_pref === s} onClick={() => setData(d => ({ ...d, session_length_pref: s }))} />)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Group size</p>
                <div className="flex gap-2 flex-wrap">
                  {GROUP_SIZES.map(g => <Chip key={g} label={g} selected={data.group_size_pref === g} onClick={() => setData(d => ({ ...d, group_size_pref: g }))} />)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Conversation style</p>
                <div className="flex gap-2 flex-wrap">
                  {CONVERSATION_DEPTHS.map(c => <Chip key={c} label={c} selected={data.conversation_depth === c} onClick={() => setData(d => ({ ...d, conversation_depth: c }))} />)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Openness to new people</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground shrink-0">Familiar</span>
                  <Slider value={[data.openness_to_new ?? 3]} onValueChange={([v]) => setData(d => ({ ...d, openness_to_new: v }))} min={1} max={5} step={1} className="flex-1" />
                  <span className="text-[10px] text-muted-foreground shrink-0">New people</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 6: Company (optional) */}
          {step === 6 && (
            <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">Where do you work?</h2>
              <Badge variant="outline" className="text-[10px]">Optional</Badge>
              <Input value={data.company_name || ""} onChange={e => setData(d => ({ ...d, company_name: e.target.value }))} placeholder="Company name" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Show company on my profile</p>
                  <p className="text-[10px] text-muted-foreground">Your company is private by default. Only visible to others if you turn this on.</p>
                </div>
                <Switch checked={data.company_visible} onCheckedChange={v => setData(d => ({ ...d, company_visible: v }))} />
              </div>
            </motion.div>
          )}

          {/* Step 7: Summary */}
          {step === 7 && (
            <motion.div key="s7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <h2 className="font-serif text-xl text-foreground">Your Work DNA</h2>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray={`${data.work_profile_complete}, 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">{Math.round(data.work_profile_complete)}%</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Work DNA</p>
                  <p className="text-xs text-muted-foreground">{data.work_profile_complete >= 80 ? "Looking great!" : "Keep building for better matches"}</p>
                </div>
              </div>

              {/* Summary sections */}
              {data.role_type && (
                <SummaryRow label="Role" value={ROLE_TYPES.find(r => r.value === data.role_type)?.label || data.role_type} step={1} onEdit={setStep} />
              )}
              {data.current_project && <SummaryRow label="Project" value={data.current_project} step={1} onEdit={setStep} />}
              {data.skills.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Skills ({data.skills.length})</p>
                    <button className="text-[10px] text-primary" onClick={() => setStep(2)}>Edit</button>
                  </div>
                  <div className="flex gap-1 flex-wrap">{data.skills.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}</div>
                </div>
              )}
              {data.industries.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Industries</p>
                  <div className="flex gap-1 flex-wrap">{data.industries.map(i => <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>)}</div>
                </div>
              )}
              {data.topics.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Topics</p>
                    <button className="text-[10px] text-primary" onClick={() => setStep(4)}>Edit</button>
                  </div>
                  <div className="flex gap-1 flex-wrap">{data.topics.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
                </div>
              )}
              {data.values.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Values</p>
                  <div className="flex gap-1 flex-wrap">{data.values.map(v => { const vd = VALUES_LIST.find(x => x.value === v); return <Badge key={v} variant="outline" className="text-[10px]">{vd?.emoji} {vd?.label || v}</Badge>; })}</div>
                </div>
              )}

              {/* Empty sections */}
              {data.skills.length === 0 && <EmptySection label="Skills" step={2} onEdit={setStep} />}
              {data.work_looking_for.length === 0 && data.work_can_offer.length === 0 && <EmptySection label="Looking for / Can offer" step={3} onEdit={setStep} />}
              {data.topics.length === 0 && <EmptySection label="Topics & Values" step={4} onEdit={setStep} />}
              {data.peak_hours.length === 0 && <EmptySection label="Work preferences" step={5} onEdit={setStep} />}

              <Button className="w-full" onClick={() => navigate("/me")}>Done</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom nav */}
        {step < TOTAL_STEPS && (
          <div className="flex gap-2 pt-2">
            {step > 1 && <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>Back</Button>}
            {step === 6 && <Button variant="ghost" className="text-xs" onClick={async () => { await saveStep({ company_name: null, company_visible: false }); setStep(7); }}>Skip</Button>}
            <Button className="flex-1" onClick={handleNext} disabled={saving}>
              {saving ? "Saving..." : "Next"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SummaryRow({ label, value, step, onEdit }: { label: string; value: string; step: number; onEdit: (s: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
      <button className="text-[10px] text-primary" onClick={() => onEdit(step)}>Edit</button>
    </div>
  );
}

function EmptySection({ label, step, onEdit }: { label: string; step: number; onEdit: (s: number) => void }) {
  return (
    <button onClick={() => onEdit(step)} className="w-full p-3 rounded-xl border border-dashed border-border text-left hover:bg-muted/50 transition-all">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[10px] text-primary">Add →</p>
    </button>
  );
}
