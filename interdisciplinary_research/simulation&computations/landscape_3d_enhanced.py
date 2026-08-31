"""
Enhanced 3D Landscape Viewer
Using Plotly for interactive 3D visualization
"""

import numpy as np
from landscape_generator import LandscapeGenerator, LandscapeParams
try:
    import plotly.graph_objects as go
    import plotly.express as px
    from plotly.subplots import make_subplots
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False
    print("Plotly not installed. Install with: pip install plotly")

try:
    import pyvista as pv
    PYVISTA_AVAILABLE = True
except ImportError:
    PYVISTA_AVAILABLE = False
    print("PyVista not installed. Install with: pip install pyvista")


class Landscape3DEnhanced:
    """Enhanced 3D visualization with multiple backends"""
    
    def __init__(self, generator: LandscapeGenerator):
        self.generator = generator
        if self.generator.heightmap is None:
            self.generator.generate()
    
    def create_plotly_3d(self, show_water=True, show_vegetation=True):
        """Create interactive 3D plot using Plotly"""
        if not PLOTLY_AVAILABLE:
            raise ImportError("Plotly required. Install with: pip install plotly")
        
        # Get terrain data
        x = np.arange(self.generator.params.width)
        y = np.arange(self.generator.params.height)
        X, Y = np.meshgrid(x, y)
        Z = self.generator.heightmap
        
        # Create color map
        if show_vegetation and self.generator.vegetation_map is not None:
            colors = self._get_vegetation_colors_plotly()
        else:
            colors = self._get_elevation_colors_plotly()
        
        # Create 3D surface
        fig = go.Figure(data=[go.Surface(
            x=X,
            y=Y,
            z=Z,
            surfacecolor=colors,
            colorscale='Viridis',
            showscale=True,
            colorbar=dict(title="Elevation (m)"),
            hovertemplate='<b>X</b>: %{x}<br><b>Y</b>: %{y}<br><b>Elevation</b>: %{z:.1f}m<extra></extra>'
        )])
        
        # Add water features if enabled
        if show_water and self.generator.water_saturation is not None:
            water_mask = self.generator.water_saturation > 0.85
            if np.any(water_mask):
                water_x = X[water_mask]
                water_y = Y[water_mask]
                water_z = Z[water_mask] - 0.5
                
                fig.add_trace(go.Scatter3d(
                    x=water_x.flatten(),
                    y=water_y.flatten(),
                    z=water_z.flatten(),
                    mode='markers',
                    marker=dict(
                        size=3,
                        color='rgba(0, 100, 200, 0.6)',
                        symbol='circle'
                    ),
                    name='Water/Bog Pools',
                    hovertemplate='<b>Water Pool</b><br>Elevation: %{z:.1f}m<extra></extra>'
                ))
        
        # Update layout
        fig.update_layout(
            title=f'{self.generator.params.landscape_type.capitalize()} Landscape - Interactive 3D',
            scene=dict(
                xaxis_title='X (meters)',
                yaxis_title='Y (meters)',
                zaxis_title='Elevation (meters)',
                camera=dict(
                    eye=dict(x=1.5, y=1.5, z=1.2)
                ),
                aspectmode='data'
            ),
            width=1000,
            height=800
        )
        
        return fig
    
    def create_pyvista_3d(self, show_water=True):
        """Create 3D mesh using PyVista (professional visualization)"""
        if not PYVISTA_AVAILABLE:
            raise ImportError("PyVista required. Install with: pip install pyvista")
        
        # Get terrain data
        x = np.arange(self.generator.params.width)
        y = np.arange(self.generator.params.height)
        X, Y = np.meshgrid(x, y)
        Z = self.generator.heightmap
        
        # Create structured grid
        grid = pv.StructuredGrid(X, Y, Z)
        
        # Add scalar data for coloring
        if self.generator.vegetation_map is not None:
            grid['vegetation'] = self.generator.vegetation_map.flatten()
            grid['elevation'] = Z.flatten()
        else:
            grid['elevation'] = Z.flatten()
        
        # Create plotter
        plotter = pv.Plotter()
        
        # Add terrain mesh
        plotter.add_mesh(
            grid,
            scalars='elevation',
            cmap='terrain',
            show_edges=False,
            smooth_shading=True
        )
        
        # Add water if enabled
        if show_water and self.generator.water_saturation is not None:
            water_mask = self.generator.water_saturation > 0.85
            if np.any(water_mask):
                water_z = Z.copy()
                water_z[water_mask] = Z[water_mask] - 0.5
                water_grid = pv.StructuredGrid(X, Y, water_z)
                water_grid = water_grid.extract_points(water_mask.flatten())
                
                plotter.add_mesh(
                    water_grid,
                    color='blue',
                    opacity=0.5,
                    show_edges=False
                )
        
        # Add labels and title
        plotter.add_text(
            f'{self.generator.params.landscape_type.capitalize()} Landscape',
            font_size=16
        )
        plotter.add_axes()
        plotter.add_bounding_box()
        
        return plotter
    
    def _get_vegetation_colors_plotly(self):
        """Get colors for Plotly based on vegetation"""
        palette = self.generator.COLOR_PALETTES[self.generator.params.landscape_type]
        palette_list = list(palette.values())
        
        colors = np.zeros((self.generator.params.height, self.generator.params.width))
        
        for y in range(self.generator.params.height):
            for x in range(self.generator.params.width):
                veg_type = self.generator.vegetation_map[y, x]
                # Use elevation for color mapping, vegetation affects shading
                base_elevation = self.generator.heightmap[y, x]
                # Adjust based on vegetation type
                colors[y, x] = base_elevation + (veg_type * 5)  # Small offset per type
        
        return colors
    
    def _get_elevation_colors_plotly(self):
        """Get colors based on elevation for Plotly"""
        return self.generator.heightmap
    
    def show_plotly(self, show_water=True, show_vegetation=True):
        """Display interactive Plotly 3D view"""
        fig = self.create_plotly_3d(show_water=show_water, show_vegetation=show_vegetation)
        fig.show()
        return fig
    
    def save_plotly_html(self, filename, show_water=True, show_vegetation=True):
        """Save Plotly 3D as interactive HTML"""
        fig = self.create_plotly_3d(show_water=show_water, show_vegetation=show_vegetation)
        fig.write_html(filename)
        print(f"Saved interactive 3D to {filename}")
        print(f"Open in browser to interact (rotate, zoom, pan)")
        return fig
    
    def show_pyvista(self, show_water=True):
        """Display PyVista 3D view"""
        plotter = self.create_pyvista_3d(show_water=show_water)
        plotter.show()
        return plotter
    
    def save_pyvista_screenshot(self, filename, show_water=True):
        """Save PyVista 3D as image"""
        plotter = pv.Plotter(off_screen=True)
        
        # Get terrain data
        x = np.arange(self.generator.params.width)
        y = np.arange(self.generator.params.height)
        X, Y = np.meshgrid(x, y)
        Z = self.generator.heightmap
        
        # Create structured grid
        grid = pv.StructuredGrid(X, Y, Z)
        grid['elevation'] = Z.flatten()
        
        # Add terrain mesh
        plotter.add_mesh(grid, scalars='elevation', cmap='terrain', show_edges=False)
        
        # Add water if enabled
        if show_water and self.generator.water_saturation is not None:
            water_mask = self.generator.water_saturation > 0.85
            if np.any(water_mask):
                water_z = Z.copy()
                water_z[water_mask] = Z[water_mask] - 0.5
                water_grid = pv.StructuredGrid(X, Y, water_z)
                plotter.add_mesh(water_grid, color='blue', opacity=0.5, show_edges=False)
        
        plotter.screenshot(filename)
        plotter.close()
        print(f"Saved 3D screenshot to {filename}")
    
    def create_animated_simulation(self, simulator, duration_years=10, steps=20):
        """Create animated simulation showing landscape evolution"""
        if not PLOTLY_AVAILABLE:
            raise ImportError("Plotly required for animation")
        
        from landscape_3d_viewer import LandscapeSimulator
        
        if not isinstance(simulator, LandscapeSimulator):
            simulator = LandscapeSimulator(self.generator)
        
        # Create frames
        frames = []
        years_per_step = duration_years / steps
        
        for i in range(steps + 1):
            if i > 0:
                simulator.simulate_step(years_per_step)
            
            # Create frame
            x = np.arange(self.generator.params.width)
            y = np.arange(self.generator.params.height)
            X, Y = np.meshgrid(x, y)
            Z = self.generator.heightmap
            
            frame = go.Frame(
                data=[go.Surface(
                    x=X,
                    y=Y,
                    z=Z,
                    surfacecolor=self.generator.heightmap,
                    colorscale='Viridis'
                )],
                name=f"Year {simulator.time:.1f}"
            )
            frames.append(frame)
        
        # Create initial figure
        fig = go.Figure(
            data=[go.Surface(
                x=X,
                y=Y,
                z=Z,
                surfacecolor=self.generator.heightmap,
                colorscale='Viridis'
            )],
            frames=frames
        )
        
        # Add animation controls
        fig.update_layout(
            title='Landscape Evolution Over Time',
            updatemenus=[{
                'type': 'buttons',
                'showactive': False,
                'buttons': [
                    {
                        'label': 'Play',
                        'method': 'animate',
                        'args': [None, {'frame': {'duration': 500, 'redraw': True}}]
                    },
                    {
                        'label': 'Pause',
                        'method': 'animate',
                        'args': [[None], {'frame': {'duration': 0, 'redraw': False}}]
                    }
                ]
            }],
            scene=dict(
                xaxis_title='X (meters)',
                yaxis_title='Y (meters)',
                zaxis_title='Elevation (meters)',
                camera=dict(eye=dict(x=1.5, y=1.5, z=1.2))
            )
        )
        
        return fig


def main():
    """Test enhanced 3D visualization"""
    print("=" * 60)
    print("Enhanced 3D Landscape Visualization")
    print("=" * 60)
    
    # Generate landscape
    params = LandscapeParams(
        landscape_type='peatland',
        width=200,
        height=200,
        elevation_range=(0, 50),
        rainfall=1500,
        seed=42
    )
    
    generator = LandscapeGenerator(params)
    generator.generate()
    
    viewer = Landscape3DEnhanced(generator)
    
    # Try Plotly (interactive web-based)
    if PLOTLY_AVAILABLE:
        print("\n1. Creating Plotly interactive 3D...")
        try:
            viewer.save_plotly_html('peatland_3d_interactive.html')
            print("   [OK] Saved interactive HTML - open in browser!")
        except Exception as e:
            print(f"   [ERROR] {e}")
    else:
        print("\n1. Plotly not available - install with: pip install plotly")
    
    # Try PyVista (professional 3D)
    if PYVISTA_AVAILABLE:
        print("\n2. Creating PyVista 3D...")
        try:
            viewer.save_pyvista_screenshot('peatland_3d_pyvista.png')
            print("   [OK] Saved PyVista screenshot!")
        except Exception as e:
            print(f"   [ERROR] {e}")
    else:
        print("\n2. PyVista not available - install with: pip install pyvista")
    
    print("\n" + "=" * 60)
    print("Install missing libraries:")
    print("  pip install plotly pyvista")
    print("=" * 60)


if __name__ == '__main__':
    main()
