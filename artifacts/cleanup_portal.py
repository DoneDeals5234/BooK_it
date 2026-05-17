import os

file_path = r'c:\Users\pv173\Downloads\book it web android app\src\components\BarberPortal.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want to keep lines up to index 2891 (line 2892)
# And keep lines from index 3256 onwards (line 3257)
# Indices are 0-based, so line N is index N-1.
# Keep 0 to 2892-1 (index 2891 inclusive) -> lines[:2892]
# Keep 3257-1 (index 3256) to end -> lines[3256:]

# Let's double check the markers
start_marker = "{currentTab === 'products' && selectedShop && ("
end_marker = "{currentTab === 'offers' && selectedShop && ("

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if start_marker in line and i > 2800:
        # Check if the next line is the ProductsTab we just added
        if "<ProductsTab" in lines[i+1]:
            start_idx = i + 3 # Start deleting after the closing brace of the new tab
    if end_marker in line and i > start_idx and start_idx != -1:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + lines[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Successfully deleted {end_idx - start_idx} lines.")
else:
    print(f"Could not find markers. Start: {start_idx}, End: {end_idx}")
