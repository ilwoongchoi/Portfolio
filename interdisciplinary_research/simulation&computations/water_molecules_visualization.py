import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.colors import LinearSegmentedColormap
import json
import math

# Constants from MATHEMATICAL_UNIVERSE_REPRESENTATION.txt
K = 0.03125
T = 1.583630453357918
DIELECTRIC_CONSTANT = 12.13
TOTAL_NODES = 57906500

def calculate_node_properties(n):
    """Calculate FLUX, TUNNEL, DEPTH, LOCAL_R for a given node n"""
    FLUX = K * (1 + n * 0.001)
    TUNNEL = T * math.sin(FLUX)
    DEPTH = 0.611260466978 * FLUX
    LOCAL_R = DIELECTRIC_CONSTANT * (FLUX ** 2)
    PHASE = 1 if TUNNEL > 0 else (-1 if TUNNEL < 0 else 0)
    return FLUX, TUNNEL, DEPTH, LOCAL_R, PHASE

def load_parameters():
    """Load parameters from JSON file"""
    try:
        with open('verified_hole_filling_parameters_20251228_085605.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load parameters file: {e}")
        return None

print("Calculating water molecule states from mathematical universe representation...")
print(f"Total nodes (water molecules) to process: {TOTAL_NODES:,}")

# Sample nodes for visualization (can't visualize all 57M points)
# We'll create a representative visualization
SAMPLE_SIZE = 100000  # Sample 100k points for visualization
STEP = TOTAL_NODES // SAMPLE_SIZE

print(f"Sampling {SAMPLE_SIZE:,} molecules for visualization (every {STEP}th molecule)")

# Calculate properties for sampled nodes
flux_values = []
tunnel_values = []
depth_values = []
r_values = []
phase_values = []
node_indices = []

for i in range(0, TOTAL_NODES, STEP):
    n = i + 1  # Node numbers start at 1
    FLUX, TUNNEL, DEPTH, LOCAL_R, PHASE = calculate_node_properties(n)
    
    flux_values.append(FLUX)
    tunnel_values.append(TUNNEL)
    depth_values.append(DEPTH)
    r_values.append(LOCAL_R)
    phase_values.append(PHASE)
    node_indices.append(n)

flux_values = np.array(flux_values)
tunnel_values = np.array(tunnel_values)
depth_values = np.array(depth_values)
r_values = np.array(r_values)
phase_values = np.array(phase_values)

# Normalize for visualization
flux_norm = (flux_values - flux_values.min()) / (flux_values.max() - flux_values.min())
depth_norm = (depth_values - depth_values.min()) / (depth_values.max() - depth_values.min())
r_norm = np.log10(r_values + 1)  # Log scale for R values
r_norm = (r_norm - r_norm.min()) / (r_norm.max() - r_norm.min())

# Create ocean-like visualization
# Use DEPTH as vertical position (like ocean depth)
# Use FLUX as horizontal position
# Use TUNNEL/PHASE for color (LIGHT/SHADOW phases)

fig = plt.figure(figsize=(20, 12))
ax = fig.add_subplot(111)

# Create color map: blue for water molecules
# Lighter blue for LIGHT phase, darker blue for SHADOW phase
colors = []
for phase, tunnel in zip(phase_values, tunnel_values):
    if phase == 1:  # LIGHT phase
        # Lighter blue
        colors.append((0.3, 0.6, 0.9, 0.7))
    elif phase == -1:  # SHADOW phase
        # Darker blue
        colors.append((0.1, 0.3, 0.7, 0.7))
    else:  # BOUNDARY
        colors.append((0.5, 0.5, 0.5, 0.5))

colors = np.array(colors)

# Create scatter plot representing water molecules
# X-axis: FLUX (horizontal position in ocean)
# Y-axis: DEPTH (depth in ocean)
# Size: Based on LOCAL_R (larger R = larger molecule representation)
# Color: Based on PHASE (LIGHT/SHADOW)

scatter = ax.scatter(
    flux_norm * 100,  # Scale for better visualization
    depth_norm * 100,  # Scale for better visualization
    s=r_norm * 50 + 5,  # Size based on R value
    c=colors,
    alpha=0.6,
    edgecolors='none',
    linewidths=0
)

ax.set_xlabel('Ocean Position (FLUX-based)', fontsize=14, fontweight='bold')
ax.set_ylabel('Ocean Depth (DEPTH-based)', fontsize=14, fontweight='bold')
ax.set_title(f'Water Molecules in Ocean\nTotal Count: {TOTAL_NODES:,} molecules\nVisualized: {SAMPLE_SIZE:,} molecules', 
             fontsize=16, fontweight='bold', pad=20)

# Add grid
ax.grid(True, alpha=0.3, linestyle='--')

# Add color legend
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor=(0.3, 0.6, 0.9, 0.7), label='LIGHT Phase Molecules'),
    Patch(facecolor=(0.1, 0.3, 0.7, 0.7), label='SHADOW Phase Molecules'),
    Patch(facecolor=(0.5, 0.5, 0.5, 0.5), label='Phase Boundary Molecules')
]
ax.legend(handles=legend_elements, loc='upper right', fontsize=12)

# Add statistics text box
stats_text = f"""Statistics:
Total Molecules: {TOTAL_NODES:,}
FLUX Range: {flux_values.min():.3f} - {flux_values.max():.3f}
DEPTH Range: {depth_values.min():.3f} - {depth_values.max():.3f}
R Range: {r_values.min():.2e} - {r_values.max():.2e}
LIGHT Phase: {np.sum(phase_values == 1):,}
SHADOW Phase: {np.sum(phase_values == -1):,}"""

ax.text(0.02, 0.98, stats_text, transform=ax.transAxes,
        fontsize=10, verticalalignment='top',
        bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))

plt.tight_layout()
plt.savefig('water_molecules_ocean.png', dpi=300, bbox_inches='tight')
print(f"\nVisualization saved as 'water_molecules_ocean.png'")
print(f"Total water molecules counted: {TOTAL_NODES:,}")

# Also create a more detailed 3D-like visualization
fig2 = plt.figure(figsize=(20, 12))
ax2 = fig2.add_subplot(111, projection='3d')

# 3D scatter plot
scatter3d = ax2.scatter(
    flux_norm * 100,
    tunnel_values,  # TUNNEL as second dimension
    depth_norm * 100,
    c=colors,
    s=r_norm * 30 + 3,
    alpha=0.5
)

ax2.set_xlabel('FLUX Position', fontsize=12, fontweight='bold')
ax2.set_ylabel('TUNNEL Value', fontsize=12, fontweight='bold')
ax2.set_zlabel('DEPTH', fontsize=12, fontweight='bold')
ax2.set_title(f'3D Water Molecule State Representation\nTotal: {TOTAL_NODES:,} molecules', 
              fontsize=16, fontweight='bold', pad=20)

plt.tight_layout()
plt.savefig('water_molecules_ocean_3d.png', dpi=300, bbox_inches='tight')
print(f"3D visualization saved as 'water_molecules_ocean_3d.png'")

print("\n" + "="*60)
print(f"FINAL COUNT: {TOTAL_NODES:,} WATER MOLECULES IN OCEAN")
print("="*60)

