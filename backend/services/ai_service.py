from httpx import AsyncClient

async def is_ollama() -> bool:
    async with AsyncClient() as client:
        try:
            res = await client.get("http://localhost:11434/")
            if res.status_code == 200:
                return True

        except Exception as e:
            print(f"Encountered error:{e}") # for debugging
        return False