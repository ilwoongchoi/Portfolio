"""
3D Landscape Viewer and Simulation
Interactive 3D visualization with temporal simulation capabilities
"""

import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.animation import FuncAnimation
from matplotlib.colors import LinearSegmentedColormap
from landscape_generator import LandscapeGenerator, LandscapeParams
import time


class Landscape3DViewer:
    """3D visualization and simulation of landscapes"""
    
    def __init__(self, generator: LandscapeGenerator):
        self.generator = generator
        self.fig = None
        self.ax = None
        self.surface = None
        self.time_step = 0
        self.simulation_data = []
        
    def create_3d_terrain(self, show_vegetation=True, show_water=True):
        """Create 3D terrain visualization"""
        if self.generator.heightmap is None:
            self.generator.generate()
        
        # Create coordinate grids
        x = np.arange(self.generator.params.width)
        y = np.arange(self.generator.params.height)
        X, Y = np.meshgrid(x, y)
        Z = self.generator.heightmap
        
        # Create figure
        self.fig = plt.figure(figsize=(14, 10))
        self.ax = self.fig.add_subplot(111, projection='3d')
        
        # Color map based on vegetation/water
        if show_vegetation and self.generator.vegetation_map is not None:
            colors = self._get_vegetation_colors()
        else:
            # Use elevation-based coloring
            colors = self._get_elevation_colors()
        
        # Create surface plot
        self.surface = self.ax.plot_surface(
            X, Y, Z,
            facecolors=colors,
            shade=True,
            alpha=0.9,
            linewidth=0,
            antialiased=True
        )
        
        # Add water/bog pools if enabled
        if show_water and self.generator.water_saturation is not None:
            self._add_water_features(X, Y, Z)
        
        # Set labels and title
        self.ax.set_xlabel('X (meters)', fontsize=10)
        self.ax.set_ylabel('Y (meters)', fontsize=10)
        self.ax.set_zlabel('Elevation (meters)', fontsize=10)
        self.ax.set_title(
            f'{self.generator.params.landscape_type.capitalize()} Landscape - 3D View',
            fontsize=14,
            fontweight='bold'
        )
        
        # Set viewing angle
        self.ax.view_init(elev=45, azim=45)
        
        # Add colorbar
        self._add_colorbar()
        
        plt.tight_layout()
        return self.fig, self.ax
    
    def _get_vegetation_colors(self):
        """Get colors based on vegetation map"""
        palette = self.generator.COLOR_PALETTES[self.generator.params.landscape_type]
        palette_list = list(palette.values())
        
        colors = np.zeros((self.generator.params.height, self.generator.params.width, 3))
        
        for y in range(self.generator.params.height):
            for x in range(self.generator.params.width):
                veg_type = self.generator.vegetation_map[y, x]
                base_color = np.array(palette_list[veg_type]) / 255.0
                
                # Add elevation-based shading
                elevation_factor = (self.generator.heightmap[y, x] - 
                                   self.generator.heightmap.min()) / \
                                  (self.generator.heightmap.max() - 
                                   self.generator.heightmap.min())
                brightness = 0.7 + elevation_factor * 0.3
                
                colors[y, x] = np.clip(base_color * brightness, 0, 1)
        
        return colors
    
    def _get_elevation_colors(self):
        """Get colors based on elevation"""
        # Create terrain colormap
        terrain_cmap = plt.cm.get_cmap('terrain')
        normalized = (self.generator.heightmap - self.generator.heightmap.min()) / \
                    (self.generator.heightmap.max() - self.generator.heightmap.min())
        colors = terrain_cmap(normalized)
        return colors
    
    def _add_water_features(self, X, Y, Z):
        """Add water/bog pool visualization"""
        water_mask = self.generator.water_saturation > 0.85
        
        if np.any(water_mask):
            # Use scatter plot for water pools (more reliable than masked surface)
            water_x = X[water_mask]
            water_y = Y[water_mask]
            water_z = Z[water_mask] - 0.5  # Slightly below surface
            
            # Plot water pools as blue points
            self.ax.scatter(
                water_x, water_y, water_z,
                c='blue',
                alpha=0.4,
                s=10  # Point size
            )
    
    def _add_colorbar(self):
        """Add colorbar legend"""
        # Create a dummy plot for colorbar
        sm = plt.cm.ScalarMappable(
            cmap=plt.cm.get_cmap('terrain'),
            norm=plt.Normalize(
                vmin=self.generator.heightmap.min(),
                vmax=self.generator.heightmap.max()
            )
        )
        sm.set_array([])
        self.fig.colorbar(sm, ax=self.ax, shrink=0.5, aspect=20, label='Elevation (m)')
    
    def show(self, interactive=True):
        """Display the 3D landscape"""
        if self.fig is None:
            self.create_3d_terrain()
        
        if interactive:
            # Enable interactive rotation
            plt.ion()
            plt.show()
            print("\n3D View Controls:")
            print("  - Click and drag to rotate")
            print("  - Scroll to zoom")
            print("  - Right-click and drag to pan")
            print("  - Close window to exit")
        else:
            plt.show()
    
    def save_3d_image(self, filename, dpi=150, angle_elev=45, angle_azim=45):
        """Save 3D view as image"""
        if self.fig is None:
            self.create_3d_terrain()
        
        self.ax.view_init(elev=angle_elev, azim=angle_azim)
        plt.savefig(filename, dpi=dpi, bbox_inches='tight')
        print(f"Saved 3D view to {filename}")
    
    def animate_rotation(self, filename=None, frames=36, interval=100):
        """Animate rotating 3D view"""
        if self.fig is None:
            self.create_3d_terrain()
        
        def update(frame):
            self.ax.view_init(elev=45, azim=frame * 10)
            return self.surface,
        
        anim = FuncAnimation(
            self.fig, update, frames=frames, interval=interval, blit=False
        )
        
        if filename:
            anim.save(filename, writer='pillow', fps=10)
            print(f"Saved rotation animation to {filename}")
        else:
            plt.show()
        
        return anim


class LandscapeSimulator:
    """Temporal simulation of landscape evolution"""
    
    def __init__(self, generator: LandscapeGenerator):
        self.generator = generator
        self.time = 0  # Simulation time (years)
        self.history = []
        self.simulation_params = {
            'succession_rate': 0.01,  # Vegetation change per year
            'peat_accumulation_rate': 0.02,  # Meters per year in wet areas
            'erosion_rate': 0.001,  # Elevation loss per year on steep slopes
            'water_table_fluctuation': 0.1,  # Seasonal variation
            'management_effects': True
        }
    
    def simulate_step(self, years=1):
        """Simulate one time step"""
        self.time += years
        
        # Store current state
        state = {
            'time': self.time,
            'heightmap': self.generator.heightmap.copy(),
            'water_saturation': self.generator.water_saturation.copy(),
            'peat_depth': self.generator.peat_depth.copy(),
            'vegetation_map': self.generator.vegetation_map.copy()
        }
        self.history.append(state)
        
        # Apply simulation effects
        self._apply_peat_accumulation(years)
        self._apply_erosion(years)
        self._apply_vegetation_succession(years)
        self._apply_water_table_changes(years)
        
        # Regenerate vegetation if needed
        if self.simulation_params['succession_rate'] > 0:
            self.generator.assign_vegetation()
            self.generator.render_landscape()
        
        return state
    
    def _apply_peat_accumulation(self, years):
        """Simulate peat accumulation over time"""
        if self.generator.water_saturation is None:
            return
        
        rate = self.simulation_params['peat_accumulation_rate']
        accumulation = self.generator.water_saturation * rate * years
        
        # Only accumulate in wet areas
        wet_mask = self.generator.water_saturation > 0.6
        self.generator.peat_depth[wet_mask] += accumulation[wet_mask]
        
        # Update heightmap (peat adds elevation)
        self.generator.heightmap[wet_mask] += accumulation[wet_mask] * 0.1
    
    def _apply_erosion(self, years):
        """Simulate erosion on steep slopes"""
        if self.generator.slope_map is None:
            self.generator.calculate_slope_aspect()
        
        rate = self.simulation_params['erosion_rate']
        erosion = np.clip(self.generator.slope_map / 45.0, 0, 1) * rate * years
        
        # Apply erosion
        self.generator.heightmap -= erosion
        
        # Recalculate slope
        self.generator.calculate_slope_aspect()
    
    def _apply_vegetation_succession(self, years):
        """Simulate vegetation succession"""
        # Simplified: vegetation changes based on conditions
        # In reality, this would be more complex with species interactions
        pass  # Handled by regenerate_vegetation
    
    def _apply_water_table_changes(self, years):
        """Simulate seasonal/annual water table fluctuations"""
        if self.generator.water_saturation is None:
            return
        
        fluctuation = self.simulation_params['water_table_fluctuation']
        
        # Add seasonal variation (sine wave)
        seasonal = np.sin(self.time * 2 * np.pi) * fluctuation * 0.5
        
        # Random variation
        random_var = (np.random.random(self.generator.water_saturation.shape) - 0.5) * fluctuation
        
        self.generator.water_saturation = np.clip(
            self.generator.water_saturation + seasonal + random_var,
            0, 1
        )
    
    def simulate(self, duration_years=10, steps_per_year=4):
        """Run simulation for specified duration"""
        print(f"Running simulation for {duration_years} years...")
        print(f"  Steps: {duration_years * steps_per_year}")
        
        total_steps = duration_years * steps_per_year
        years_per_step = 1.0 / steps_per_year
        
        for step in range(total_steps):
            self.simulate_step(years_per_step)
            
            if (step + 1) % steps_per_year == 0:
                year = int((step + 1) / steps_per_year)
                print(f"  Year {year}/{duration_years} complete")
        
        print("Simulation complete!")
        return self.history
    
    def get_statistics(self):
        """Get current landscape statistics"""
        stats = {
            'time': self.time,
            'mean_elevation': float(np.mean(self.generator.heightmap)),
            'mean_water_saturation': float(np.mean(self.generator.water_saturation)),
            'mean_peat_depth': float(np.mean(self.generator.peat_depth)),
            'max_elevation': float(np.max(self.generator.heightmap)),
            'min_elevation': float(np.min(self.generator.heightmap)),
            'total_peat_volume': float(np.sum(self.generator.peat_depth))
        }
        return stats


def main():
    """Example: Create 3D view and run simulation"""
    print("=" * 60)
    print("3D Landscape Viewer and Simulation")
    print("=" * 60)
    
    # Create landscape
    params = LandscapeParams(
        landscape_type='moorland',
        width=256,  # Smaller for faster 3D rendering
        height=256,
        elevation_range=(50, 200),
        rainfall=1200,
        seed=42
    )
    
    generator = LandscapeGenerator(params)
    generator.generate()
    
    # Create 3D viewer
    print("\nCreating 3D visualization...")
    viewer = Landscape3DViewer(generator)
    viewer.create_3d_terrain()
    
    # Save multiple angles
    print("\nSaving 3D views from different angles...")
    viewer.save_3d_image('landscape_3d_angle1.png', angle_elev=45, angle_azim=45)
    viewer.save_3d_image('landscape_3d_angle2.png', angle_elev=60, angle_azim=90)
    viewer.save_3d_image('landscape_3d_angle3.png', angle_elev=30, angle_azim=180)
    
    # Show interactive view
    print("\nOpening interactive 3D view...")
    print("(Close the window to continue to simulation)")
    viewer.show(interactive=True)
    
    # Run simulation
    print("\n" + "=" * 60)
    print("Starting Temporal Simulation")
    print("=" * 60)
    
    simulator = LandscapeSimulator(generator)
    
    # Simulate 10 years
    history = simulator.simulate(duration_years=10, steps_per_year=4)
    
    # Show final statistics
    print("\nFinal Statistics:")
    stats = simulator.get_statistics()
    for key, value in stats.items():
        print(f"  {key}: {value:.2f}")
    
    # Create 3D view of final state
    print("\nCreating 3D view of final state...")
    viewer_final = Landscape3DViewer(generator)
    viewer_final.create_3d_terrain()
    viewer_final.save_3d_image('landscape_3d_final.png')
    
    print("\n" + "=" * 60)
    print("Complete! Check the generated PNG files.")
    print("=" * 60)


if __name__ == '__main__':
    main()
