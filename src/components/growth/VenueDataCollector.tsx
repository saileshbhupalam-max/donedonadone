import { useState, useCallback } from "react";
import { Camera, Upload, Wifi, Volume2, Coins, Zap, ChevronRight, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { submitVenueContribution, type ContributionType, type ContributionData } from "@/lib/venueContributions";
import { awardCredits } from "@/lib/focusCredits";

type SectionContribution = {
  type: ContributionType;
  data: ContributionData;
};

const SECTION_KEY_MAP: Record<string, ContributionType[]> = {
  photos: ['photo'],
  basic: ['seating_report', 'floor_count', 'parking'],
  amenities: ['amenities'],
  food: ['food_options'],
  companies: ['company_presence'],
  wifi: ['wifi_report'],
  noise: ['noise_report'],
};

async function submitSectionData(
  userId: string,
  venueId: string,
  sectionKey: string,
  contributions: SectionContribution[]
): Promise<{ creditsEarned: number; bonusMultiplier: number }> {
  let totalCredits = 0;

  for (const { type, data } of contributions) {
    const result = await submitVenueContribution(userId, venueId, type, data);
    if (result.success) {
      totalCredits += result.creditsAwarded;
    }
  }

  // Variable reward: 12% chance of 2x or 3x bonus (behavioral design)
  const bonus = Math.random() < 0.12 ? (Math.random() < 0.5 ? 2 : 3) : 1;
  if (bonus > 1) {
    const bonusAmount = totalCredits * (bonus - 1);
    await awardCredits(userId, 'report_venue_info', bonusAmount, {
      venue_id: venueId,
      bonus_multiplier: bonus,
      section: sectionKey,
    });
    totalCredits *= bonus;
  }

  return { creditsEarned: totalCredits, bonusMultiplier: bonus };
}

interface VenueDataCollectorProps {
  venueId: string;
  venueName: string;
  userId: string;
  trigger?: React.ReactNode;
  onComplete?: () => void;
}

interface SectionDef {
  key: string;
  label: string;
  reward: number;
  why: string;
}

const SECTIONS: SectionDef[] = [
  { key: "photos", label: "Photos", reward: 5, why: "Helps others decide to visit" },
  { key: "basic", label: "Basic info", reward: 5, why: "Seats & floors help us plan group sizes" },
  { key: "amenities", label: "Amenities", reward: 10, why: "Workers choose venues by amenities" },
  { key: "food", label: "Food & Drinks", reward: 5, why: "Coffee quality matters!" },
  { key: "companies", label: "Companies present", reward: 10, why: "Networking is a top reason to join" },
  { key: "wifi", label: "WiFi details", reward: 10, why: "The #1 remote worker need" },
  { key: "noise", label: "Noise level", reward: 5, why: "Match noise preference to venue" },
];

const AMENITY_OPTIONS = [
  "Power outlets", "AC", "Natural light", "Standing desks",
  "Meeting rooms", "Locker storage", "Outdoor seating",
];

export function VenueDataCollector({ venueId, venueName, userId, trigger, onComplete }: VenueDataCollectorProps) {
  const [open, setOpen] = useState(false);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [earnedFC, setEarnedFC] = useState(0);
  const [lastBonus, setLastBonus] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Form state
  const [photos, setPhotos] = useState<File[]>([]);
  const [seatingCapacity, setSeatingCapacity] = useState("");
  const [floors, setFloors] = useState("");
  const [parking, setParking] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<Set<string>>(new Set());
  const [hasMenu, setHasMenu] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [specialtyCoffee, setSpecialtyCoffee] = useState<string | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [companyInput, setCompanyInput] = useState("");
  const [wifiSpeed, setWifiSpeed] = useState<string | null>(null);
  const [wifiPassword, setWifiPassword] = useState<string | null>(null);
  const [wifiReliable, setWifiReliable] = useState<string | null>(null);
  const [noiseLevel, setNoiseLevel] = useState<string | null>(null);
  const [noiseTime, setNoiseTime] = useState<string | null>(null);

  const totalPossible = SECTIONS.reduce((a, b) => a + b.reward, 0);

  const completeSection = useCallback(async (key: string) => {
    const contributions: SectionContribution[] = [];

    switch (key) {
      case 'photos':
        for (const photo of photos) {
          contributions.push({
            type: 'photo',
            data: { photo_url: photo.name, photo_size_kb: Math.round(photo.size / 1024) },
          });
        }
        break;
      case 'basic':
        if (seatingCapacity) {
          contributions.push({
            type: 'seating_report',
            data: { seating_count: parseInt(seatingCapacity, 10) },
          });
        }
        if (floors) {
          contributions.push({
            type: 'floor_count',
            data: { floor_count: parseInt(floors, 10) },
          });
        }
        if (parking) {
          contributions.push({
            type: 'parking',
            data: { parking_type: parking },
          });
        }
        break;
      case 'amenities':
        contributions.push({
          type: 'amenities',
          data: { amenities: Array.from(amenities) },
        });
        break;
      case 'food':
        contributions.push({
          type: 'food_options',
          data: {
            food_options: [hasMenu, priceRange, specialtyCoffee].filter(Boolean) as string[],
            has_menu: hasMenu,
            price_range: priceRange,
            specialty_coffee: specialtyCoffee,
          },
        });
        break;
      case 'companies':
        for (const company of companies) {
          contributions.push({
            type: 'company_presence',
            data: { company_name: company },
          });
        }
        break;
      case 'wifi':
        contributions.push({
          type: 'wifi_report',
          data: {
            wifi_speed: wifiSpeed,
            wifi_password_required: wifiPassword,
            wifi_reliable: wifiReliable,
          },
        });
        break;
      case 'noise':
        contributions.push({
          type: 'noise_report',
          data: {
            noise_level: noiseLevel,
            noise_time: noiseTime,
          },
        });
        break;
    }

    const result = await submitSectionData(userId, venueId, key, contributions);
    setCompletedSections((prev) => new Set(prev).add(key));
    setEarnedFC((prev) => prev + result.creditsEarned);
    if (result.bonusMultiplier > 1) {
      setLastBonus(`${result.bonusMultiplier}x bonus!`);
      setTimeout(() => setLastBonus(null), 3000);
    }
    setActiveSection(null);
  }, [venueId, userId, photos, seatingCapacity, floors, parking, amenities, hasMenu, priceRange, specialtyCoffee, companies, wifiSpeed, wifiPassword, wifiReliable, noiseLevel, noiseTime]);

  const Pills = ({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) => (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)} className={cn(
          "px-3 py-1.5 rounded-full text-sm border transition-all",
          value === opt ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:border-primary/50"
        )}>
          {opt}
        </button>
      ))}
    </div>
  );

  const renderSection = (key: string) => {
    switch (key) {
      case "photos":
        return (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-6 border-2 border-dashed rounded-lg">
              <Camera className="w-8 h-8 text-muted-foreground" />
              <label className="cursor-pointer">
                <span className="text-sm text-primary font-medium">Upload photos (+5 FC each)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPhotos((prev) => [...prev, ...files]);
                }} />
              </label>
            </div>
            {photos.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">{photos.length} photo(s) selected</p>
                <Button size="sm" onClick={() => completeSection("photos")}>Submit photos</Button>
              </>
            )}
          </div>
        );
      case "basic":
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Seating capacity (approx)</label>
              <input type="number" value={seatingCapacity} onChange={(e) => setSeatingCapacity(e.target.value)} placeholder="e.g. 30" className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Number of floors</label>
              <input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} placeholder="e.g. 2" className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Parking available?</label>
              <Pills options={["Yes", "No", "Street only"]} value={parking} onChange={setParking} />
            </div>
            {seatingCapacity && floors && parking && (
              <Button size="sm" onClick={() => completeSection("basic")}>Submit</Button>
            )}
          </div>
        );
      case "amenities":
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <button key={a} onClick={() => setAmenities((prev) => {
                  const next = new Set(prev);
                  next.has(a) ? next.delete(a) : next.add(a);
                  return next;
                })} className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-all",
                  amenities.has(a) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border"
                )}>
                  {amenities.has(a) ? <Check className="w-3 h-3 inline mr-1" /> : null}{a}
                </button>
              ))}
            </div>
            {amenities.size > 0 && (
              <Button size="sm" onClick={() => completeSection("amenities")}>Submit ({amenities.size} selected)</Button>
            )}
          </div>
        );
      case "food":
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Menu available?</label>
              <Pills options={["Full menu", "Snacks only", "No food"]} value={hasMenu} onChange={setHasMenu} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price range</label>
              <Pills options={["Budget", "Moderate", "Premium"]} value={priceRange} onChange={setPriceRange} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Specialty coffee?</label>
              <Pills options={["Yes", "No"]} value={specialtyCoffee} onChange={setSpecialtyCoffee} />
            </div>
            {hasMenu && priceRange && (
              <Button size="sm" onClick={() => completeSection("food")}>Submit</Button>
            )}
          </div>
        );
      case "companies":
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input value={companyInput} onChange={(e) => setCompanyInput(e.target.value)} placeholder="Company or team name" className="flex-1 px-3 py-2 rounded-md border bg-background text-sm" onKeyDown={(e) => {
                if (e.key === "Enter" && companyInput.trim()) {
                  setCompanies((prev) => [...prev, companyInput.trim()]);
                  setCompanyInput("");
                }
              }} />
              <Button size="sm" variant="outline" onClick={() => {
                if (companyInput.trim()) {
                  setCompanies((prev) => [...prev, companyInput.trim()]);
                  setCompanyInput("");
                }
              }}>Add</Button>
            </div>
            {companies.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1">
                  {companies.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                      {c}
                      <button onClick={() => setCompanies((prev) => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={() => completeSection("companies")}>Submit</Button>
              </>
            )}
          </div>
        );
      case "wifi":
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Speed</label>
              <Pills options={["Fast", "Moderate", "Slow"]} value={wifiSpeed} onChange={setWifiSpeed} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Requires password?</label>
              <Pills options={["Yes", "No", "Open network"]} value={wifiPassword} onChange={setWifiPassword} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reliable?</label>
              <Pills options={["Very", "Mostly", "Spotty"]} value={wifiReliable} onChange={setWifiReliable} />
            </div>
            {wifiSpeed && wifiReliable && (
              <Button size="sm" onClick={() => completeSection("wifi")}>Submit</Button>
            )}
          </div>
        );
      case "noise":
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Noise level</label>
              <Pills options={["Quiet", "Moderate", "Lively"]} value={noiseLevel} onChange={setNoiseLevel} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Time observed</label>
              <Pills options={["Morning", "Afternoon", "Evening"]} value={noiseTime} onChange={setNoiseTime} />
            </div>
            {noiseLevel && noiseTime && (
              <Button size="sm" onClick={() => completeSection("noise")}>Submit</Button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || <Button variant="outline">Contribute venue data</Button>}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-lg">{venueName}</SheetTitle>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Contribute and earn Focus Credits</p>
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <Coins className="w-4 h-4" />
              <span>Up to {totalPossible} FC</span>
            </div>
          </div>
          {/* Endowed progress bar starting at 20% */}
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-gradient-to-r from-amber-400 to-yellow-400 h-2 rounded-full transition-all duration-700"
              style={{ width: `${20 + (completedSections.size / SECTIONS.length) * 80}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedSections.size === 0
              ? "Already 20% there -- pick any section to start!"
              : `${completedSections.size}/${SECTIONS.length} sections completed -- ${earnedFC} FC earned`}
          </p>
        </SheetHeader>

        {/* Variable reward bonus notification */}
        {lastBonus && (
          <div className="mx-4 mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{lastBonus}</p>
          </div>
        )}

        <div className="p-4 space-y-2">
          {SECTIONS.map((section) => {
            const done = completedSections.has(section.key);
            const isActive = activeSection === section.key;

            return (
              <div key={section.key} className={cn(
                "border rounded-lg transition-all",
                done ? "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" : "border-border"
              )}>
                <button
                  className="w-full flex items-center justify-between p-3 text-sm"
                  onClick={() => setActiveSection(isActive ? null : section.key)}
                  disabled={done}
                >
                  <div>
                    <span className={cn("font-medium", done && "text-green-700 dark:text-green-400")}>
                      {done ? "\u2713 " : ""}{section.label}
                    </span>
                    {!done && <p className="text-[10px] text-muted-foreground">{section.why}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Done</span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">+{section.reward} FC</span>
                    )}
                    {!done && <ChevronRight className={cn("w-4 h-4 transition-transform", isActive && "rotate-90")} />}
                  </div>
                </button>
                {isActive && !done && (
                  <div className="px-3 pb-3">{renderSection(section.key)}</div>
                )}
              </div>
            );
          })}

          {/* Social proof */}
          <p className="text-xs text-center text-muted-foreground pt-3">
            23 members have contributed data for this venue
          </p>

          {completedSections.size >= 3 && (
            <div className="text-center pt-3">
              <Button onClick={() => { setOpen(false); onComplete?.(); }} className="w-full">
                Finish contributing ({earnedFC} FC earned)
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
