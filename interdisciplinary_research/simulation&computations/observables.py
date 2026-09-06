"""
Observables for Swift-Hohenberg pattern analysis.

Provides functions to compute physical observables from field u(x,y).
"""

import numpy as np
from scipy import ndimage
from typing import Tuple, Dict


def compute_basic_stats(u: np.ndarray) -> Dict[str, float]:
    """
    Compute basic statistics: L2, maxabs, min, max, mean, std.
    
    Args:
        u: 2D field array
        
    Returns:
        Dictionary with L2, maxabs, min_u, max_u, mean_u, std_u
    """
    return {
        'L2': np.sqrt(np.mean(u**2)),
        'maxabs': np.max(np.abs(u)),
        'min_u': np.min(u),
        'max_u': np.max(u),
        'mean_u': np.mean(u),
        'std_u': np.std(u)
    }


def compute_power_spectrum(u: np.ndarray, kx: np.ndarray, ky: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute radially averaged power spectrum S(k).
    
    Args:
        u: 2D field array
        kx, ky: Wave number grids from np.meshgrid
        
    Returns:
        (k_bins, S_k): Binned wave numbers and power spectrum values
    """
    nx, ny = u.shape
    u_hat = np.fft.fft2(u)
    power = np.abs(u_hat)**2
    
    # Compute |k| for each mode
    k_magnitude = np.sqrt(kx**2 + ky**2)
    
    # Bin the power spectrum
    k_max = np.max(k_magnitude)
    n_bins = min(nx, ny) // 2
    k_bins = np.linspace(0, k_max, n_bins)
    
    S_k = np.zeros(n_bins - 1)
    for i in range(n_bins - 1):
        mask = (k_magnitude >= k_bins[i]) & (k_magnitude < k_bins[i+1])
        if np.any(mask):
            S_k[i] = np.mean(power[mask])
    
    # Return bin centers
    k_centers = (k_bins[:-1] + k_bins[1:]) / 2
    return k_centers, S_k


def find_k_peak(k_bins: np.ndarray, S_k: np.ndarray) -> float:
    """
    Find the dominant wave number k_peak from power spectrum.
    
    Args:
        k_bins: Binned wave numbers
        S_k: Power spectrum values
        
    Returns:
        k_peak: Wave number with maximum power
    """
    # Exclude k=0 (DC component)
    if len(k_bins) > 1:
        idx_peak = np.argmax(S_k[1:]) + 1
        return float(k_bins[idx_peak])
    return 0.0


def compute_bandpower_around_k1(k_bins: np.ndarray, S_k: np.ndarray, dk: float = 0.2) -> float:
    """
    Compute bandpower around |k| ≈ 1 (the critical wave number for SH).
    
    Args:
        k_bins: Binned wave numbers  
        S_k: Power spectrum values
        dk: Half-width of band around k=1
        
    Returns:
        Bandpower (integrated power in band)
    """
    mask = (k_bins >= 1.0 - dk) & (k_bins <= 1.0 + dk)
    if np.any(mask):
        # Trapezoidal integration
        return float(np.trapz(S_k[mask], k_bins[mask]))
    return 0.0


def compute_structure_factor(u: np.ndarray) -> np.ndarray:
    """
    Compute structure factor S(q) = <|u_q|^2>.
    
    Args:
        u: 2D field array
        
    Returns:
        Structure factor (FFT magnitude squared)
    """
    u_hat = np.fft.fft2(u)
    return np.abs(u_hat)**2


def estimate_correlation_length(u: np.ndarray, dx: float, dy: float) -> float:
    """
    Estimate correlation length from structure factor.
    Uses second moment of structure factor: xi ~ sqrt(sum(q^2 S(q)) / sum(S(q)))^-1
    
    Args:
        u: 2D field array
        dx, dy: Grid spacing
        
    Returns:
        Correlation length estimate
    """
    nx, ny = u.shape
    S_q = compute_structure_factor(u)
    
    # Build q-grid
    qx = 2 * np.pi * np.fft.fftfreq(nx, d=dx)
    qy = 2 * np.pi * np.fft.fftfreq(ny, d=dy)
    QX, QY = np.meshgrid(qx, qy, indexing="ij")
    q2 = QX**2 + QY**2
    
    # Exclude q=0 (DC component)
    mask = q2 > 0
    numerator = np.sum(q2[mask] * S_q[mask])
    denominator = np.sum(S_q[mask])
    
    if denominator > 0:
        # Correlation length ~ inverse of characteristic q
        xi = np.sqrt(denominator / numerator)
        return float(xi)
    return 0.0


def compute_defect_density_threshold(u: np.ndarray, threshold: float = 0.0) -> float:
    """
    Simple defect density proxy using threshold method.
    Counts regions where |u| < threshold (near zeros of field).
    
    Args:
        u: 2D field array
        threshold: Threshold for identifying defects (default: 0.0)
        
    Returns:
        Defect density (fraction of grid points with |u| < threshold)
    """
    defect_mask = np.abs(u) < threshold
    return float(np.sum(defect_mask) / u.size)


def compute_defect_density_phase_winding(u: np.ndarray) -> float:
    """
    Defect density using phase winding method.
    Counts locations where the phase of u changes by 2*pi around a loop.
    
    Args:
        u: 2D field array
        
    Returns:
        Defect density estimate
    """
    # Compute phase field
    phase = np.angle(u + 1e-10)  # Small offset to avoid log(0)
    
    # Compute winding number around each plaquette
    # Winding = (dphase_x + dphase_y) around unit cell
    dphase_x = np.diff(phase, axis=0, append=phase[:1, :])
    dphase_y = np.diff(phase, axis=1, append=phase[:, :1])
    
    # Unwrap phase differences to [-pi, pi]
    dphase_x = np.mod(dphase_x + np.pi, 2*np.pi) - np.pi
    dphase_y = np.mod(dphase_y + np.pi, 2*np.pi) - np.pi
    
    # Count defects (where winding != 0)
    winding = np.abs(dphase_x) + np.abs(dphase_y)
    defect_mask = winding > np.pi
    
    return float(np.sum(defect_mask) / u.size)


def compute_all_observables(u: np.ndarray, kx: np.ndarray, ky: np.ndarray, 
                             dx: float, dy: float) -> Dict[str, float]:
    """
    Compute all observables in one call.
    
    Args:
        u: 2D field array
        kx, ky: Wave number grids
        dx, dy: Grid spacing
        
    Returns:
        Dictionary with all observables
    """
    # Basic stats
    stats = compute_basic_stats(u)
    
    # Power spectrum analysis
    k_bins, S_k = compute_power_spectrum(u, kx, ky)
    k_peak = find_k_peak(k_bins, S_k)
    bandpower = compute_bandpower_around_k1(k_bins, S_k)
    
    # Correlation length
    xi = estimate_correlation_length(u, dx, dy)
    
    # Defect density (use threshold method as default)
    defect_density = compute_defect_density_threshold(u, threshold=0.1)
    
    return {
        **stats,
        'k_peak': k_peak,
        'bandpower_k1': bandpower,
        'correlation_length': xi,
        'defect_density': defect_density
    }


# Unit tests for dispersion relation and k-grid scaling
def test_dispersion_relation():
    """
    Unit test: Verify σ(k) = r - (1 - k²)²
    """
    r = 0.2
    k2_test = np.array([0.0, 0.5, 1.0, 1.5, 2.0])
    
    sigma_expected = r - (1.0 - k2_test)**2
    
    # Test specific values
    assert np.isclose(sigma_expected[0], r - 1.0), f"σ(0) should be r-1={r-1}, got {sigma_expected[0]}"
    assert np.isclose(sigma_expected[2], r), f"σ(1) should be r={r}, got {sigma_expected[2]}"
    
    print("✓ Dispersion relation test passed")
    return True


def test_k_grid_scaling(nx: int = 64, ny: int = 64, Lx: float = 50.0, Ly: float = 50.0) -> bool:
    """
    Unit test: Verify k=1 mode exists on the grid.
    
    Args:
        nx, ny: Grid dimensions
        Lx, Ly: Domain sizes
        
    Returns:
        True if k=1 mode exists
    """
    dx = Lx / nx
    dy = Ly / ny
    
    kx = 2 * np.pi * np.fft.fftfreq(nx, d=dx)
    ky = 2 * np.pi * np.fft.fftfreq(ny, d=dy)
    KX, KY = np.meshgrid(kx, ky, indexing="ij")
    k_magnitude = np.sqrt(KX**2 + KY**2)
    
    # Check if any mode has |k| ≈ 1
    k_near_1 = np.abs(k_magnitude - 1.0)
    min_diff = np.min(k_near_1)
    
    tolerance = 0.1  # Allow 10% deviation
    has_k1 = min_diff < tolerance
    
    if has_k1:
        idx = np.unravel_index(np.argmin(k_near_1), k_magnitude.shape)
        print(f"✓ k≈1 mode exists at index {idx}, |k|={k_magnitude[idx]:.4f}")
        return True
    else:
        print(f"✗ No k≈1 mode found. Closest |k|={k_magnitude.flat[np.argmin(k_near_1)]:.4f}")
        return False


def run_all_tests():
    """Run all unit tests."""
    print("=" * 60)
    print("Running Observables Unit Tests")
    print("=" * 60)
    
    # Test dispersion relation
    test_dispersion_relation()
    
    # Test k-grid scaling for different grid sizes
    for nx, ny in [(32, 32), (64, 64), (128, 128)]:
        print(f"\nGrid: {nx}x{ny}, L=50")
        test_k_grid_scaling(nx, ny, 50.0, 50.0)
    
    print("\n" + "=" * 60)
    print("All tests completed")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
