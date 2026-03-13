import { useState, useEffect, useRef } from "react";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface CreditsBadgeProps {
  balance: number;
  compact?: boolean;
}

export function CreditsBadge({ balance, compact = false }: CreditsBadgeProps) {
  const navigate = useNavigate();
  const [displayBalance, setDisplayBalance] = useState(balance);
  const [animating, setAnimating] = useState(false);
  const prevBalance = useRef(balance);

  useEffect(() => {
    if (balance > prevBalance.current) {
      setAnimating(true);
      // Animate counting up
      const diff = balance - prevBalance.current;
      const steps = Math.min(diff, 20);
      const stepSize = diff / steps;
      let current = prevBalance.current;
      let step = 0;
      const interval = setInterval(() => {
        step++;
        current += stepSize;
        setDisplayBalance(Math.round(current));
        if (step >= steps) {
          clearInterval(interval);
          setDisplayBalance(balance);
          setTimeout(() => setAnimating(false), 600);
        }
      }, 50);
      prevBalance.current = balance;
      return () => clearInterval(interval);
    }
    setDisplayBalance(balance);
    prevBalance.current = balance;
  }, [balance]);

  const formatted = displayBalance.toLocaleString();

  if (compact) {
    return (
      <button
        onClick={() => navigate("/credits")}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
          "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
          "hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-all",
          animating && "scale-110 ring-2 ring-amber-400/50"
        )}
      >
        <Coins className="w-3 h-3" />
        <span>{formatted}</span>
        {animating && (
          <span className="absolute -top-3 right-0 text-[10px] text-amber-600 dark:text-amber-400 font-bold animate-bounce">
            +{balance - displayBalance || "!"}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/credits")}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl",
        "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30",
        "border border-amber-200 dark:border-amber-800",
        "hover:shadow-md transition-all relative",
        animating && "scale-105 shadow-lg shadow-amber-200/50"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-full bg-amber-400 dark:bg-amber-600 flex items-center justify-center",
        animating && "animate-spin"
      )}>
        <Coins className="w-4 h-4 text-white" />
      </div>
      <div className="text-left">
        <p className="text-lg font-bold text-amber-900 dark:text-amber-200 leading-none">
          {formatted}
        </p>
        <p className="text-[10px] text-amber-700 dark:text-amber-400">Focus Credits</p>
      </div>
      {animating && (
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold animate-bounce">
          +FC
        </span>
      )}
    </button>
  );
}
