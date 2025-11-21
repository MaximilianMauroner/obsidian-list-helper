import type { Placement, Side } from "@floating-ui/core";

export const getBasePlacement = (placement: Placement): Side => {
  return placement.split("-")[0] as Side;
};
