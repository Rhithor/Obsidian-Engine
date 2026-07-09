"""
Privacy Service — PII detection and anonymization via Microsoft Presidio.

Engines are lazy-loaded on first use (not at import/startup time).
This saves ~100MB of RAM at startup on Render's 512MB free tier,
since most requests never touch the scrub endpoint.
"""
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

_analyzer_engine = None
_anonymizer_engine = None


def _get_engines():
    """Lazy-initialises Presidio engines on first call."""
    global _analyzer_engine, _anonymizer_engine
    if _analyzer_engine is None:
        nlp_config = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
        provider = NlpEngineProvider(nlp_configuration=nlp_config)
        nlp_engine = provider.create_engine()
        _analyzer_engine = AnalyzerEngine(nlp_engine=nlp_engine)
        _anonymizer_engine = AnonymizerEngine()
    return _analyzer_engine, _anonymizer_engine


async def scrub_text(text: str) -> dict:
    analyzer, anonymizer = _get_engines()
    is_scrubbed = False
    analyzer_results = analyzer.analyze(text=text, language="en")
    if len(analyzer_results) > 0:
        is_scrubbed = True
    anonymizer_results = anonymizer.anonymize(
        text=text, analyzer_results=analyzer_results
    )
    return {
        "response": anonymizer_results.text,
        "is_scrubbed": is_scrubbed,
    }