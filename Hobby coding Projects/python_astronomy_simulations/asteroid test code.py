from poliastro.plotting.orbit import plotter
import plotly.io as pio
pio.renderers.default = "plotly_mimetype+notebook_connected"  # If in Jupyter

frame = plotter(use_3d=True)
frame.show()
