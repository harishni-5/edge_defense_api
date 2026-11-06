"""
Regenerate every figure used in the paper, at 600 DPI, single-IEEE-column
native size (target display width 3.4in in the paper).

Run from anywhere:
    python3 /home/claude/edge_defense_2/figure_scripts/regen_all_figures.py

Requires: matplotlib, numpy, pandas, shap (for Fig. 3 only -- it recomputes
real SHAP values from the trained model and canonical test data, it does not
use hardcoded numbers).

Output: writes all 9 PNGs into /home/claude/edge_defense_2/figures/,
overwriting the versions currently embedded in the paper.

Fixes applied in this version vs. the original build:
  - Fig. 1: redrawn as a more polished/descriptive "stage card" diagram
    (drop shadows, header bars, stage rail labels, real dataset-size and
    schema annotations pulled from Table II / Section 3.1 of the paper).
  - Fig. 5: legend moved to upper-center with a raised y-limit so it no
    longer overlaps the "Predict only" p99 bar.
  - Fig. 7: y-limit raised so the "50" value label above Wijethilaka et
    al.'s bar is no longer clipped by the axes/title.
  - All: dpi bumped from 300 -> 600.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
import numpy as np
import pickle, warnings, os
warnings.filterwarnings("ignore")

plt.rcParams["font.family"] = "DejaVu Sans"
BASE = "/home/claude/edge_defense_2"
OUT = f"{BASE}/figures"
os.makedirs(OUT, exist_ok=True)
COLW = 3.38   # inches, single IEEE column width
DPI = 600

# ============================================================
# Fig 1 -- architecture / pipeline overview (redesigned)
# ============================================================
fig, ax = plt.subplots(figsize=(COLW, 3.35))
ax.set_xlim(-0.75, 10)
ax.set_ylim(3.6, 15.3)
ax.axis("off")


def card(x, y, w, h, title, subtitle, header_fc, body_fc, edge, fontsize=6.8, sub_fontsize=5.3):
    """A rounded 'card' box with a colored header strip, a drop shadow,
    a bold title, and a lighter descriptive subtitle underneath."""
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

# Real dataset sizes are pulled from Table II (Section 3.1) -- 308,877
# Enterprise rows; 297,091 IoT rows sampled from the 46,776,697-row raw
# CICIoT2023 release.
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
print("fig1 done")

# ============================================================
# Fig 2 -- cross-domain AUC heatmap
# ============================================================
fig, ax = plt.subplots(figsize=(COLW, 2.75))
data = np.array([[0.982, 0.264], [0.553, 0.974], [0.979, 0.971]])
im = ax.imshow(data, cmap="RdYlGn", vmin=0.2, vmax=1.0, aspect="auto")
rows = ["Model A\n(Enterprise)", "Model B\n(IoT)", "Model C\n(Pooled)"]
cols = ["Tested on\nEnterprise", "Tested on\nIoT"]
ax.set_xticks([0, 1]); ax.set_xticklabels(cols, fontsize=7)
ax.set_yticks([0, 1, 2]); ax.set_yticklabels(rows, fontsize=7)
for i in range(3):
    for j in range(2):
        v = data[i, j]
        color = "black" if 0.45 < v < 0.75 else "white"
        ax.text(j, i, f"{v:.3f}", ha="center", va="center", fontsize=10.5, weight="bold", color=color)
ax.set_title("Train-domain × test-domain AUC", fontsize=8.2)
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.ax.tick_params(labelsize=6.5)
cbar.set_label("AUC", fontsize=7)
plt.tight_layout()
plt.savefig(f"{OUT}/fig_cross_domain_heatmap.png", dpi=DPI)
plt.close()
print("fig2 done")

# ============================================================
# Fig 3 -- SHAP summary, Model C, Enterprise + IoT (real SHAP values,
#          recomputed from the trained model, not hardcoded)
# ============================================================
import pandas as pd
import shap

FEATS = ['duration', 'pkt_len_min', 'pkt_len_max', 'pkt_len_mean', 'pkt_len_std', 'total_bytes',
         'byte_rate', 'header_len_total', 'flag_syn', 'flag_fin', 'flag_rst', 'flag_ack',
         'flag_psh', 'is_tcp', 'is_udp']
model_C = pickle.load(open(f"{BASE}/model_C.pkl", "rb"))
e_te = pd.read_csv(f"{BASE}/canonical/e_te.csv")
i_te = pd.read_csv(f"{BASE}/canonical/i_te.csv")

e_sample = e_te.sample(n=500, random_state=0)[FEATS]
i_sample = i_te.sample(n=500, random_state=0)[FEATS]

explainer = shap.TreeExplainer(model_C)
sv_e = explainer.shap_values(e_sample)
sv_i = explainer.shap_values(i_sample)

fig, axes = plt.subplots(2, 1, figsize=(COLW, 4.35))
plt.sca(axes[0])
shap.summary_plot(sv_e, e_sample, show=False, plot_size=None)
axes[0].set_title("Model C — Enterprise test set", fontsize=8)
axes[0].tick_params(labelsize=6)
axes[0].set_xlabel(axes[0].get_xlabel(), fontsize=6.5)

plt.sca(axes[1])
shap.summary_plot(sv_i, i_sample, show=False, plot_size=None)
axes[1].set_title("Model C — IoT test set", fontsize=8)
axes[1].tick_params(labelsize=6)
axes[1].set_xlabel(axes[1].get_xlabel(), fontsize=6.5)

for cax in fig.axes:
    if cax not in axes:
        cax.tick_params(labelsize=5.5)
        cax.set_ylabel(cax.get_ylabel(), fontsize=6)

plt.tight_layout()
plt.savefig(f"{OUT}/fig_shap_combined.png", dpi=DPI, bbox_inches="tight")
plt.close()
print("fig3 done")

# ============================================================
# Fig 4 -- evasion rate vs. perturbation budget
# (values sourced from rescale_evasion_n500_results.json, n=548)
# ============================================================
fig, ax = plt.subplots(figsize=(COLW, 2.6))
eps = [0.10, 0.30]
square = [0.845, 1.0]
hsj = [0.011, 0.088]
ax.plot(eps, square, "-o", color="#B0413E", label="Square-style", markersize=5)
ax.plot(eps, hsj, "-s", color="#3B6FB6", label="HopSkipJump", markersize=5)
ax.axhline(0.184, color="gray", linestyle="--", linewidth=1.1, label="ZOO (budget-unbounded)")
ax.set_xlabel("L∞ perturbation budget (ε)", fontsize=7.5)
ax.set_ylabel("Evasion rate (n=548)", fontsize=7.5)
ax.set_ylim(0, 1.05)
ax.set_xlim(0.05, 0.35)
ax.legend(fontsize=6, loc="center right", frameon=False)
ax.tick_params(labelsize=7)
plt.tight_layout()
plt.savefig(f"{OUT}/fig_evasion_vs_budget.png", dpi=DPI)
plt.close()
print("fig4 done")

# ============================================================
# Fig 5 -- edge latency per tier
# FIX: legend moved to upper-center + ylim raised to 78 so it clears
# the "Predict only" p99 bar (53.61) instead of sitting on top of it.
# ============================================================
fig, ax = plt.subplots(figsize=(COLW, 2.6))
tiers = ["Predict\nonly", "+ SHAP", "+ SHAP\n+ drift"]
mean_v = [4.31, 10.29, 17.49]
p50 = [2.01, 4.90, 10.44]
p95 = [2.90, 56.49, 53.33]
p99 = [53.61, 57.05, 54.54]
x = np.arange(3)
w = 0.2
ax.bar(x - 1.5 * w, mean_v, w, label="mean", color="#7C5CC4")
ax.bar(x - 0.5 * w, p50, w, label="p50", color="#3B6FB6")
ax.bar(x + 0.5 * w, p95, w, label="p95*", color="#E0A339")
ax.bar(x + 1.5 * w, p99, w, label="p99*", color="#B0413E")
ax.set_xticks(x); ax.set_xticklabels(tiers, fontsize=7)
ax.set_ylabel("Latency (ms)", fontsize=7.5)
ax.set_ylim(0, 78)
ax.legend(fontsize=6, ncol=4, frameon=False, loc="upper center")
ax.tick_params(labelsize=7)
plt.tight_layout()
plt.savefig(f"{OUT}/fig_edge_latency.png", dpi=DPI)
plt.close()
print("fig5 done")

# ============================================================
# Fig 6 -- literature comparison, stacked (single column width)
# ============================================================
fig, axes = plt.subplots(2, 1, figsize=(COLW, 4.3))

labels = ["This work\nA→IoT\n(AUC)", "This work\nB→Ent\n(AUC)",
          "This work\nA→IoT\n(Mac-F1)", "This work\nB→Ent\n(Mac-F1)",
          "Elangovan\net al. [4]\n(Mac-F1)", "Pawlicki\net al. [7]\n(tgt F1)"]
vals = [0.264, 0.553, 0.285, 0.306, 0.735, 0.02]
errs = [0, 0, 0, 0, 0.045, 0.02]
colors = ["#3B6FB6", "#3B6FB6", "#5FA37A", "#5FA37A", "#C97A2B", "#B0413E"]
x = np.arange(len(labels))
axes[0].bar(x, vals, yerr=errs, capsize=3, color=colors, width=0.62)
axes[0].axhline(0.5, color="gray", linestyle="--", linewidth=0.8)
axes[0].set_xticks(x)
axes[0].set_xticklabels(labels, fontsize=5.7)
axes[0].set_ylabel("Score (metric noted per bar)", fontsize=7)
axes[0].set_ylim(0, 1.0)
axes[0].set_title("(a) Cross-domain degradation severity across studies", fontsize=7.6)
axes[0].tick_params(axis="y", labelsize=6.5)

groups = ["ZOO-family\n(gradient-based)", "Square-family\n(gradient-free)"]
this_work = [18.4, 92.2]
this_work_err = [0, 7.8]
rk = [7, 63]
rk_err = [5, 7]
xg = np.arange(len(groups))
w = 0.32
axes[1].bar(xg - w / 2, this_work, width=w, yerr=this_work_err, capsize=3,
            label="This work (evasion rate)", color="#B0413E")
axes[1].bar(xg + w / 2, rk, width=w, yerr=rk_err, capsize=3,
            label="Rajhans & Khawarey [14]\n(1 − Robustness Index)", color="#8C8C8C")
axes[1].set_xticks(xg)
axes[1].set_xticklabels(groups, fontsize=7)
axes[1].set_ylabel("Vulnerability (%)", fontsize=7)
axes[1].set_title("(b) Gradient-based vs. gradient-free attacks", fontsize=7.6)
axes[1].legend(fontsize=5.4, loc="upper left", frameon=False)
axes[1].tick_params(axis="y", labelsize=6.5)
axes[1].set_ylim(0, 105)

plt.tight_layout()
plt.savefig(f"{OUT}/fig_lit_comparison.png", dpi=DPI)
plt.close()
print("fig6 done")

# ============================================================
# Fig 7 -- latency literature comparison, log scale
# FIX: ylim raised to 130 (was auto ~tight to 50) so the "50" value
# label above Wijethilaka et al.'s bar has headroom instead of being
# clipped at the top of the axes.
# ============================================================
fig, ax = plt.subplots(figsize=(COLW, 2.7))
studies = ["This work\n(cgroup)", "Diab\net al. [24]", "Haruna\net al. [26]", "Wijethilaka\net al. [25]"]
latency = [4.31, 22, 0.41, 50]
bar_colors = ["#3B6FB6", "#8C8C8C", "#8C8C8C", "#8C8C8C"]
bars = ax.bar(studies, latency, color=bar_colors, width=0.6)
ax.set_yscale("log")
ax.set_ylim(0.2, 130)
ax.set_ylabel("Mean latency (ms, log)", fontsize=7.3)
ax.tick_params(axis="x", labelsize=6.2)
ax.tick_params(axis="y", labelsize=7)
for b, v in zip(bars, latency):
    ax.text(b.get_x() + b.get_width() / 2, v * 1.25, f"{v:g}", ha="center", fontsize=6.8)
ax.set_title("Edge latency across studies (different hardware)", fontsize=7.2)
plt.tight_layout()
plt.savefig(f"{OUT}/fig_latency_comparison.png", dpi=DPI)
plt.close()
print("fig7 done")

print("\nAll figures regenerated at", DPI, "dpi into", OUT)
