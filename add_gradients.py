import json
import os

themes_dir = "/home/user/my-med-tracker/src/themes"
theme_files = [f for f in os.listdir(themes_dir) if f.endswith('.json')]

for theme_file in theme_files:
    theme_path = os.path.join(themes_dir, theme_file)
    with open(theme_path, 'r') as f:
        theme = json.load(f)
    
    is_dark = theme.get('isDark', False)
    accent_ah = theme.get('accentAH', '#FF7043')
    accent_ei = theme.get('accentEI', '#FFA726')
    
    # For dark themes: bright accent gradient
    # For light themes: secondary accent gradient
    if is_dark:
        # Bright gradient colors for dark themes
        theme['gradientHeader'] = {
            "start": accent_ah,
            "end": accent_ei,
            "overlay": "rgba(0, 0, 0, 0.5)",
            "textColor": "#FFFFFF"
        }
    else:
        # Secondary/lighter gradient for light themes
        theme['gradientHeader'] = {
            "start": accent_ei,
            "end": accent_ah,
            "overlay": "rgba(255, 255, 255, 0.5)",
            "textColor": "#1A1A1A"
        }
    
    with open(theme_path, 'w') as f:
        json.dump(theme, f, indent=2)
    print(f"Updated {theme_file}")

print("All themes updated!")
