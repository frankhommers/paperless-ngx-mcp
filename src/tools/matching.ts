import { z } from "zod";

const algorithms = {
  none: 0,
  any: 1,
  all: 2,
  exact: 3,
  "regular expression": 4,
  fuzzy: 5,
  auto: 6,
} as const;
export const matchingAlgorithm = z
  .enum(["none", "any", "all", "exact", "regular expression", "fuzzy", "auto"])
  .transform((value) => algorithms[value]);
