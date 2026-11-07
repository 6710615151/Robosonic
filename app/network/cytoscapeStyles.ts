import type { SingularElementArgument, StylesheetJson } from "cytoscape";

// Categorical node colours tuned to the HumanoidTH palette (forest background): jade, lime, ivory and
// gold carry the brand; blue, coral, amber and violet keep the ten clusters distinguishable.
const clusterColors: Record<string, string> = {
  healthcare_and_elderly_care: "#3fd39b",
  hospital_service_robots: "#5ab8e8",
  education_robotics: "#b9f45a",
  humanoid_robots: "#ece6d4",
  public_safety_robots: "#ef7a6a",
  research_and_academic_contributions: "#c6a45b",
  media_perspectives: "#7fd8d0",
  owned_inventory: "#e9a04a",
  companies_and_institutions: "#a7b4ae",
  international_robots_shown_in_thailand: "#9a8cf0",
  unknown: "#6b7a74"
};

export function networkStyles(showArrows: boolean, showLabels: boolean, animationsEnabled = true): StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        "background-color": (ele: SingularElementArgument) => clusterColors[String(ele.data("cluster"))] ?? clusterColors.unknown,
        "border-color": "#d9fff0",
        "border-opacity": 0.5,
        "border-width": 1,
        "color": "#e5fff5",
        "font-family": "Inter, system-ui, sans-serif",
        "font-size": 10,
        "height": (ele: SingularElementArgument) => Math.max(12, Math.min(48, 12 + Number(ele.data("degree") ?? 0) * 2 + Number(ele.data("source_count") ?? 0))),
        "label": "",
        "min-zoomed-font-size": 8,
        "opacity": 0.92,
        "overlay-opacity": 0,
        "overlay-padding": 4,
        "text-background-color": "#0b241d",
        "text-background-opacity": 0,
        "text-background-padding": "2px",
        "text-margin-y": -10,
        "text-outline-color": "#0b241d",
        "text-outline-opacity": 0,
        "text-outline-width": 1,
        "text-opacity": 0,
        "text-valign": "top",
        "transition-duration": animationsEnabled ? 220 : 0,
        "transition-property": "width height border-width border-color opacity overlay-opacity text-opacity text-background-opacity text-outline-opacity",
        "transition-timing-function": "ease-out",
        "width": (ele: SingularElementArgument) => Math.max(12, Math.min(48, 12 + Number(ele.data("degree") ?? 0) * 2 + Number(ele.data("source_count") ?? 0)))
      }
    },
    {
      selector: "node.show-label",
      style: {
        "font-size": (ele: SingularElementArgument) => Number(ele.data("important")) ? 11 : 9,
        "label": "data(displayLabel)",
        "text-background-opacity": 0.82,
        "text-opacity": 1,
        "text-outline-opacity": 1
      }
    },
    {
      selector: "node.low-confidence",
      style: {
        "border-color": "#b9f45a",
        "border-style": "dashed",
        "border-width": 2,
        "opacity": 0.68
      }
    },
    {
      selector: "node.private",
      style: {
        "background-blacken": 0.35,
        "border-color": "#fb923c",
        "border-width": 3,
        "shape": "round-rectangle"
      }
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#ffffff",
        "border-width": 4,
        "height": (ele: SingularElementArgument) => Math.max(17, Math.min(58, 17 + Number(ele.data("degree") ?? 0) * 2 + Number(ele.data("source_count") ?? 0))),
        "overlay-color": "#d9fff0",
        "overlay-opacity": 0.12,
        "width": (ele: SingularElementArgument) => Math.max(17, Math.min(58, 17 + Number(ele.data("degree") ?? 0) * 2 + Number(ele.data("source_count") ?? 0)))
      }
    },
    {
      selector: "node.is-dragging",
      style: {
        "border-color": "#ffffff",
        "border-width": 5,
        "height": (ele: SingularElementArgument) => Math.max(20, Math.min(62, 20 + Number(ele.data("degree") ?? 0) * 2 + Number(ele.data("source_count") ?? 0))),
        "overlay-color": "#99f6d4",
        "overlay-opacity": 0.18,
        "z-index": 1200,
        "width": (ele: SingularElementArgument) => Math.max(20, Math.min(62, 20 + Number(ele.data("degree") ?? 0) * 2 + Number(ele.data("source_count") ?? 0)))
      }
    },
    {
      selector: "node.just-dropped, node.pulse",
      style: {
        "border-color": "#c6a45b",
        "border-width": 5,
        "overlay-color": "#c6a45b",
        "overlay-opacity": 0.16
      }
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "color": "#d8fff0",
        "font-size": 9,
        "label": showLabels ? "data(label)" : "",
        "line-color": "#5fc7a0",
        "line-opacity": (ele: SingularElementArgument) => Math.max(0.18, Math.min(0.8, Number(ele.data("confidence") ?? 0.5))),
        "opacity": (ele: SingularElementArgument) => Math.max(0.24, Math.min(0.9, Number(ele.data("confidence") ?? 0.5))),
        "target-arrow-color": "#5fc7a0",
        "target-arrow-shape": showArrows ? "triangle" : "none",
        "text-background-color": "#0b241d",
        "text-background-opacity": 0.85,
        "text-background-padding": "2px",
        "text-outline-color": "#0b241d",
        "text-outline-width": 1,
        "text-opacity": showLabels ? 1 : 0,
        "transition-duration": animationsEnabled ? 200 : 0,
        "transition-property": "line-color target-arrow-color width opacity line-opacity text-opacity",
        "transition-timing-function": "ease-out",
        "width": (ele: SingularElementArgument) => Math.max(1, Math.min(7, Number(ele.data("weight") ?? 1) * 1.25))
      }
    },
    {
      selector: "edge.low-confidence",
      style: {
        "line-style": "dashed",
        "line-color": "#b9f45a",
        "target-arrow-color": "#b9f45a"
      }
    },
    {
      selector: ".faded",
      style: {
        "opacity": 0.08,
        "text-opacity": 0
      }
    },
    {
      selector: ".highlighted",
      style: {
        "opacity": 1,
        "z-index": 999
      }
    },
    {
      selector: "edge.highlighted",
      style: {
        "label": "data(label)",
        "line-color": "#ffffff",
        "target-arrow-color": "#ffffff",
        "text-opacity": 1,
        "width": 4
      }
    },
    {
      selector: "node.highlighted",
      style: {
        "border-color": "#ffffff",
        "border-width": 3
      }
    }
  ];
}
