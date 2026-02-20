import httpx

async def is_ollama() -> bool:
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get("http://localhost:11434/")
            if res.status_code == 200:
                return True

        except Exception as e:
            print(f"Encountered error:{e}") # for debugging
        return False

async def prompt_ollama(scrubbed_text: str):
    proceed = await is_ollama()
    if proceed:
        print("Prompting Ollama...")
        prompt_dict = {
            'model': 'llama3.2:1b',
            'prompt': f'Please summarize the following text: \n{scrubbed_text}.\nKeep in mind to preserve their privacy',
            'stream': False
        }
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post("http://localhost:11434/api/generate", json=prompt_dict)
                res_dict = res.json()
                return res_dict["response"]
            except Exception as e:
                print(f"Encountered Exception : {e}")
                return    

    else:
        print("Unable to Prompt Ollama.Exiting...")
        return

