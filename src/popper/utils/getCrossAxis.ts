import type { Axis } from "@floating-ui/core";

export const getCrossAxis = (axis: Axis): Axis => {
  return axis === "x" ? "y" : "x";
};
