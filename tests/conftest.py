import sys
from pathlib import Path

# Ensure the backend package folder (ScholarVizResearchProjectMain/) is on sys.path
# so `import app` works regardless of pytest rootdir selection.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
