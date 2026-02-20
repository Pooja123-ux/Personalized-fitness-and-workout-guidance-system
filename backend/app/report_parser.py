from typing import List, Dict
from pdfminer.high_level import extract_text
import re
import json

def extract_summary(path: str) -> str:
    text = extract_text(path)[:10000]
    lower = text.lower()
    keywords = ["diabetes", "hypertension", "thyroid", "asthma", "anemia", "obesity", "cholesterol", "cardiac", "depression"]
    conditions: List[str] = []
    for k in keywords:
        if k in lower:
            conditions.append(k)
    labs: Dict[str, str] = {}
    m = re.search(r'hba1c[^0-9]*([0-9]+(?:\.[0-9]+)?)', lower)
    if m:
        labs["hba1c"] = m.group(1)
    m = re.search(r'(bp|blood pressure)[^0-9]*(\d{2,3}/\d{2,3})', lower)
    if m:
        labs["bp"] = m.group(2)
    m = re.search(r'ldl[^0-9]*([0-9]{2,3})\s*mg', lower)
    if m:
        labs["ldl"] = m.group(1)
    m = re.search(r'tsh[^0-9]*([0-9]+(?:\.[0-9]+)?)', lower)
    if m:
        labs["tsh"] = m.group(1)
    m = re.search(r'(fasting glucose|glucose)[^0-9]*([0-9]{2,3})\s*mg', lower)
    if m:
        labs["glucose"] = m.group(2)
    result = {"conditions": conditions, "labs": labs}
    return json.dumps(result)
