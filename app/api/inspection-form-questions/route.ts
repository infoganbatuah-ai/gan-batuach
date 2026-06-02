import { createCrudHandlers } from "@/lib/crud-route";
import { inspectionFormQuestionSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "inspection_form_questions",
  read: "inspections:read",
  write: "inspection_forms:write",
  schema: inspectionFormQuestionSchema,
  defaultOrder: "sort_order"
});
