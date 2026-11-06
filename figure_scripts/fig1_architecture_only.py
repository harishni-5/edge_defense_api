"""
Standalone regenerator for JUST Fig. 1 (the pipeline/architecture diagram).
Use this if you want to tweak colors, labels, or layout without touching
anything else -- it has no dependency on the model/data files, only
matplotlib.

Run:
    python3 /home/claude/edge_defense_2/figure_scripts/fig1_architecture_only.py

Output:
    /home/claude/edge_defense_2/figures/fig1_architecture.png (600 dpi)
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
import os

plt.rcParams["font.family"] = "DejaVu Sans"
OUT = "/home/claude/edge_defense_2/figures"
os.makedirs(OUT, exist_ok=True)
COLW = 3.38
DPI = 600

fig, ax = plt.subplots(figsize=(COLW, 3.35))
ax.set_xlim(-0.75, 10)
ax.set_ylim(3.6, 15.3)
ax.axis("off")


def card(x, y, w, h, title, subtitle, header_fc, body_fc, edge, fontsize=6.8, sub_fontsize=5.3):
    shadow = FancyBboxPatch((x + 0.09, y - 0.09), w, h,
                             boxstyle="round,pad=0.03,rounding_size=0.11",
                             linewidth=0, facecolor="#000000", alpha=0.13, zorder=1)
    ax.add_patch(shadow)
    body = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.03,rounding_size=0.11",
                           linewidth=1.1, edgecolor=edge, facecolor=body_fc, zorder=2)
    ax.add_patch(body)
    strip_h = min(0.34, h * 0.28)
    strip = Rectangle((x + 0.14, y + h - strip_h - 0.06), w - 0.28, strip_h,
                       linewidth=0, facecolor=header_fc, alpha=0.92, zorder=3)
    ax.add_patch(strip)
    ax.text(x + w / 2, y + h - strip_h / 2 - 0.06, title, ha="center", va="center",
            fontsize=fontsize, weight="bold", color="white", zorder=4)
    ax.text(x + w / 2, y + (h - strip_h - 0.06) / 2, subtitle, ha="center", va="center",
            fontsize=sub_fontsize, color="#3A3A3A", zorder=4, linespacing=1.35)
    return (x, y, w, h)


def varrow(b1, b2, color="#5A5A5A", rad=0.0):
    x1, y1, w1, h1 = b1
    x2, y2, w2, h2 = b2
    p1 = (x1 + w1 / 2, y1)
    p2 = (x2 + w2 / 2, y2 + h2)
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="-|>", mutation_scale=9,
                                  linewidth=1.3, color=color, zorder=1,
                                  connectionstyle=f"arc3,rad={rad}",
                                  shrinkA=1, shrinkB=1))


def rail(y_center, label, color):
    ax.text(-0.55, y_center, label, ha="center", va="center", fontsize=5.6,
            rotation=90, weight="bold", color=color, alpha=0.75)


BLUE, BLUE_FILL = "#2E5FA3", "#E9F1FB"
VIOLET, VIOLET_FILL = "#6A4FC2", "#EFEAFB"
GREEN, GREEN_FILL = "#2E8B57", "#E7F5EC"
RED, RED_FILL = "#B0413E", "#FBEAE9"
AMBER, AMBER_FILL = "#C97A2B", "#FCEEDF"
GOLD, GOLD_FILL = "#B8860B", "#FFF7DE"

# Dataset sizes are the real numbers from Table II / Section 3.1 of the
# paper -- edit here if the underlying dataset changes.
b_ent = card(0.15, 13.35, 4.4, 1.55, "Enterprise traffic", "CIC-IDS2018\n308,877 rows",
             BLUE, BLUE_FILL, BLUE)
b_iot = card(5.45, 13.35, 4.4, 1.55, "IoT traffic", "CICIoT2023\n297,091 rows (of 46.8M)",
             BLUE, BLUE_FILL, BLUE)
rail(14.1, "DATA", BLUE)

b_schema = card(1.6, 11.1, 6.8, 1.45, "Canonical schema", "15 shared features · log1p-scaled",
                BLUE, BLUE_FILL, BLUE)
varrow(b_ent, b_schema)
varrow(b_iot, b_schema)
rail(11.8, "UNIFY", BLUE)

b_train = card(1.6, 8.85, 6.8, 1.5, "XGBoost training", "Model A (Ent) · B (IoT) · C (Pooled)",
               VIOLET, VIOLET_FILL, VIOLET)
varrow(b_schema, b_train)
rail(9.6, "TRAIN", VIOLET)

b_shap = card(0.05, 6.35, 3.15, 1.75, "Explainability", "SHAP\n+ LIME",
              GREEN, GREEN_FILL, GREEN, fontsize=6.4, sub_fontsize=5.3)
b_adv = card(3.45, 6.35, 3.15, 1.75, "Adversarial test", "ZOO · Square\n· HopSkipJump",
             RED, RED_FILL, RED, fontsize=6.4, sub_fontsize=5.0)
b_edge = card(6.85, 6.35, 3.1, 1.75, "Edge benchmark", "cgroup-\nconstrained",
              AMBER, AMBER_FILL, AMBER, fontsize=6.4, sub_fontsize=5.3)
varrow(b_train, b_shap, rad=-0.12)
varrow(b_train, b_adv)
varrow(b_train, b_edge, rad=0.12)
rail(7.2, "ANALYZE", RED)

b_drift = card(1.6, 3.95, 6.8, 1.6, "SHAP-PSI drift monitor", "batch-level distributional alarm",
               GOLD, GOLD_FILL, GOLD)
varrow(b_shap, b_drift, rad=-0.18)
varrow(b_adv, b_drift, rad=0.0)
rail(4.75, "MONITOR", GOLD)

plt.subplots_adjust(left=0.03, right=0.98, top=0.99, bottom=0.01)
plt.savefig(f"{OUT}/fig1_architecture.png", dpi=DPI)
plt.close()
print("fig1_architecture.png regenerated at", DPI, "dpi ->", f"{OUT}/fig1_architecture.png")
