INSERT INTO "PlanTemplate"
  ("plan","desks","users","gateways","locations",
   "ota","sso","smtp","api","updatedAt")
VALUES
  ('free', 5, 15, 0, 1, false, false, false, false, NOW())
ON CONFLICT ("plan") DO NOTHING;
