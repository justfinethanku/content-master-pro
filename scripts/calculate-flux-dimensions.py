#!/usr/bin/env python3
"""
Calculate optimal dimensions for BFL FLUX models.

Handles multiple-of-16 constraints for FLUX 2 Pro and ~1MP limits for Kontext Pro.
"""

import sys
from typing import Tuple


def round_to_multiple(n: int, multiple: int) -> int:
    """Round to nearest multiple."""
    return (n // multiple) * multiple


def calculate_flux_2_pro_dimensions(
    width: int, height: int, max_mp: float = 4.0
) -> Tuple[int, int, float]:
    """
    Calculate valid dimensions for FLUX 2 Pro.

    Constraints:
    - Dimensions must be multiples of 16
    - Maximum 4MP (recommended ≤2MP)
    - Minimum 64×64

    Returns (actual_width, actual_height, megapixels)
    """
    # Round to multiples of 16
    actual_width = round_to_multiple(width, 16)
    actual_height = round_to_multiple(height, 16)

    # Ensure minimum
    actual_width = max(actual_width, 64)
    actual_height = max(actual_height, 64)

    # Calculate megapixels
    mp = (actual_width * actual_height) / 1_000_000

    # Check if exceeds max
    if mp > max_mp:
        # Scale down while maintaining aspect ratio
        scale = (max_mp / mp) ** 0.5
        actual_width = round_to_multiple(int(actual_width * scale), 16)
        actual_height = round_to_multiple(int(actual_height * scale), 16)
        mp = (actual_width * actual_height) / 1_000_000

    return actual_width, actual_height, mp


def calculate_flux_kontext_dimensions(
    aspect_ratio: str, target_mp: float = 1.0
) -> Tuple[int, int, float]:
    """
    Calculate dimensions for FLUX Kontext Pro given aspect ratio.

    Constraints:
    - Total ~1MP regardless of aspect ratio
    - Aspect ratio range: 3:7 to 7:3
    - Default: 1024×1024

    Returns (width, height, megapixels)
    """
    # Parse aspect ratio
    if ":" in aspect_ratio:
        w_ratio, h_ratio = map(int, aspect_ratio.split(":"))
    else:
        w_ratio, h_ratio = 1, 1

    # Calculate dimensions for target megapixels
    total_pixels = target_mp * 1_000_000

    # w * h = total_pixels
    # w / h = w_ratio / h_ratio
    # h = w * (h_ratio / w_ratio)
    # w * w * (h_ratio / w_ratio) = total_pixels
    # w^2 = total_pixels * (w_ratio / h_ratio)

    width = int((total_pixels * (w_ratio / h_ratio)) ** 0.5)
    height = int((total_pixels * (h_ratio / w_ratio)) ** 0.5)

    # Round to even numbers for better compatibility
    width = (width // 2) * 2
    height = (height // 2) * 2

    mp = (width * height) / 1_000_000

    return width, height, mp


def main():
    print("BFL FLUX Dimension Calculator")
    print("=" * 60)

    # Common aspect ratios and resolutions
    test_cases = [
        # Standard resolutions
        ("1920×1080 (Full HD)", 1920, 1080),
        ("2560×1440 (QHD)", 2560, 1440),
        ("3840×2160 (4K)", 3840, 2160),
        # Social media
        ("1080×1080 (Instagram Square)", 1080, 1080),
        ("1080×1920 (Instagram Story)", 1080, 1920),
        ("1200×630 (Facebook/Twitter)", 1200, 630),
        # Content creation
        ("2048×2048 (Max square)", 2048, 2048),
        ("1792×1024 (16:9 @ 1.8MP)", 1792, 1024),
    ]

    print("\n## FLUX 2 Pro (must be multiples of 16, max 4MP)")
    print("-" * 60)
    print(f"{'Requested':<30} {'Actual':<20} {'MP':<10} {'Status'}")
    print("-" * 60)

    for name, w, h in test_cases:
        actual_w, actual_h, mp = calculate_flux_2_pro_dimensions(w, h)
        status = "✓" if mp <= 2.0 else ("⚠" if mp <= 4.0 else "✗")
        changed = "" if (actual_w == w and actual_h == h) else " (adjusted)"
        print(f"{name:<30} {actual_w}×{actual_h:<14} {mp:>6.2f} MP {status}{changed}")

    print("\n## FLUX Kontext Pro (~1MP, any aspect ratio 3:7 to 7:3)")
    print("-" * 60)
    print(f"{'Aspect Ratio':<20} {'Dimensions':<20} {'MP':<10}")
    print("-" * 60)

    aspect_ratios = [
        "1:1", "16:9", "9:16", "4:3", "3:4",
        "3:2", "2:3", "21:9", "9:21"
    ]

    for ratio in aspect_ratios:
        w, h, mp = calculate_flux_kontext_dimensions(ratio)
        print(f"{ratio:<20} {w}×{h:<14} {mp:>6.2f} MP")

    print("\n## FLUX 1.1 Pro Ultra")
    print("-" * 60)
    print("Documented max: 2048×2048 (4MP)")
    print("Observed output: 2752×1536 (4.23MP)")
    print("Note: May support higher resolutions than documented.")
    print("Recommend testing empirically for production use.")

    # Interactive mode
    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        print("\n" + "=" * 60)
        print("Interactive Mode")
        print("Enter dimensions to calculate (e.g., 1920 1080) or 'q' to quit")

        while True:
            try:
                user_input = input("\nWidth Height: ").strip()
                if user_input.lower() in ['q', 'quit', 'exit']:
                    break

                w, h = map(int, user_input.split())

                print("\nFLUX 2 Pro:")
                actual_w, actual_h, mp = calculate_flux_2_pro_dimensions(w, h)
                status = "✓" if mp <= 2.0 else ("⚠" if mp <= 4.0 else "✗")
                print(f"  {actual_w}×{actual_h} ({mp:.2f} MP) {status}")

                # Calculate aspect ratio
                from math import gcd
                divisor = gcd(w, h)
                ratio = f"{w//divisor}:{h//divisor}"
                print(f"\nFLUX Kontext Pro (aspect ratio {ratio}):")
                k_w, k_h, k_mp = calculate_flux_kontext_dimensions(ratio)
                print(f"  {k_w}×{k_h} ({k_mp:.2f} MP)")

            except (ValueError, EOFError):
                break


if __name__ == "__main__":
    main()
