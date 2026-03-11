import { useParams, Navigate } from "react-router-dom";
import { useEffect } from "react";

export function InviteRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (code) localStorage.setItem("fc_ref", code);
  }, [code]);

  return <Navigate to={`/?ref=${code}`} replace />;
}
