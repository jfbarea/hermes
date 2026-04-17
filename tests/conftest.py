"""Configuración de pytest: añade netlify/functions al path para importar prompt_builder."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "netlify" / "functions"))
