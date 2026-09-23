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

export const numericMatchingAlgorithm = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
  z.literal(4), z.literal(5), z.literal(6),
]);
