"""Configuración de pytest: añade netlify/functions/generate al path para importar los módulos."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "netlify" / "functions" / "generate"))
