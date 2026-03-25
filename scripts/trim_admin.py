"""
Rewrites api/routes/admin.py to keep only:
  - admin_login
  - get_statistics
  - get_students_with_skills
  - clear_cache
All other routes have been moved to dedicated sub-files.
"""
import os, ast, textwrap

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(BASE, "api", "routes", "admin.py")

with open(src, encoding="utf-8") as f:
    source = f.read()

tree = ast.parse(source)
lines = source.splitlines(keepends=True)

# Functions to keep
KEEP = {"admin_login", "get_statistics", "get_students_with_skills", "clear_cache"}

# Find line ranges of all top-level function defs (and their decorators)
funcs = []
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name in KEEP:
        # decorator_list[0].lineno gives start of first decorator if present
        start = (node.decorator_list[0].lineno if node.decorator_list else node.lineno)
        end = node.end_lineno
        funcs.append((start, end, node.name))

funcs.sort()
print("Functions found:", [(n, s, e) for s, e, n in funcs])

# Build output: header lines (everything before the first function to remove)
# Header = everything up to and including the blueprint definition line
header_end = 0
for i, line in enumerate(lines, 1):
    if "admin_bp = Blueprint" in line:
        header_end = i
        break

header = "".join(lines[:header_end])

# Collect kept function bodies
kept_bodies = []
for start, end, name in funcs:
    body = "".join(lines[start - 1 : end])
    kept_bodies.append(body)

new_content = header + "\n\n" + "\n\n".join(kept_bodies) + "\n"

with open(src, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Done. admin.py rewritten ({len(new_content.splitlines())} lines).")
