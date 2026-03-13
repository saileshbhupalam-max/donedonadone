/* DESIGN: This is the product — what you bring and seek from the community.
   At least one "looking for" tag is required. */

import type { OnboardingData } from "@/lib/types";
import { TagInput } from "@/components/onboarding/TagInput";

interface Props {
  data: OnboardingData;
  updateData: (d: Partial<OnboardingData>) => void;
}

const LOOKING_SUGGESTIONS = [
  "design feedback", "accountability", "co-founder", "coding help",
  "marketing advice", "writing buddies", "career guidance", "startup feedback",
  "creative energy", "focus partners", "networking", "mentorship",
];

const OFFER_SUGGESTIONS = [
  "design help", "code reviews", "intro to investors", "marketing advice",
  "content writing", "career advice", "hiring help", "startup advice",
  "photography", "fitness tips", "legal advice", "fundraising help",
];

export function Step3GiveGet({ data, updateData }: Props) {
  return (
    <div className="flex flex-col pt-8 gap-8 max-w-sm mx-auto">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl text-foreground">What's your exchange?</h1>
        <p className="text-muted-foreground text-sm">
          donedonadone is about exchange. What do you bring to the table?
        </p>
      </div>

      <TagInput
        label="I'm looking for... *"
        tags={data.looking_for}
        onChange={(tags) => updateData({ looking_for: tags })}
        suggestions={LOOKING_SUGGESTIONS}
        variant="primary"
        placeholder="Type + Enter to add"
      />

      <TagInput
        label="I can offer..."
        tags={data.can_offer}
        onChange={(tags) => updateData({ can_offer: tags })}
        suggestions={OFFER_SUGGESTIONS}
        variant="secondary"
        placeholder="Type + Enter to add"
      />

      <p className="text-xs text-muted-foreground text-center">
        This helps us match you with the right people at your table.
      </p>
    </div>
  );
}
