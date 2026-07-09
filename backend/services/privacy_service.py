"""
Privacy Service — PII detection and anonymization via Microsoft Presidio.

Uses en_core_web_sm (small spacy model, ~12MB) instead of en_core_web_lg (~700MB)
to fit within the 512MB RAM limit on Render's free tier.
Accuracy is slightly lower for edge cases but fully sufficient for demo use.
"""
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

# Explicitly use the small spacy model to save RAM in production
_nlp_config = {
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
}
_provider = NlpEngineProvider(nlp_configuration=_nlp_config)
_nlp_engine = _provider.create_engine()

analyzer_engine = AnalyzerEngine(nlp_engine=_nlp_engine)
anonymizer_engine = AnonymizerEngine()


async def scrub_text(text: str) -> dict:
    is_scrubbed = False
    analyzer_results = analyzer_engine.analyze(text=text, language="en")
    if len(analyzer_results) > 0:
        is_scrubbed = True
    anonymizer_results = anonymizer_engine.anonymize(
        text=text, analyzer_results=analyzer_results
    )
    return {
        "response": anonymizer_results.text,
        "is_scrubbed": is_scrubbed,
    }