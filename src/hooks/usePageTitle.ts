import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => { document.title = "DanaDone — Find your people. Focus together."; };
  }, [title]);
}
