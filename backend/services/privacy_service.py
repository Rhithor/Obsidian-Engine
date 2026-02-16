from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer_engine = AnalyzerEngine()
anonymizer_engine = AnonymizerEngine()

async def scrub_text(text: str) -> dict:
    is_scrubbed = False
    analyzer_results = analyzer_engine.analyze(text=text, language="en")
    if len(analyzer_results) > 0:
        is_scrubbed = True
    anonymizer_results = anonymizer_engine.anonymize(text=text, analyzer_results=analyzer_results)
    return {
        "response": anonymizer_results.text,
        "is_scrubbed": is_scrubbed
    }