import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function CourseShortLink() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      if (!code) return;
      const { data } = await supabase.rpc("resolve_course_short_code", { _code: code });
      if (!active) return;
      if (data) navigate(`/courses/${data}`, { replace: true });
      else navigate("/courses", { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
