"""FastAPI application entrypoint for ScholarVizResearchProject.

Adds CORS middleware for common local development origins and optionally
serves a built frontend UI if present under scholar-viz-ui-design/build or /dist.
"""
from pathlib import Path
import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)

app = FastAPI(title="ScholarVizResearchProject")

# Allowed origins for development (local UI servers)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optionally mount a built frontend if present. We look for the following locations
# (relative to the repository root):
# - scholar-viz-ui-design/build
# - dist
# If one of these directories exists it will be mounted at the application root ('/').
base_dir = Path(__file__).resolve().parent.parent
candidates = [
    base_dir / "scholar-viz-ui-design" / "build",
    base_dir / "dist",
]

mounted = False
for candidate in candidates:
    if candidate.exists() and candidate.is_dir():
        app.mount("/", StaticFiles(directory=str(candidate), html=True), name="ui")
        logger.info(f"Mounted static UI from {candidate} at /")
        mounted = True
        break

# If no static UI is mounted, provide a simple root endpoint so the API is reachable.
if not mounted:
    @app.get("/")
    async def read_root():
        return {"message": "ScholarVizResearchProject API is running."}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
