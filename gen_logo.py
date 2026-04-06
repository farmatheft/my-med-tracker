import math

def layer_cushion(z, rx=140):
    return f'<rect x="{-rx}" y="{-rx}" width="{rx*2}" height="{rx*2}" rx="30" fill="#3a3a40" transform="translate(0, {-z})" />'

def layer_pill(z, r=55):
    # Pill is shifted slightly or just centered
    return f'<circle cx="0" cy="0" r="{r}" fill="#e0e0e0" transform="translate(0, {-z})" />'

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
<defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#4B4B52"/>
        <stop offset="100%" stop-color="#141416"/>
    </radialGradient>
    <pattern id="tex" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.03)" />
        <circle cx="5" cy="5" r="1" fill="rgba(0,0,0,0.1)" />
    </pattern>
</defs>
<rect width="100%" height="100%" fill="url(#bg)"/>
<rect width="100%" height="100%" fill="url(#tex)"/>

<!-- Center the scene -->
<g transform="translate(256, 320)">
    <!-- Base transform for dimetric (css isometric) -->
    <g transform="scale(1, 0.5) rotate(45)">
        <!-- Cushion shadow -->
        <rect x="-150" y="-150" width="300" height="300" rx="40" fill="rgba(0,0,0,0.6)" transform="translate(0, 0)" filter="blur(10px)"/>
"""

# Cushion body layers (z from 0 to 40)
for z in range(0, 31, 2):
    color = "#333338" if z < 30 else "#42424a"
    svg += f'        <rect x="-140" y="-140" width="280" height="280" rx="30" fill="{color}" transform="translate(0, {-z * 2})" />\n'

# Pill shadow on cushion
svg += '        <circle cx="0" cy="0" r="60" fill="rgba(0,0,0,0.5)" transform="translate(0, -60)" filter="blur(6px)"/>\n'

# Pill body layers (z from 25 to 55) - sunk into cushion slightly (cushion top Z=60 in scaled coords)
# Wait, translation in Z must be multiplied by 2 because of scale(1, 0.5).
# A translate(0, -Z) AFTER the scale means it moves visually by -0.5 * Z.
# So if Z is the visual height, we need translate(0, -Z * 2) if it is INSIDE the scale(1, 0.5) group?
# No, scale(1, 0.5) means height is squashed. So translate(bx, by) moves X by bx. Y by 0.5 * by.
# If we want a visual height shift of -Z_visual, we need translate(0, -Z_visual * 2) or translate(0, Z) but apply coordinate rotation correctly.
# Standard CSS isometric translates Z independent of scale, so its better to put Z translation OUTSIDE the scale.
pass
