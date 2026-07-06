import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyEnrollments from "./tools/list-my-courses";
import listMyCertificates from "./tools/list-my-certificates";
import listCourses from "./tools/list-courses";
import getMyProfile from "./tools/get-my-profile";

// The OAuth issuer MUST be the direct Supabase host derived from the project ref.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "coopaiba-mcp",
  title: "Coopaiba EAD",
  version: "0.1.0",
  instructions:
    "Ferramentas da plataforma Coopaiba EAD. Use `list_courses` para explorar o catálogo, `list_my_enrollments` para ver as matrículas do usuário autenticado, `list_my_certificates` para os certificados emitidos e `get_my_profile` para dados do perfil.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCourses, listMyEnrollments, listMyCertificates, getMyProfile],
});
